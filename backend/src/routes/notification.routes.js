import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

export const notificationRoutes = Router();

notificationRoutes.get('/', authenticate, notificationController.getNotifications);
notificationRoutes.get('/unread', authenticate, notificationController.getUnreadCount);
notificationRoutes.put('/:id/read', authenticate, notificationController.markAsRead);
notificationRoutes.put('/read-all', authenticate, notificationController.markAllAsRead);
notificationRoutes.delete('/:id', authenticate, notificationController.deleteNotification);

