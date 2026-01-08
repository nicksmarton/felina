import { prisma } from '../database/client.js';
import { createAppError } from '../middleware/errorHandler.js';
import { cache } from '../utils/redis.js';

async function getLeaderboard(req, res, next) {
  try {
    const { period } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    if (!['DAILY', 'WEEKLY', 'MONTHLY', 'ALL_TIME'].includes(period)) {
      throw createAppError('Invalid period. Must be DAILY, WEEKLY, MONTHLY, or ALL_TIME', 400);
    }

    const cacheKey = `leaderboard:${period}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached).slice(0, limit),
      });
    }

    // Get the most recent leaderboard for this period
    const now = new Date();
    let periodStart;

    switch (period) {
      case 'DAILY':
        periodStart = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'WEEKLY':
        const dayOfWeek = now.getDay();
        periodStart = new Date(now.setDate(now.getDate() - dayOfWeek));
        periodStart.setHours(0, 0, 0, 0);
        break;
      case 'MONTHLY':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'ALL_TIME':
        periodStart = new Date(0);
        break;
    }

    const leaderboard = await prisma.leaderboard.findMany({
      where: {
        period: period,
        periodStart: {
          gte: periodStart,
        },
      },
      orderBy: { rank: 'asc' },
      take: limit,
    });

    await cache.set(cacheKey, JSON.stringify(leaderboard), 300); // 5 min cache

    res.json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    next(error);
  }
}

async function getUserRank(req, res, next) {
  try {
    const { walletAddress } = req.params;
    const { period } = req.query;

    if (!period || !['DAILY', 'WEEKLY', 'MONTHLY', 'ALL_TIME'].includes(period)) {
      throw createAppError('Period query parameter is required (DAILY, WEEKLY, MONTHLY, ALL_TIME)', 400);
    }

    const now = new Date();
    let periodStart;

    switch (period) {
      case 'DAILY':
        periodStart = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'WEEKLY':
        const dayOfWeek = now.getDay();
        periodStart = new Date(now.setDate(now.getDate() - dayOfWeek));
        periodStart.setHours(0, 0, 0, 0);
        break;
      case 'MONTHLY':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'ALL_TIME':
        periodStart = new Date(0);
        break;
    }

    const entry = await prisma.leaderboard.findFirst({
      where: {
        walletAddress: walletAddress.toLowerCase(),
        period: period,
        periodStart: {
          gte: periodStart,
        },
      },
      orderBy: { periodStart: 'desc' },
    });

    if (!entry) {
      return res.json({
        success: true,
        data: {
          walletAddress,
          rank: null,
          message: 'User not found in leaderboard for this period',
        },
      });
    }

    res.json({
      success: true,
      data: entry,
    });
  } catch (error) {
    next(error);
  }
}

export const leaderboardController = {
  getLeaderboard,
  getUserRank,
};

