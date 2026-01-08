/**
 * WebSocket client for real-time updates from the backend
 */

import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

class WebSocketClient {
  private socket: Socket | null = null;
  private token: string | null = null;

  connect(token?: string) {
    if (this.socket?.connected) {
      return;
    }

    this.token = token || localStorage.getItem('auth_token') || undefined;

    this.socket = io(WS_URL, {
      auth: {
        token: this.token,
      },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  subscribeTransaction(txHash: string, callback: (data: any) => void) {
    if (!this.socket) {
      this.connect();
    }

    this.socket?.emit('subscribe:transaction', txHash);
    this.socket?.on('transaction:update', callback);
    this.socket?.on('transaction:new', callback);
  }

  unsubscribeTransaction(txHash: string) {
    this.socket?.off('transaction:update');
    this.socket?.off('transaction:new');
  }

  subscribeNotifications(callback: (notification: any) => void) {
    if (!this.socket) {
      this.connect();
    }

    this.socket?.emit('subscribe:notifications');
    this.socket?.on('notification:new', callback);
  }

  unsubscribeNotifications() {
    this.socket?.off('notification:new');
  }

  onAnalyticsUpdate(callback: (data: any) => void) {
    if (!this.socket) {
      this.connect();
    }

    this.socket?.on('analytics:update', callback);
  }

  onRateUpdate(callback: (data: any) => void) {
    if (!this.socket) {
      this.connect();
    }

    this.socket?.on('rate:update', callback);
  }

  onSystemAnnouncement(callback: (data: { message: string; data?: any; timestamp: Date }) => void) {
    if (!this.socket) {
      this.connect();
    }

    this.socket?.on('system:announcement', callback);
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const wsClient = new WebSocketClient();

