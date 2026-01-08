import { prisma } from '../database/client.js';
import { createAppError } from '../middleware/errorHandler.js';

async function getNotifications(req, res, next) {
  try {
    if (!req.userId && !req.walletAddress) {
      throw createAppError('Unauthorized', 401);
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const unreadOnly = req.query.unreadOnly === 'true';

    const where = {};

    if (req.userId) {
      where.userId = req.userId;
    } else if (req.walletAddress) {
      where.walletAddress = req.walletAddress.toLowerCase();
    }

    if (unreadOnly) {
      where.read = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { ...where, read: false },
      }),
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getUnreadCount(req, res, next) {
  try {
    if (!req.userId && !req.walletAddress) {
      throw createAppError('Unauthorized', 401);
    }

    const where = { read: false };

    if (req.userId) {
      where.userId = req.userId;
    } else if (req.walletAddress) {
      where.walletAddress = req.walletAddress.toLowerCase();
    }

    const count = await prisma.notification.count({ where });

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
}

async function markAsRead(req, res, next) {
  try {
    if (!req.userId && !req.walletAddress) {
      throw createAppError('Unauthorized', 401);
    }

    const { id } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw createAppError('Notification not found', 404);
    }

    // Verify ownership
    if (req.userId && notification.userId !== req.userId) {
      throw createAppError('Unauthorized', 403);
    }

    if (req.walletAddress && notification.walletAddress?.toLowerCase() !== req.walletAddress.toLowerCase()) {
      throw createAppError('Unauthorized', 403);
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

async function markAllAsRead(req, res, next) {
  try {
    if (!req.userId && !req.walletAddress) {
      throw createAppError('Unauthorized', 401);
    }

    const where = { read: false };

    if (req.userId) {
      where.userId = req.userId;
    } else if (req.walletAddress) {
      where.walletAddress = req.walletAddress.toLowerCase();
    }

    const result = await prisma.notification.updateMany({
      where,
      data: { read: true },
    });

    res.json({
      success: true,
      data: { updated: result.count },
    });
  } catch (error) {
    next(error);
  }
}

async function deleteNotification(req, res, next) {
  try {
    if (!req.userId && !req.walletAddress) {
      throw createAppError('Unauthorized', 401);
    }

    const { id } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw createAppError('Notification not found', 404);
    }

    // Verify ownership
    if (req.userId && notification.userId !== req.userId) {
      throw createAppError('Unauthorized', 403);
    }

    if (req.walletAddress && notification.walletAddress?.toLowerCase() !== req.walletAddress.toLowerCase()) {
      throw createAppError('Unauthorized', 403);
    }

    await prisma.notification.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    next(error);
  }
}

export const notificationController = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};

