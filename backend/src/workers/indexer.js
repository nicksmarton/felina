import { ethers } from 'ethers';
import { prisma } from '../database/client.js';
import { logger } from '../utils/logger.js';
import { cache } from '../utils/redis.js';

// Contract ABI for events we want to listen to
const MEMECOIN_ABI = [
  'event TokensPurchased(address indexed buyer, uint256 ethAmount, uint256 tokenAmount)',
  'event TokensPerEthUpdated(uint256 newRate)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xA451b908c7AD183aBD55F8AD48C055Da8cb4264d';
const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://sepolia.drpc.org';
const START_BLOCK = parseInt(process.env.START_BLOCK || '0', 10);

let provider = null;
let contract = null;
let isRunning = false;
let lastProcessedBlock = START_BLOCK;

function getProvider() {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(RPC_URL);
  }
  return provider;
}

function getContract() {
  if (!contract) {
    const prov = getProvider();
    contract = new ethers.Contract(CONTRACT_ADDRESS, MEMECOIN_ABI, prov);
  }
  return contract;
}

async function start() {
  if (isRunning) {
    logger.warn('Indexer is already running');
    return;
  }

  isRunning = true;
  logger.info('Starting blockchain indexer...');

  // Load last processed block from cache
  const lastBlock = await cache.get('indexer:lastBlock');
  if (lastBlock) {
    lastProcessedBlock = parseInt(lastBlock, 10);
  }

  // Start indexing
  indexLoop();
}

async function indexLoop() {
  while (isRunning) {
    try {
      const prov = getProvider();
      const currentBlock = await prov.getBlockNumber();
      
      if (currentBlock > lastProcessedBlock) {
        await processBlocks(lastProcessedBlock + 1, currentBlock);
        lastProcessedBlock = currentBlock;
        await cache.set('indexer:lastBlock', currentBlock.toString());
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds
    } catch (error) {
      logger.error('Error in index loop:', error);
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s on error
    }
  }
}

async function processBlocks(fromBlock, toBlock) {
  logger.info(`Processing blocks ${fromBlock} to ${toBlock}`);

  try {
    const cont = getContract();
    // Get all TokensPurchased events
    const swapFilter = cont.filters.TokensPurchased();
    const swapEvents = await cont.queryFilter(swapFilter, fromBlock, toBlock);

    // Get all RateUpdate events
    const rateFilter = cont.filters.TokensPerEthUpdated();
    const rateEvents = await cont.queryFilter(rateFilter, fromBlock, toBlock);

    // Process swap events
    for (const event of swapEvents) {
      await processSwapEvent(event);
    }

    // Process rate update events
    for (const event of rateEvents) {
      await processRateUpdateEvent(event);
    }

    logger.info(`Processed ${swapEvents.length} swap events and ${rateEvents.length} rate updates`);
  } catch (error) {
    logger.error('Error processing blocks:', error);
    throw error;
  }
}

async function processSwapEvent(event) {
  try {
    const cont = getContract();
    const parsed = cont.interface.parseLog({
      topics: event.topics,
      data: event.data,
    });

    if (!parsed) return;

    const buyer = parsed.args.buyer;
    const ethAmount = parsed.args.ethAmount.toString();
    const tokenAmount = parsed.args.tokenAmount.toString();

    const block = await event.getBlock();
    const tx = await event.getTransactionReceipt();

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress: buyer.toLowerCase() },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { walletAddress: buyer.toLowerCase() },
      });
    }

    // Create or update transaction
    const transaction = await prisma.transaction.upsert({
      where: { txHash: tx.hash },
      create: {
        txHash: tx.hash,
        userId: user.id,
        fromAddress: buyer.toLowerCase(),
        toAddress: CONTRACT_ADDRESS.toLowerCase(),
        tokenAddress: CONTRACT_ADDRESS.toLowerCase(),
        amount: ethAmount,
        amountInEth: ethAmount,
        tokenAmount: tokenAmount,
        type: 'SWAP_ETH_TO_TOKEN',
        status: tx.status === 1 ? 'CONFIRMED' : 'FAILED',
        blockNumber: BigInt(block.number),
        blockHash: block.hash || undefined,
        gasUsed: tx.gasUsed ? BigInt(tx.gasUsed.toString()) : undefined,
        gasPrice: tx.gasPrice ? BigInt(tx.gasPrice.toString()) : undefined,
        confirmations: 0,
      },
      update: {
        status: tx.status === 1 ? 'CONFIRMED' : 'FAILED',
        blockNumber: BigInt(block.number),
        blockHash: block.hash || undefined,
        gasUsed: tx.gasUsed ? BigInt(tx.gasUsed.toString()) : undefined,
        gasPrice: tx.gasPrice ? BigInt(tx.gasPrice.toString()) : undefined,
      },
    });

    // Create swap event record
    await prisma.swapEvent.upsert({
      where: {
        txHash_logIndex: {
          txHash: tx.hash,
          logIndex: event.index,
        },
      },
      create: {
        txHash: tx.hash,
        blockNumber: BigInt(block.number),
        blockHash: block.hash || '',
        buyer: buyer.toLowerCase(),
        ethAmount: ethAmount,
        tokenAmount: tokenAmount,
        tokensPerEth: (BigInt(tokenAmount) / BigInt(ethAmount)).toString(),
        logIndex: event.index,
      },
      update: {},
    });

    // Update metrics
    await updateMetrics(ethAmount, tokenAmount);

    // Invalidate cache
    await cache.del('tx:stats:summary');
    await cache.del(`tx:${tx.hash}`);

    logger.info(`Processed swap event: ${tx.hash}`);
  } catch (error) {
    logger.error('Error processing swap event:', error);
  }
}

async function processRateUpdateEvent(event) {
  try {
    const cont = getContract();
    const parsed = cont.interface.parseLog({
      topics: event.topics,
      data: event.data,
    });

    if (!parsed) return;

    const newRate = parsed.args.newRate.toString();
    const block = await event.getBlock();
    const tx = await event.getTransactionReceipt();

    // Get previous rate
    const prov = getProvider();
    const contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      ['function tokensPerEth() view returns (uint256)'],
      prov
    );
    const oldRate = await contract.tokensPerEth();

    // Create rate update record
    await prisma.rateUpdate.create({
      data: {
        oldRate: oldRate.toString(),
        newRate: newRate,
        updatedBy: tx.from.toLowerCase(),
        blockNumber: BigInt(block.number),
        txHash: tx.hash,
      },
    });

    // Invalidate cache
    await cache.del('token:metrics');
    await cache.del('token:rate');

    logger.info(`Processed rate update: ${oldRate.toString()} -> ${newRate}`);
  } catch (error) {
    logger.error('Error processing rate update event:', error);
  }
}

async function updateMetrics(ethAmount, tokenAmount) {
  // This will be called periodically by analytics worker
  // Just invalidate cache here
  await cache.del('token:metrics');
}

async function stop() {
  isRunning = false;
  logger.info('Stopping blockchain indexer...');
}

// Start indexer if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start();

  process.on('SIGTERM', async () => {
    await stop();
    process.exit(0);
  });
}

export { start, stop, processSwapEvent, processRateUpdateEvent };

