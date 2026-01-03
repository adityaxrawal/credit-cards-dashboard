/**
 * Auth Controller
 * 
 * Handles authentication endpoints (Google OAuth, JWT tokens).
 * Uses factory pattern for dependency injection.
 * 
 * Part of Issue #12: Controller-Service Dependency Injection
 */

import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { env } from '@shared/config/env';
import { asyncHandler } from '@shared/utils/helpers/asyncHandler';
import { encrypt } from '@shared/utils/helpers/encryption';
import { AuthRequest, JwtPayload } from '@shared/types/auth.types';
import { IUserRepository } from '@shared/types/services';
import logger from '@shared/utils/infrastructure/logger';

/**
 * Auth dependencies interface
 */
export interface IAuthDependencies {
  userRepository: IUserRepository;
  oauthClient: OAuth2Client;
  jwtSecret: string;
  jwtRefreshSecret: string;
  nodeEnv: string;
  googleRedirectUri: string;
}

/**
 * Controller interface - uses Express handler signature
 */
export interface IAuthController {
  googleLogin: ReturnType<typeof asyncHandler>;
  getMe: ReturnType<typeof asyncHandler>;
  refresh: ReturnType<typeof asyncHandler>;
  logout(req: Request, res: Response, next: NextFunction): Promise<void>;
}

/**
 * Generate JWT tokens
 */
function generateTokens(userId: string, jwtSecret: string, jwtRefreshSecret: string) {
  const accessToken = jwt.sign({ userId }, jwtSecret, { expiresIn: '1h' });
  const refreshToken = jwt.sign({ userId }, jwtRefreshSecret, { expiresIn: '30d' });
  return { accessToken, refreshToken };
}

/**
 * Factory function to create Auth controller with injected dependencies
 */
