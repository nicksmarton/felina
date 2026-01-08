import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller.js';
import { optionalAuth } from '../middleware/auth.js';

export const analyticsRoutes = Router();

analyticsRoutes.get('/overview', optionalAuth, analyticsController.getOverview);
analyticsRoutes.get('/volume', analyticsController.getVolumeStats);
analyticsRoutes.get('/users', analyticsController.getUserStats);
analyticsRoutes.get('/transactions', analyticsController.getTransactionAnalytics);
analyticsRoutes.get('/price-history', analyticsController.getPriceHistory);
analyticsRoutes.get('/trends', analyticsController.getTrends);
analyticsRoutes.get('/time-series', optionalAuth, analyticsController.getTimeSeriesAnalysis);
analyticsRoutes.get('/retention', optionalAuth, analyticsController.getUserRetention);
analyticsRoutes.get('/trading-patterns', optionalAuth, analyticsController.getTradingPatterns);
analyticsRoutes.get('/market-depth', optionalAuth, analyticsController.getMarketDepth);
analyticsRoutes.get('/growth', optionalAuth, analyticsController.getGrowthMetrics);
analyticsRoutes.get('/user-distribution', optionalAuth, analyticsController.getUserDistribution);
analyticsRoutes.get('/performance', optionalAuth, analyticsController.getPerformanceMetrics);
analyticsRoutes.get('/comparative', optionalAuth, analyticsController.getComparativeAnalysis);
analyticsRoutes.get('/revenue', optionalAuth, analyticsController.getRevenueAnalytics);
analyticsRoutes.get('/hourly-activity', optionalAuth, analyticsController.getHourlyActivity);

