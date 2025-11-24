import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { z } from 'zod';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateTokens = (userId: string) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

export const googleLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Missing credential' });
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
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

    const { accessToken, refreshToken } = generateTokens(user.id);

    res.json({
      user,
      accessToken,
      refreshToken
    });
  } catch (error) {
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
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Missing refresh token' });
    }

    const decoded: any = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string);
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const tokens = generateTokens(decoded.userId);
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
