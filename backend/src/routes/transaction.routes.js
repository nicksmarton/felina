import { Router } from 'express';
import { transactionController } from '../controllers/transaction.controller.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { swapRateLimiter } from '../middleware/rateLimiter.js';

export const transactionRoutes = Router();

transactionRoutes.get('/', optionalAuth, transactionController.getTransactions);
transactionRoutes.get('/:txHash', transactionController.getTransactionByHash);
transactionRoutes.get('/user/:walletAddress', transactionController.getUserTransactions);
transactionRoutes.post('/track', swapRateLimiter, authenticate, transactionController.trackTransaction);
transactionRoutes.get('/stats/summary', transactionController.getTransactionStats);

