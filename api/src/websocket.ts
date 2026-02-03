// WebSocket handler for real-time signal feed

import { WebSocketServer, WebSocket } from 'ws';
import type { TradingSignal } from '../../research-engine/src/signals/types.js';

interface WSClient {
  ws: WebSocket;
  subscriptions: Set<string>;
  connectedAt: Date;
}

export class SignalFeed {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WSClient> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize WebSocket server
   */
  init(port: number = 3001): void {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws, req) => {
      const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      
      console.log(`[WS] Client connected: ${clientId}`);

      this.clients.set(clientId, {
        ws,
        subscriptions: new Set(['signals']), // Default subscription
        connectedAt: new Date(),
      });

      // Send welcome message
      this.send(clientId, {
        type: 'connected',
        clientId,
        message: 'Connected to MORPHEUS Signal Feed',
        timestamp: new Date().toISOString(),
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(clientId, message);
        } catch (error) {
          this.send(clientId, { type: 'error', message: 'Invalid JSON' });
        }
      });

      ws.on('close', () => {
        console.log(`[WS] Client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error(`[WS] Client error: ${clientId}`, error);
        this.clients.delete(clientId);
      });
    });

    // Ping clients every 30 seconds to keep connections alive
    this.pingInterval = setInterval(() => {
      this.pingClients();
    }, 30000);

    console.log(`[WS] Signal feed running on port ${port}`);
  }

  /**
   * Handle incoming messages from clients
   */
  private handleMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'subscribe':
        if (message.channel) {
          client.subscriptions.add(message.channel);
          this.send(clientId, {
            type: 'subscribed',
            channel: message.channel,
          });
        }
        break;

      case 'unsubscribe':
        if (message.channel) {
          client.subscriptions.delete(message.channel);
          this.send(clientId, {
            type: 'unsubscribed',
            channel: message.channel,
          });
        }
        break;

      case 'ping':
        this.send(clientId, { type: 'pong', timestamp: Date.now() });
        break;

      default:
        this.send(clientId, { type: 'error', message: 'Unknown message type' });
    }
  }

  /**
   * Send message to a specific client
   */
  private send(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      client.ws.send(JSON.stringify(data));
    } catch (error) {
      console.error(`[WS] Failed to send to ${clientId}:`, error);
    }
  }

  /**
   * Broadcast a signal to all subscribed clients
   */
  broadcastSignal(signal: TradingSignal): void {
    const message = {
      type: 'signal',
      data: signal,
      timestamp: new Date().toISOString(),
    };

    for (const [clientId, client] of this.clients) {
      if (client.subscriptions.has('signals') && client.ws.readyState === WebSocket.OPEN) {
        this.send(clientId, message);
      }
    }
  }

  /**
   * Broadcast to a specific channel
   */
  broadcast(channel: string, data: any): void {
    const message = {
      type: channel,
      data,
      timestamp: new Date().toISOString(),
    };

    for (const [clientId, client] of this.clients) {
      if (client.subscriptions.has(channel) && client.ws.readyState === WebSocket.OPEN) {
        this.send(clientId, message);
      }
    }
  }

  /**
   * Ping all clients to keep connections alive
   */
  private pingClients(): void {
    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.ping();
        } catch (error) {
          console.error(`[WS] Ping failed for ${clientId}`);
          this.clients.delete(clientId);
        }
      }
    }
  }

  /**
   * Get connection stats
   */
  getStats(): { clients: number; channels: Record<string, number> } {
    const channels: Record<string, number> = {};
    
    for (const client of this.clients.values()) {
      for (const channel of client.subscriptions) {
        channels[channel] = (channels[channel] || 0) + 1;
      }
    }

    return {
      clients: this.clients.size,
      channels,
    };
  }

  /**
   * Shutdown the WebSocket server
   */
  close(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    for (const client of this.clients.values()) {
      client.ws.close(1001, 'Server shutting down');
    }

    this.clients.clear();

    if (this.wss) {
      this.wss.close();
    }

    console.log('[WS] Signal feed closed');
  }
}

// Export singleton
export const signalFeed = new SignalFeed();
