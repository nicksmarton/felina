import { Router } from 'express';
import { leaderboardController } from '../controllers/leaderboard.controller.js';
import { optionalAuth } from '../middleware/auth.js';

export const leaderboardRoutes = Router();

leaderboardRoutes.get('/:period', optionalAuth, leaderboardController.getLeaderboard);
leaderboardRoutes.get('/user/:walletAddress', optionalAuth, leaderboardController.getUserRank);

