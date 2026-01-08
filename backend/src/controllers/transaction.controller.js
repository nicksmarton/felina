import { prisma } from '../database/client.js';
import { createAppError } from '../middleware/errorHandler.js';
import { cache } from '../utils/redis.js';

async function getTransactions(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const where = {};

    if (req.query.status) {
      where.status = req.query.status;
    }

    if (req.query.type) {
      where.type = req.query.type;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              walletAddress: true,
              username: true,
            },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getTransactionByHash(req, res, next) {
  try {
    const { txHash } = req.params;

    const cacheKey = `tx:${txHash}`;
    const cached = await cache.get(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached),
      });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { txHash },
      include: {
        user: {
          select: {
            walletAddress: true,
            username: true,
          },
        },
      },
    });

    if (!transaction) {
      throw createAppError('Transaction not found', 404);
    }

    await cache.set(cacheKey, JSON.stringify(transaction), 300);

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
}

async function getUserTransactions(req, res, next) {
  try {
    const { walletAddress } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!user) {
      throw createAppError('User not found', 404);
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: user.id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.count({ where: { userId: user.id } }),
    ]);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

async function trackTransaction(req, res, next) {
  try {
    if (!req.userId) {
      throw createAppError('Unauthorized', 401);
    }

    const { txHash } = req.body;

    if (!txHash) {
      throw createAppError('Transaction hash is required', 400);
    }

    // Check if transaction already exists
    const existing = await prisma.transaction.findUnique({
      where: { txHash },
    });

    if (existing) {
      // Update user association if needed
      if (!existing.userId && req.userId) {
        await prisma.transaction.update({
          where: { txHash },
          data: { userId: req.userId },
        });
      }

      return res.json({
        success: true,
        data: existing,
        message: 'Transaction already tracked',
      });
    }

    // Transaction will be created by the indexer when it processes the blockchain
    res.json({
      success: true,
      message: 'Transaction tracking initiated',
    });
  } catch (error) {
    next(error);
  }
}

async function getTransactionStats(req, res, next) {
  try {
    const cacheKey = 'tx:stats:summary';
    const cached = await cache.get(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached),
      });
    }

    const [total, confirmed, failed, totalVolume] = await Promise.all([
      prisma.transaction.count(),
      prisma.transaction.count({ where: { status: 'CONFIRMED' } }),
      prisma.transaction.count({ where: { status: 'FAILED' } }),
      prisma.transaction.aggregate({
        where: {
          status: 'CONFIRMED',
          type: 'SWAP_ETH_TO_TOKEN',
        },
        _sum: {
          amountInEth: null,
        },
      }),
    ]);

    const stats = {
      total,
      confirmed,
      failed,
      pending: total - confirmed - failed,
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

export const transactionController = {
  getTransactions,
  getTransactionByHash,
  getUserTransactions,
  trackTransaction,
  getTransactionStats,
};

