import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { logger } from "../utils/logger";
import { historicalScanner } from "../scanner/historical-scanner";

/**
 * WebSocket manager for real-time updates
 */
export class WebSocketManager {
  private io: SocketIOServer | null = null;
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
      },
    });

    this.io.on("connection", (socket) => {
      logger.info({ socketId: socket.id }, "WebSocket client connected");

      // Subscribe to scan job updates
      socket.on("subscribe:scan", (jobId: string) => {
        this.subscribeToScanUpdates(socket.id, jobId);
      });

      // Unsubscribe from scan job updates
      socket.on("unsubscribe:scan", (jobId: string) => {
        this.unsubscribeFromScanUpdates(socket.id, jobId);
      });

      // Handle disconnect
      socket.on("disconnect", () => {
        logger.info({ socketId: socket.id }, "WebSocket client disconnected");
        this.cleanupSocket(socket.id);
      });
    });

    logger.info("WebSocket server initialized");
  }

  /**
   * Subscribe to scan job updates
   */
  private subscribeToScanUpdates(socketId: string, jobId: string) {
    const intervalKey = `${socketId}:${jobId}`;

    // Clear existing interval if any
    if (this.updateIntervals.has(intervalKey)) {
      clearInterval(this.updateIntervals.get(intervalKey)!);
    }

    // Send updates every 2 seconds
    const interval = setInterval(async () => {
      try {
        const progress = await historicalScanner.getProgress(jobId);
        if (progress) {
          this.io?.to(socketId).emit("scan:progress", progress);

          // Stop sending updates if scan is complete or failed
          if (
            progress.status === "completed" ||
            progress.status === "failed" ||
            progress.status === "cancelled"
          ) {
            this.unsubscribeFromScanUpdates(socketId, jobId);
          }
        }
      } catch (error) {
        logger.error({ error, socketId, jobId }, "Failed to send scan progress");
      }
    }, 2000);

    this.updateIntervals.set(intervalKey, interval);
    logger.info({ socketId, jobId }, "Subscribed to scan updates");
  }

  /**
   * Unsubscribe from scan job updates
   */
  private unsubscribeFromScanUpdates(socketId: string, jobId: string) {
    const intervalKey = `${socketId}:${jobId}`;
    const interval = this.updateIntervals.get(intervalKey);

    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(intervalKey);
      logger.info({ socketId, jobId }, "Unsubscribed from scan updates");
    }
  }

  /**
   * Cleanup socket intervals
   */
  private cleanupSocket(socketId: string) {
    const keysToDelete: string[] = [];

    this.updateIntervals.forEach((_, key) => {
      if (key.startsWith(`${socketId}:`)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => {
      const interval = this.updateIntervals.get(key);
      if (interval) {
        clearInterval(interval);
        this.updateIntervals.delete(key);
      }
    });
  }

  /**
   * Broadcast notification to all clients
   */
  broadcastNotification(notification: {
    type: "success" | "error" | "info" | "warning";
    title: string;
    message: string;
    userId?: string;
  }) {
    if (this.io) {
      this.io.emit("notification", notification);
      logger.info({ notification }, "Broadcasted notification");
    }
  }

  /**
   * Send notification to specific user
   */
  sendUserNotification(
    userId: string,
    notification: {
      type: "success" | "error" | "info" | "warning";
      title: string;
      message: string;
    }
  ) {
    if (this.io) {
      this.io.emit(`notification:${userId}`, notification);
      logger.info({ userId, notification }, "Sent user notification");
    }
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown() {
    // Clear all intervals
    this.updateIntervals.forEach((interval) => clearInterval(interval));
    this.updateIntervals.clear();

    // Close socket server
    if (this.io) {
      this.io.close();
      logger.info("WebSocket server shut down");
    }
  }
}

// Export singleton
export const webSocketManager = new WebSocketManager();
