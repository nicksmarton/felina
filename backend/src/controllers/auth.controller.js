import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import { prisma } from '../database/client.js';
import { createAppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

async function connectWallet(req, res, next) {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      throw createAppError('Wallet address, signature, and message are required', 400);
    }

    // Verify signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw createAppError('Invalid signature', 401);
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress: walletAddress.toLowerCase(),
        },
      });

      // Create default preferences
      await prisma.userPreferences.create({
        data: { userId: user.id },
      });
    }

    // Create session
    const token = jwt.sign(
      { userId: user.id, walletAddress: user.walletAddress },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          username: user.username,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

async function verifySignature(req, res, next) {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      throw createAppError('Wallet address, signature, and message are required', 400);
    }

    const recoveredAddress = ethers.verifyMessage(message, signature);
    const isValid = recoveredAddress.toLowerCase() === walletAddress.toLowerCase();

    res.json({
      success: true,
      data: { isValid },
    });
  } catch (error) {
    next(error);
  }
}

async function refreshToken(req, res, next) {
  try {
    const { token } = req.body;

    if (!token) {
      throw createAppError('Token is required', 400);
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw createAppError('Invalid or expired token', 401);
    }

    // Create new token
    const newToken = jwt.sign(
      { userId: session.userId, walletAddress: session.user.walletAddress },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.update({
      where: { id: session.id },
      data: { token: newToken, expiresAt },
    });

    res.json({
      success: true,
      data: { token: newToken },
    });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      await prisma.session.deleteMany({
        where: { token },
      });
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
}

export const authController = {
  connectWallet,
  verifySignature,
  refreshToken,
  logout,
};

