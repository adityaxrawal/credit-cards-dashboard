import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import axios from "axios";

const router = Router();
const GMAIL_SERVICE_URL =
  process.env.GMAIL_SERVICE_URL || "http://localhost:3004";

// All routes require authentication
router.use(authenticate);

/**
 * GET /gmail/auth-url
 * Get Gmail OAuth authorization URL
 */
router.get("/auth-url", async (req: AuthRequest, res: Response) => {
  try {
    const response = await axios.get(`${GMAIL_SERVICE_URL}/auth-url`);
    res.json(response.data);
  } catch (error) {
    console.error("Error generating Gmail auth URL:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate auth URL",
    });
  }
});

/**
 * POST /gmail/connect
 * Connect Gmail for user after OAuth
 */
router.post("/connect", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { authorizationCode } = req.body;

    if (!authorizationCode) {
      return res.status(400).json({
        success: false,
        error: "Authorization code is required",
      });
    }

    const response = await axios.post(`${GMAIL_SERVICE_URL}/connect`, {
      userId,
      authorizationCode,
    });

    res.json(response.data);
  } catch (error) {
    console.error("Error connecting Gmail:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect Gmail",
    });
  }
});

/**
 * POST /gmail/disconnect
 * Disconnect Gmail for user
 */
router.post("/disconnect", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const response = await axios.post(`${GMAIL_SERVICE_URL}/disconnect`, {
      userId,
    });

    res.json(response.data);
  } catch (error) {
    console.error("Error disconnecting Gmail:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to disconnect Gmail",
    });
  }
});

/**
 * GET /gmail/status
 * Get Gmail connection status
 */
router.get("/status", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const response = await axios.get(`${GMAIL_SERVICE_URL}/status/${userId}`);

    res.json(response.data);
  } catch (error) {
    console.error("Error getting Gmail status:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get Gmail status",
    });
  }
});

/**
 * POST /gmail/renew-watch
 * Manually renew Gmail watch
 */
router.post("/renew-watch", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const response = await axios.post(`${GMAIL_SERVICE_URL}/renew-watch`, {
      userId,
    });

    res.json(response.data);
  } catch (error) {
    console.error("Error renewing Gmail watch:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to renew Gmail watch",
    });
  }
});

/**
 * GET /gmail/messages
 * List Gmail messages with filters
 */
router.get("/messages", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { query, maxResults, pageToken, after, before } = req.query;

    const response = await axios.get(
      `${GMAIL_SERVICE_URL}/messages/${userId}`,
      {
        params: { query, maxResults, pageToken, after, before },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error listing Gmail messages:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to list Gmail messages",
    });
  }
});

/**
 * GET /gmail/messages/:messageId
 * Get full message details
 */
router.get("/messages/:messageId", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { messageId } = req.params;

    const response = await axios.get(
      `${GMAIL_SERVICE_URL}/messages/${userId}/${messageId}`
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error getting Gmail message:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get Gmail message",
    });
  }
});

export default router;
