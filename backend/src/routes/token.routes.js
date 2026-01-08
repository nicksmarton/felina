import { Router } from 'express';
import { tokenController } from '../controllers/token.controller.js';
import { optionalAuth } from '../middleware/auth.js';

export const tokenRoutes = Router();

tokenRoutes.get('/info', tokenController.getTokenInfo);
tokenRoutes.get('/metrics', tokenController.getTokenMetrics);
tokenRoutes.get('/supply', tokenController.getTokenSupply);
tokenRoutes.get('/rate', tokenController.getExchangeRate);
tokenRoutes.get('/price', optionalAuth, tokenController.getTokenPrice);

