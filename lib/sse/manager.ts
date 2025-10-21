export interface SSEConnection {
  userId: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
  lastPing: number;
}

export class SSEManager {
  private connections = new Map<string, SSEConnection>();
  private keepAliveIntervals = new Map<string, NodeJS.Timeout>();

  addConnection(userId: string, controller: ReadableStreamDefaultController<Uint8Array>): void {
    // Remove existing connection if any
    this.removeConnection(userId);

    const connection: SSEConnection = {
      userId,
      controller,
      lastPing: Date.now()
    };

    this.connections.set(userId, connection);

    // Send initial connected event
    this.sendToUser(userId, 'connected', { message: 'SSE connection established' });

    // Start keep-alive for this connection
    this.startKeepAlive(userId);
  }

  removeConnection(userId: string): void {
    const connection = this.connections.get(userId);
    if (connection) {
      try {
        connection.controller.close();
      } catch (error) {
        // Connection might already be closed
        console.log('Connection already closed for user:', userId);
      }
    }

    this.connections.delete(userId);

    // Clear keep-alive interval
    const interval = this.keepAliveIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.keepAliveIntervals.delete(userId);
    }
  }

  isUserOnline(userId: string): boolean {
    return this.connections.has(userId);
  }

  async sendToUser(userId: string, event: string, data: Record<string, unknown>): Promise<void> {
    const connection = this.connections.get(userId);
    if (!connection) {
      return;
    }

    try {
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      const encoder = new TextEncoder();
      const encoded = encoder.encode(message);

      connection.controller.enqueue(encoded);
      connection.lastPing = Date.now();
    } catch (error) {
      console.error('Error sending SSE message to user:', userId, error);
      // Remove stale connection
      this.removeConnection(userId);
    }
  }

  private startKeepAlive(userId: string): void {
    const interval = setInterval(() => {
      const connection = this.connections.get(userId);
      if (!connection) {
        clearInterval(interval);
        this.keepAliveIntervals.delete(userId);
        return;
      }

      // Check if connection is stale (>60 seconds inactive)
      const now = Date.now();
      if (now - connection.lastPing > 60000) {
        console.log('Removing stale connection for user:', userId);
        this.removeConnection(userId);
        return;
      }

      // Send ping event
      this.sendToUser(userId, 'ping', { timestamp: now });
    }, 30000); // 30 seconds interval

    this.keepAliveIntervals.set(userId, interval);
  }

  // Broadcast to all connected users
  async broadcast(event: string, data: Record<string, unknown>): Promise<void> {
    const promises = Array.from(this.connections.keys()).map(userId =>
      this.sendToUser(userId, event, data)
    );
    await Promise.all(promises);
  }

  // Get connection count
  getConnectionCount(): number {
    return this.connections.size;
  }

  // Get all connected user IDs
  getConnectedUsers(): string[] {
    return Array.from(this.connections.keys());
  }
}

// Export singleton instance
export const sseManager = new SSEManager();