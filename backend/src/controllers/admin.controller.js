import { ethers } from 'ethers';
import { prisma } from '../database/client.js';
import { createAppError } from '../middleware/errorHandler.js';
import { getContract } from '../services/blockchain.service.js';
import { logger } from '../utils/logger.js';

async function getDashboard(req, res, next) {
  try {
    const [
      totalUsers,
      totalTransactions,
      totalVolume,
      recentTransactions,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.transaction.count(),
      prisma.transaction.aggregate({
        where: { status: 'CONFIRMED', type: 'SWAP_ETH_TO_TOKEN' },
        _sum: { amountInEth: null },
      }),
      prisma.transaction.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { walletAddress: true, username: true },
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalTransactions,
        totalVolumeEth: totalVolume._sum?.amountInEth || '0',
        recentTransactions,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getUsers(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { transactions: true },
          },
        },
      }),
      prisma.user.count(),
    ]);

    res.json({
      success: true,
      data: {
        users,
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

async function getTransactions(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { walletAddress: true, username: true },
          },
        },
      }),
      prisma.transaction.count(),
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

async function updateExchangeRate(req, res, next) {
  try {
    const { newRate } = req.body;

    if (!newRate || parseFloat(newRate) <= 0) {
      throw createAppError('Invalid rate', 400);
    }

    const contract = getContract();
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const contractWithSigner = contract.connect(signer);
    const tx = await contractWithSigner.setTokensPerEth(
      ethers.parseEther(newRate)
    );

    await tx.wait();

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: 'system',
        action: 'UPDATE_EXCHANGE_RATE',
        details: {
          oldRate: await contract.tokensPerEth(),
          newRate,
          txHash: tx.hash,
        },
      },
    });

    res.json({
      success: true,
      data: {
        txHash: tx.hash,
        newRate,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getMetrics(req, res, next) {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const metrics = await prisma.tokenMetrics.findMany({
      where: { timestamp: { gte: since } },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
}

async function getLogs(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.adminLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.adminLog.count(),
    ]);

    res.json({
      success: true,
      data: {
        logs,
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

async function broadcastNotification(req, res, next) {
  try {
    const { title, message, type } = req.body;

    if (!title || !message) {
      throw createAppError('Title and message are required', 400);
    }

    // Create notification for all users
    const users = await prisma.user.findMany({
      select: { id: true },
    });

    await prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        type: type || 'SYSTEM_ANNOUNCEMENT',
        title,
        message,
      })),
    });

    res.json({
      success: true,
      message: `Notification broadcasted to ${users.length} users`,
    });
  } catch (error) {
    next(error);
  }
}

export const adminController = {
  getDashboard,
  getUsers,
  getTransactions,
  updateExchangeRate,
  getMetrics,
  getLogs,
  broadcastNotification,
};

