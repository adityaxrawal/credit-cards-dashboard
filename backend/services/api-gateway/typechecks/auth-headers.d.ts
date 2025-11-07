/**
 * Type Safety Checks for Authentication
 *
 * This file exists solely to enforce compile-time type checking.
 * It ensures that AuthRequest properly extends Express.Request and
 * that critical properties like req.headers.authorization are accessible.
 *
 * If this file fails to compile, it means:
 * 1. AuthRequest doesn't properly extend Express.Request
 * 2. Express types are missing (@types/express)
 * 3. Type definitions are incorrectly configured
 *
 * This file is NOT imported at runtime - it's only for compile-time validation.
 */

import { Request } from "express";
import { AuthRequest } from "../common/middleware/auth";

/**
 * Compile-time assertion: AuthRequest must be assignable to Request
 * This will fail to compile if AuthRequest doesn't extend Request properly
 */
type AssertAuthRequestExtendsRequest = AuthRequest extends Request ? true : never;
const _authRequestCheck: AssertAuthRequestExtendsRequest = true;

/**
 * Compile-time check: req.headers must be accessible
 * This will fail if Express types are missing or misconfigured
 */
function _checkHeadersAccess(req: AuthRequest): void {
  // This should compile without errors
  const authHeader: string | undefined = req.headers.authorization;
  const contentType: string | undefined = req.headers["content-type"];

  // Ensure headers is the correct Express type
  const headers: Request["headers"] = req.headers;

  // Prevent unused variable warnings
  void authHeader;
  void contentType;
  void headers;
}

/**
 * Compile-time check: custom properties must be accessible
 */
function _checkCustomProperties(req: AuthRequest): void {
  const userId: string | undefined = req.userId;
  const email: string | undefined = req.email;

  // Prevent unused variable warnings
  void userId;
  void email;
}

/**
 * Compile-time check: all Express Request properties are available
 */
function _checkExpressProperties(req: AuthRequest): void {
  // Standard Express properties that must be accessible
  const body: unknown = req.body;
  const params: Record<string, string> = req.params;
  const query: Record<string, unknown> = req.query;
  const method: string = req.method;
  const url: string | undefined = req.url;
  const path: string = req.path;

  // Prevent unused variable warnings
  void body;
  void params;
  void query;
  void method;
  void url;
  void path;
}

// Export a type to ensure this module is recognized as a module
export type TypeCheckModule = typeof _authRequestCheck;

/**
 * If you're seeing errors in this file, here's how to fix them:
 *
 * TS2339: Property 'headers' does not exist on type 'AuthRequest'
 *   → Fix: Ensure AuthRequest extends Express.Request (import from "express")
 *   → Fix: Install @types/express: npm install --save-dev @types/express
 *
 * TS2307: Cannot find module 'express'
 *   → Fix: Install express types: npm install --save-dev @types/express
 *   → Fix: Ensure "types": ["node"] is in tsconfig.json
 *
 * TS2344: Type 'AuthRequest' does not satisfy the constraint 'Request'
 *   → Fix: Check that AuthRequest properly extends Request in auth.ts
 *   → Ensure: export interface AuthRequest extends Request { ... }
 */
