import { prisma } from '../database/client.js';
import { createAppError } from '../middleware/errorHandler.js';
import { cache } from '../utils/redis.js';

async function getMe(req, res, next) {
  try {
    if (!req.userId) {
      throw createAppError('Unauthorized', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        preferences: true,
        _count: {
          select: { transactions: true },
        },
      },
    });

    if (!user) {
      throw createAppError('User not found', 404);
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

async function getUserByAddress(req, res, next) {
  try {
    const { walletAddress } = req.params;

    const cacheKey = `user:${walletAddress.toLowerCase()}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached),
      });
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    if (!user) {
      throw createAppError('User not found', 404);
    }

    await cache.set(cacheKey, JSON.stringify(user), 300); // 5 min cache

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    if (!req.userId) {
      throw createAppError('Unauthorized', 401);
    }

    const { username, email } = req.body;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(username && { username }),
        ...(email && { email }),
      },
    });

    // Clear cache
    await cache.del(`user:${user.walletAddress}`);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

async function getPreferences(req, res, next) {
  try {
    if (!req.userId) {
      throw createAppError('Unauthorized', 401);
    }

    let preferences = await prisma.userPreferences.findUnique({
      where: { userId: req.userId },
    });

    if (!preferences) {
      preferences = await prisma.userPreferences.create({
        data: { userId: req.userId },
      });
    }

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    next(error);
  }
}

async function updatePreferences(req, res, next) {
  try {
    if (!req.userId) {
      throw createAppError('Unauthorized', 401);
    }

    const { theme, notifications, language } = req.body;

    const preferences = await prisma.userPreferences.upsert({
      where: { userId: req.userId },
      update: {
        ...(theme && { theme }),
        ...(notifications !== undefined && { notifications }),
        ...(language && { language }),
      },
      create: {
        userId: req.userId,
        theme: theme || 'light',
        notifications: notifications !== undefined ? notifications : true,
        language: language || 'en',
      },
    });

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    next(error);
  }
}

async function getUserStats(req, res, next) {
  try {
    if (!req.userId || !req.walletAddress) {
      throw createAppError('Unauthorized', 401);
    }

    const cacheKey = `user:stats:${req.walletAddress}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached),
      });
    }

    const [transactions, totalVolume] = await Promise.all([
      prisma.transaction.count({
        where: {
          userId: req.userId,
          status: 'CONFIRMED',
        },
      }),
      prisma.transaction.aggregate({
        where: {
          userId: req.userId,
          status: 'CONFIRMED',
          type: 'SWAP_ETH_TO_TOKEN',
        },
        _sum: {
          amountInEth: null,
        },
      }),
    ]);

    const stats = {
      totalTransactions: transactions,
      totalVolumeEth: totalVolume._sum?.amountInEth || '0',
    };

    await cache.set(cacheKey, JSON.stringify(stats), 60); // 1 min cache

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
}

export const userController = {
  getMe,
  getUserByAddress,
  updateProfile,
  getPreferences,
  updatePreferences,
  getUserStats,
};

