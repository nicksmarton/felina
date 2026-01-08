import { Router } from 'express';
import { adminController } from '../controllers/admin.controller.js';
import { requireAdmin } from '../middleware/auth.js';

export const adminRoutes = Router();

// All admin routes require admin API key
adminRoutes.use(requireAdmin);

adminRoutes.get('/dashboard', adminController.getDashboard);
adminRoutes.get('/users', adminController.getUsers);
adminRoutes.get('/transactions', adminController.getTransactions);
adminRoutes.post('/rate/update', adminController.updateExchangeRate);
adminRoutes.get('/metrics', adminController.getMetrics);
adminRoutes.get('/logs', adminController.getLogs);
adminRoutes.post('/notifications/broadcast', adminController.broadcastNotification);

