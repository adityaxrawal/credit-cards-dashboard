import { Router } from "express";
import { GmailController } from "./gmail.controller";
import { authenticate } from "@common/middleware/auth";

const router = Router();

/**
 * @route   POST /api/gmail/auth
 * @desc    Authorize Gmail access
 * @access  Protected
 */
router.post("/auth", authenticate, GmailController.authorize);

/**
 * @route   POST /api/gmail/sync
 * @desc    Sync Gmail emails
 * @access  Protected
 */
router.post("/sync", authenticate, GmailController.syncEmails);

/**
 * @route   GET /api/gmail/status
 * @desc    Get Gmail connection status
 * @access  Protected
 */
router.get("/status", authenticate, GmailController.getStatus);

/**
 * @route   DELETE /api/gmail/revoke
 * @desc    Revoke Gmail access
 * @access  Protected
 */
router.delete("/revoke", authenticate, GmailController.revoke);

export default router;
