import jwt from 'jsonwebtoken';
import { createAppError } from './errorHandler.js';
import { prisma } from '../database/client.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw createAppError('Authentication required', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify session exists and is valid
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw createAppError('Session expired', 401);
    }

    req.userId = decoded.userId;
    req.walletAddress = decoded.walletAddress;

    next();
  } catch (error) {
    if (error.statusCode) {
      next(error);
    } else {
      next(createAppError('Invalid token', 401));
    }
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const session = await prisma.session.findUnique({
        where: { token },
      });

      if (session && session.expiresAt >= new Date()) {
        req.userId = decoded.userId;
        req.walletAddress = decoded.walletAddress;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

export const requireAdmin = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];

  if (adminKey !== process.env.ADMIN_API_KEY) {
    return next(createAppError('Admin access required', 403));
  }

  next();
};

