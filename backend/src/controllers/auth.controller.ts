import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository';
import { env } from '../config/env';
import { asyncHandler } from '../utils/asyncHandler';
import { encrypt } from '../utils/encryption';

const client = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI
);

const generateTokens = (userId: string) => {
  const accessToken = jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '1h' });
  const refreshToken = jwt.sign({ userId }, env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken };
};

export const googleLogin = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  // Exchange authorization code for tokens
  const { tokens } = await client.getToken({
    code,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
  });

  const idToken = tokens.id_token;
  if (!idToken) {
    return res.status(400).json({ error: 'No ID token returned from Google' });
  }

  // Verify the ID token
  const ticket = await client.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
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
  let user = await UserRepository.findByGoogleId(googleId);

  if (!user) {
    // Create new user
    user = await UserRepository.create({
      googleId,
      email,
      name: name || '',
      picture: picture || '',
    });
  } else {
    // Update existing user
    user = await UserRepository.update(googleId, {
      name: name || '',
      picture: picture || '',
    });
  }

  // Store refresh token if available (for offline access like Gmail API)
  if (tokens.refresh_token) {
    const encryptedToken = encrypt(tokens.refresh_token);
    await UserRepository.updateRefreshToken(user.id, encryptedToken);
  }

  const { accessToken, refreshToken } = generateTokens(user.id);

  // Set cookies
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 1000 // 1 hour
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
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

  const hasRefreshToken = !!tokens.refresh_token || !!user.google_refresh_token;
});

export const getMe = asyncHandler(async (req: any, res: Response) => {
  res.json(req.user);
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  let { refreshToken } = req.body;

  // Also check cookies if not in body
  if (!refreshToken && req.cookies && req.cookies.refreshToken) {
    refreshToken = req.cookies.refreshToken;
  }

  if (!refreshToken) {
    return res.status(400).json({ error: 'Missing refresh token' });
  }

  let decoded: any;
  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  const user = await UserRepository.findById(decoded.userId);

  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  const tokens = generateTokens(decoded.userId);

  // Set cookies
  res.cookie('accessToken', tokens.accessToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 1000 // 1 hour
  });

  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  res.json(tokens);
});

export const logout = async (req: Request, res: Response) => {
  // Client side should discard tokens.
  // Optionally blacklist token in Redis if needed.
  res.json({ message: 'Logged out successfully' });
};
