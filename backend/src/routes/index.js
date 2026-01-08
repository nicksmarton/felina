import { Router } from 'express';
import { authRoutes } from './auth.routes.js';
import { userRoutes } from './user.routes.js';
import { transactionRoutes } from './transaction.routes.js';
import { analyticsRoutes } from './analytics.routes.js';
import { adminRoutes } from './admin.routes.js';
import { tokenRoutes } from './token.routes.js';
import { leaderboardRoutes } from './leaderboard.routes.js';
import { notificationRoutes } from './notification.routes.js';

export const setupRoutes = () => {
  const router = Router();

  router.use('/auth', authRoutes);
  router.use('/users', userRoutes);
  router.use('/transactions', transactionRoutes);
  router.use('/analytics', analyticsRoutes);
  router.use('/admin', adminRoutes);
  router.use('/token', tokenRoutes);
  router.use('/leaderboard', leaderboardRoutes);
  router.use('/notifications', notificationRoutes);

  return router;
};

