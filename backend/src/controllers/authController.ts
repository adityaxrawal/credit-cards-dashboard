import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { z } from 'zod';

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const generateTokens = (userId: string) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '30d' });
  return { accessToken, refreshToken };
};

export const googleLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    // Exchange authorization code for tokens
    const { tokens } = await client.getToken({
      code,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI, // Must match frontend redirect_uri
    });

    const idToken = tokens.id_token;
    if (!idToken) {
      return res.status(400).json({ error: 'No ID token returned from Google' });
    }

    // Verify the ID token
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(400).json({ error: 'Invalid token payload' });
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({ error: 'Email not provided by Google' });
    }

    // Upsert user
    let userResult = await pool.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    let user;

    if (userResult.rows.length === 0) {
      // Create new user
      const insertResult = await pool.query(
        `INSERT INTO users (google_id, email, name, picture) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [googleId, email, name, picture]
      );
      user = insertResult.rows[0];
    } else {
      // Update existing user
      const updateResult = await pool.query(
        `UPDATE users 
         SET name = $2, picture = $3, updated_at = NOW() 
         WHERE google_id = $1 
         RETURNING *`,
        [googleId, name, picture]
      );
      user = updateResult.rows[0];
    }

    // Store refresh token if available (for offline access like Gmail API)
    if (tokens.refresh_token) {
      // TODO: Store tokens.refresh_token securely in DB for this user
      // This is needed for background Gmail sync
      await pool.query(
        `UPDATE users SET google_refresh_token = $2 WHERE id = $1`,
        [user.id, tokens.refresh_token]
      );
    }

    const { accessToken, refreshToken } = generateTokens(user.id);

    // Debug logs for cookie generation
    console.log('[AuthController] Generating tokens for user:', user.id);
    console.log('[AuthController] Access Token Options:', {
      httpOnly: true,
      secure: false, // Forced false for debugging
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 1000
    });

    // Set cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: false, // Forced false for debugging
      sameSite: 'lax',
      path: '/', // Explicitly set path to root
      maxAge: 60 * 60 * 1000 // 1 hour
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false, // Forced false for debugging
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json({
      success: true,
      data: {
        user,
        accessToken, // Optional: return if client needs it for non-cookie usage
      }
    });

    // Trigger background Gmail sync
    // We check if we have a refresh token either from the new login or existing in DB
    const hasRefreshToken = !!tokens.refresh_token || !!user.google_refresh_token;
    
    console.log(`[Auth] User ${user.id} login successful. Has refresh token: ${hasRefreshToken}`);

  } catch (error) {
    console.error('Google login error:', error);
    next(error);
  }
};

export const getMe = async (req: any, res: Response, next: NextFunction) => {
  try {
    res.json(req.user);
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { refreshToken } = req.body;
    
    // Also check cookies if not in body
    if (!refreshToken && req.cookies && req.cookies.refreshToken) {
      refreshToken = req.cookies.refreshToken;
    }

    if (!refreshToken) {
      return res.status(400).json({ error: 'Missing refresh token' });
    }

    const decoded: any = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string);
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const tokens = generateTokens(decoded.userId);

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: false, // Forced false for debugging
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 1000 // 1 hour
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: false, // Forced false for debugging
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json(tokens);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
};

export const logout = async (req: Request, res: Response) => {
  // Client side should discard tokens.
  // Optionally blacklist token in Redis if needed.
  res.json({ message: 'Logged out successfully' });
};
