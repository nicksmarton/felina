import { logger } from '../utils/logger.js';
import { prisma } from '../database/client.js';
import jwt from 'jsonwebtoken';

export const setupWebSocket = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        // Allow connection without auth for public events
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const session = await prisma.session.findUnique({
        where: { token },
      });

      if (!session || session.expiresAt < new Date()) {
        return next(new Error('Invalid or expired token'));
      }

      socket.data.auth = {
        userId: decoded.userId,
        walletAddress: decoded.walletAddress,
      };

      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    logger.info('WebSocket client connected', {
      socketId: socket.id,
      walletAddress: socket.data.auth?.walletAddress,
    });

    // Join user-specific room
    if (socket.data.auth?.walletAddress) {
      const room = `user:${socket.data.auth.walletAddress.toLowerCase()}`;
      socket.join(room);
      logger.info(`Socket joined room: ${room}`);
    }

    // Join public rooms
    socket.join('public');
    socket.join('transactions');
    socket.join('analytics');

    // Handle transaction tracking subscription
    socket.on('subscribe:transaction', (txHash) => {
      socket.join(`tx:${txHash}`);
      logger.info(`Socket subscribed to transaction: ${txHash}`);
    });

    // Handle user notifications subscription
    socket.on('subscribe:notifications', () => {
      if (socket.data.auth?.walletAddress) {
        const room = `notifications:${socket.data.auth.walletAddress.toLowerCase()}`;
        socket.join(room);
        logger.info(`Socket subscribed to notifications: ${room}`);
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      logger.info('WebSocket client disconnected', {
        socketId: socket.id,
        reason,
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('WebSocket error', { socketId: socket.id, error });
    });
  });

  // Export helper functions for emitting events
  return {
    emitTransactionUpdate: (txHash, data) => {
      io.to(`tx:${txHash}`).emit('transaction:update', data);
      io.to('transactions').emit('transaction:new', data);
    },

    emitUserNotification: (walletAddress, notification) => {
      io.to(`notifications:${walletAddress.toLowerCase()}`).emit('notification:new', notification);
      io.to(`user:${walletAddress.toLowerCase()}`).emit('notification:new', notification);
    },

    emitAnalyticsUpdate: (data) => {
      io.to('analytics').emit('analytics:update', data);
    },

    emitRateUpdate: (data) => {
      io.to('public').emit('rate:update', data);
    },

    emitSystemAnnouncement: (message, data) => {
      io.to('public').emit('system:announcement', { message, data, timestamp: new Date() });
    },
  };
};

