import { prisma } from '../database/client.js';
import { logger } from '../utils/logger.js';
import { cache } from '../utils/redis.js';
import cron from 'node-cron';

let isRunning = false;

async function start() {
  if (isRunning) {
    logger.warn('Analytics worker is already running');
    return;
  }

  isRunning = true;
  logger.info('Starting analytics worker...');

  // Run immediately
  await calculateMetrics();

  // Schedule to run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await calculateMetrics();
  });

  // Calculate leaderboards every hour
  cron.schedule('0 * * * *', async () => {
    await calculateLeaderboards();
  });
}

async function calculateMetrics() {
  try {
    logger.info('Calculating token metrics...');

    // Get latest contract state
    const latestSwap = await prisma.swapEvent.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!latestSwap) {
      logger.info('No swap events found, skipping metrics calculation');
      return;
    }

    // Calculate aggregate metrics
    const [
      totalSwaps,
      totalVolumeEth,
      totalVolumeTokens,
      uniqueUsers,
    ] = await Promise.all([
      prisma.swapEvent.count(),
      prisma.swapEvent.aggregate({
        _sum: { ethAmount: true },
      }),
      prisma.swapEvent.aggregate({
        _sum: { tokenAmount: true },
      }),
      prisma.swapEvent.groupBy({
        by: ['buyer'],
      }),
    ]);

    const metrics = {
      timestamp: new Date(),
      totalSupply: '1000000000000000000000000000', // 1 billion tokens
      contractBalance: await getContractBalance(),
      totalSwaps: BigInt(totalSwaps),
      totalVolumeEth: totalVolumeEth._sum?.ethAmount || '0',
      totalVolumeTokens: totalVolumeTokens._sum?.tokenAmount || '0',
      uniqueUsers: BigInt(uniqueUsers.length),
      tokensPerEth: latestSwap.tokensPerEth,
      priceInEth: (1 / parseFloat(latestSwap.tokensPerEth) * 1e18).toString(),
    };

    // Save to database
    await prisma.tokenMetrics.create({
      data: metrics,
    });

    // Cache metrics
    await cache.set('token:metrics', JSON.stringify(metrics), 300); // 5 min cache

    logger.info('Token metrics calculated successfully');
  } catch (error) {
    logger.error('Error calculating metrics:', error);
  }
}

async function calculateLeaderboards() {
  try {
    logger.info('Calculating leaderboards...');

    const periods = ['DAILY', 'WEEKLY', 'MONTHLY', 'ALL_TIME'];

    for (const period of periods) {
      await calculateLeaderboardForPeriod(period);
    }

    logger.info('Leaderboards calculated successfully');
  } catch (error) {
    logger.error('Error calculating leaderboards:', error);
  }
}

async function calculateLeaderboardForPeriod(period) {
  const now = new Date();
  let periodStart;
  let periodEnd = now;

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

  // Get swap events for period
  const swaps = await prisma.swapEvent.findMany({
    where: {
      createdAt: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
  });

  // Aggregate by buyer
  const userStats = new Map();

  for (const swap of swaps) {
    const buyer = swap.buyer.toLowerCase();
    const stats = userStats.get(buyer) || {
      totalSwaps: BigInt(0),
      totalVolumeEth: BigInt(0),
      totalVolumeTokens: BigInt(0),
    };

    stats.totalSwaps += BigInt(1);
    stats.totalVolumeEth += BigInt(swap.ethAmount);
    stats.totalVolumeTokens += BigInt(swap.tokenAmount);

    userStats.set(buyer, stats);
  }

  // Sort by volume
  const sorted = Array.from(userStats.entries())
    .sort((a, b) => {
      const aVol = a[1].totalVolumeEth;
      const bVol = b[1].totalVolumeEth;
      return aVol > bVol ? -1 : aVol < bVol ? 1 : 0;
    });

  // Save leaderboard entries
  for (let i = 0; i < sorted.length; i++) {
    const [walletAddress, stats] = sorted[i];

    await prisma.leaderboard.upsert({
      where: {
        period_walletAddress_periodStart: {
          period,
          walletAddress,
          periodStart,
        },
      },
      create: {
        period,
        walletAddress,
        totalSwaps: stats.totalSwaps,
        totalVolumeEth: stats.totalVolumeEth.toString(),
        totalVolumeTokens: stats.totalVolumeTokens.toString(),
        rank: i + 1,
        periodStart,
        periodEnd,
      },
      update: {
        totalSwaps: stats.totalSwaps,
        totalVolumeEth: stats.totalVolumeEth.toString(),
        totalVolumeTokens: stats.totalVolumeTokens.toString(),
        rank: i + 1,
        periodEnd: now,
      },
    });
  }

  // Cache leaderboard
  await cache.set(
    `leaderboard:${period}`,
    JSON.stringify(sorted.slice(0, 100)), // Top 100
    300
  );
}

async function getContractBalance() {
  // This would require connecting to the blockchain
  // For now, return a placeholder
  return '0';
}

async function stop() {
  isRunning = false;
  logger.info('Stopping analytics worker...');
}

// Start worker if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start();

  process.on('SIGTERM', async () => {
    await stop();
    process.exit(0);
  });
}

export { start, stop, calculateMetrics, calculateLeaderboards };

