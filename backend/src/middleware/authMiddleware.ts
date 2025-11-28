import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db';

interface AuthRequest extends Request {
  user?: any;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    let token;
    
    // Debug logs
    console.log('[AuthMiddleware] Headers:', JSON.stringify(req.headers));
    console.log('[AuthMiddleware] Cookies:', JSON.stringify(req.cookies));

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      console.log('[AuthMiddleware] No token found in header or cookies');
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);

    // Verify user exists in DB
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
