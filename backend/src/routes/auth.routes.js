import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

export const authRoutes = Router();

authRoutes.post('/wallet/connect', authRateLimiter, authController.connectWallet);
authRoutes.post('/wallet/verify', authRateLimiter, authController.verifySignature);
authRoutes.post('/refresh', authController.refreshToken);
authRoutes.post('/logout', authController.logout);