export function createAuthController(deps: IAuthDependencies): IAuthController {
  const { userRepository, oauthClient, jwtSecret, jwtRefreshSecret, nodeEnv, googleRedirectUri } = deps;

  return {
    googleLogin: asyncHandler(async (req: Request, res: Response) => {
      logger.info('[AuthController] Google login request received');
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ error: 'Missing authorization code' });
      }

      // Exchange authorization code for tokens
      const { tokens } = await oauthClient.getToken({
        code,
        redirect_uri: googleRedirectUri,
      });

      const idToken = tokens.id_token;
      if (!idToken) {
        return res.status(400).json({ error: 'No ID token returned from Google' });
      }

      // Verify the ID token
      const ticket = await oauthClient.verifyIdToken({
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
      let user = await userRepository.findByGoogleId(googleId);

      if (!user) {
        user = await userRepository.create({
          googleId,
          email,
          name: name || '',
          picture: picture || '',
        });
      } else {
        user = await userRepository.update(googleId, {
          name: name || '',
          picture: picture || '',
        });
      }

      // Store refresh token if available
      if (tokens.refresh_token && userRepository.updateRefreshToken) {
        const encryptedToken = encrypt(tokens.refresh_token);
        await userRepository.updateRefreshToken(user.id, encryptedToken);
      }

      const jwts = generateTokens(user.id, jwtSecret, jwtRefreshSecret);

      // Set cookies
      // In development, set domain to 'localhost' to share cookies across ports (3000/3001)
      const cookieDomain = nodeEnv === 'development' ? 'localhost' : undefined;

      res.cookie('accessToken', jwts.accessToken, {
        httpOnly: true,
        secure: nodeEnv === 'production',
        sameSite: 'lax',
        path: '/',
        domain: cookieDomain,
        maxAge: 60 * 60 * 1000
      });

      res.cookie('refreshToken', jwts.refreshToken, {
        httpOnly: true,
        secure: nodeEnv === 'production',
        sameSite: 'lax',
        path: '/',
        domain: cookieDomain,
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      res.json({
        success: true,
        data: { user, accessToken: jwts.accessToken }
      });
    }),

    getMe: asyncHandler(async (req: AuthRequest, res: Response) => {
      logger.info('[AuthController] GET /me request received');
      const maskedEmail = req.user ? req.user.email.replace(/(.{1})(.*)(@.*)/, '$1***$3') : 'NO USER';
      // logger.info(`[AuthController] User from auth middleware: ${maskedEmail}`);
      if (!req.user) {
        logger.warn('[AuthController] No user in request, returning 401');
        return res.status(401).json({ error: 'Not authenticated' });
      }
      logger.info(`[AuthController] Returning user data for: ${maskedEmail}`);

      // Format response to match frontend User interface (camelCase)
      const formattedUser = {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name || '',
        profilePicture: req.user.picture || '',
        gmailConnected: !!req.user.google_refresh_token,
        isAdmin: req.user.is_admin || false,
        monthlyBudget: req.user.monthly_budget ? parseFloat(req.user.monthly_budget) : undefined,
      };

      res.json(formattedUser);
    }),

    refresh: asyncHandler(async (req: Request, res: Response) => {
      logger.info('[AuthController] ========== Token refresh request START ==========');
      let { refreshToken } = req.body;
      logger.info(`[AuthController] refreshToken from body: ${refreshToken ? 'present' : 'missing'}`);

      if (!refreshToken && req.cookies?.refreshToken) {
        refreshToken = req.cookies.refreshToken;
        logger.info(`[AuthController] refreshToken from cookie: ${refreshToken ? refreshToken.substring(0, 20) + '...' : 'missing'}`);
      }

      if (!refreshToken) {
        logger.warn('[AuthController] ❌ No refresh token provided - returning 400');
        return res.status(400).json({ error: 'Missing refresh token' });
      }

      let decoded: JwtPayload;
      // In development, need domain to properly clear cookies across ports
      const cookieDomainForClear = nodeEnv === 'development' ? 'localhost' : undefined;
      try {
        logger.info('[AuthController] Verifying refresh token...');
        decoded = jwt.verify(refreshToken, jwtRefreshSecret) as JwtPayload;
        logger.info(`[AuthController] ✅ Token verified, userId: ${decoded.userId}`);
      } catch (error) {
        logger.error('[AuthController] ❌ Refresh token verification FAILED:', error);
        res.clearCookie('accessToken', { path: '/', domain: cookieDomainForClear });
        res.clearCookie('refreshToken', { path: '/', domain: cookieDomainForClear });
        logger.info('[AuthController] Cleared cookies, returning 401');
        return res.status(401).json({
          error: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid refresh token',
          clearSession: true
        });
      }

      logger.info(`[AuthController] Looking up user: ${decoded.userId}`);
      const user = await userRepository.findById(decoded.userId);

      if (!user) {
        logger.warn(`[AuthController] ❌ User not found: ${decoded.userId}`);
        res.clearCookie('accessToken', { path: '/', domain: cookieDomainForClear });
        res.clearCookie('refreshToken', { path: '/', domain: cookieDomainForClear });
        return res.status(401).json({
          error: 'USER_NOT_FOUND',
          message: 'User not found',
          clearSession: true
        });
      }
      logger.info(`[AuthController] ✅ User found: ${user.email}`);

      const tokens = generateTokens(decoded.userId, jwtSecret, jwtRefreshSecret);
      logger.info('[AuthController] Generated new tokens');

      // In development, set domain to 'localhost' to share cookies across ports
      const cookieDomain = nodeEnv === 'development' ? 'localhost' : undefined;

      res.cookie('accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: nodeEnv === 'production',
        sameSite: 'lax',
        path: '/',
        domain: cookieDomain,
        maxAge: 60 * 60 * 1000
      });

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: nodeEnv === 'production',
        sameSite: 'lax',
        path: '/',
        domain: cookieDomain,
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      logger.info('[AuthController] ✅ Set new cookies, returning tokens');
      logger.info('[AuthController] ========== Token refresh request END ==========');
      res.json(tokens);
    }),

    logout: async (req: Request, res: Response) => {
      // In development, need to specify domain to properly clear cookies
      const cookieDomain = nodeEnv === 'development' ? 'localhost' : undefined;
      res.clearCookie('accessToken', { path: '/', domain: cookieDomain });
      res.clearCookie('refreshToken', { path: '/', domain: cookieDomain });
      res.json({ message: 'Logged out successfully' });
    },
  };
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

import { UserRepository } from '@modules/user/user.repository';

const oauthClient = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI
);

// Adapt UserRepository to interface (it's a static class)
const userRepositoryAdapter: IUserRepository = {
  findById: (id) => UserRepository.findById(id),
  findByEmail: async (email) => {
    // UserRepository uses findByGoogleId, so we delegate to that for email lookups
    // In practice, this may need to be implemented if needed
    return null;
  },
  findByGoogleId: (googleId) => UserRepository.findByGoogleId(googleId),
  create: (data) => UserRepository.create(data),
  update: (id, data) => UserRepository.update(id, data),
  updateRefreshToken: (id, token) => UserRepository.updateRefreshToken(id, token),
};

const defaultController = createAuthController({
  userRepository: userRepositoryAdapter,
  oauthClient,
  jwtSecret: env.JWT_SECRET,
  jwtRefreshSecret: env.JWT_REFRESH_SECRET,
  nodeEnv: env.NODE_ENV,
  googleRedirectUri: env.GOOGLE_REDIRECT_URI,
});

export const googleLogin = defaultController.googleLogin;
export const getMe = defaultController.getMe;
export const refresh = defaultController.refresh;
export const logout = defaultController.logout;
