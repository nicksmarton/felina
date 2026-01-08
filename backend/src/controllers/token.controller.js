import { ethers } from 'ethers';
import { prisma } from '../database/client.js';
import { cache } from '../utils/redis.js';
import { getContract } from '../services/blockchain.service.js';

async function getTokenInfo(req, res, next) {
  try {
    const cacheKey = 'token:info';
    const cached = await cache.get(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached),
      });
    }

    const contract = getContract();
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
      contract.totalSupply(),
    ]);

    const info = {
      name,
      symbol,
      decimals: Number(decimals),
      totalSupply: ethers.formatEther(totalSupply),
      contractAddress: process.env.CONTRACT_ADDRESS,
    };

    await cache.set(cacheKey, JSON.stringify(info), 300); // 5 min cache

    res.json({
      success: true,
      data: info,
    });
  } catch (error) {
    next(error);
  }
}

async function getTokenMetrics(req, res, next) {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const metrics = await prisma.tokenMetrics.findMany({
      where: {
        timestamp: {
          gte: since,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
}

async function getTokenSupply(req, res, next) {
  try {
    const cacheKey = 'token:supply';
    const cached = await cache.get(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached),
      });
    }

    const contract = getContract();
    const [totalSupply, contractBalance] = await Promise.all([
      contract.totalSupply(),
      contract.balanceOf(process.env.CONTRACT_ADDRESS),
    ]);

    const supply = {
      totalSupply: ethers.formatEther(totalSupply),
      contractBalance: ethers.formatEther(contractBalance),
      circulatingSupply: ethers.formatEther(totalSupply - contractBalance),
    };

    await cache.set(cacheKey, JSON.stringify(supply), 60); // 1 min cache

    res.json({
      success: true,
      data: supply,
    });
  } catch (error) {
    next(error);
  }
}

async function getExchangeRate(req, res, next) {
  try {
    const cacheKey = 'token:rate';
    const cached = await cache.get(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached),
      });
    }

    const contract = getContract();
    const tokensPerEth = await contract.tokensPerEth();

    const rate = {
      tokensPerEth: ethers.formatEther(tokensPerEth),
      ethPerToken: (1 / parseFloat(ethers.formatEther(tokensPerEth))).toString(),
    };

    await cache.set(cacheKey, JSON.stringify(rate), 30); // 30 sec cache

    res.json({
      success: true,
      data: rate,
    });
  } catch (error) {
    next(error);
  }
}

async function getTokenPrice(req, res, next) {
  try {
    const contract = getContract();
    const tokensPerEth = await contract.tokensPerEth();
    const rate = parseFloat(ethers.formatEther(tokensPerEth));

    // This is a simplified price - in production, you'd fetch ETH/USD price
    const price = {
      priceInEth: (1 / rate).toString(),
      tokensPerEth: rate.toString(),
      // priceInUsd: (ethPrice * (1 / rate)).toString(), // Would need ETH/USD price
    };

    res.json({
      success: true,
      data: price,
    });
  } catch (error) {
    next(error);
  }
}

export const tokenController = {
  getTokenInfo,
  getTokenMetrics,
  getTokenSupply,
  getExchangeRate,
  getTokenPrice,
};

