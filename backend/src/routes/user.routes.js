import { Router } from 'express';
import { userController } from '../controllers/user.controller.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

export const userRoutes = Router();

userRoutes.get('/me', authenticate, userController.getMe);
userRoutes.get('/:walletAddress', optionalAuth, userController.getUserByAddress);
userRoutes.put('/me', authenticate, userController.updateProfile);
userRoutes.get('/me/preferences', authenticate, userController.getPreferences);
userRoutes.put('/me/preferences', authenticate, userController.updatePreferences);
userRoutes.get('/me/stats', authenticate, userController.getUserStats);

