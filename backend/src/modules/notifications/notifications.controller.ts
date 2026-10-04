import { Request, Response, NextFunction } from "express";
import { notificationService } from "./notification.service";
import { sendSuccess } from "../../utils/response";
import { NotFoundError, ForbiddenError } from "../../utils/errors";
import { NotificationSeverity } from "./notification.types";
import { query } from "../../config/database";

export class NotificationsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const isRead = req.query.isRead !== undefined ? req.query.isRead === "true" : undefined;
      const severity = req.query.severity as NotificationSeverity | undefined;
      const notificationType = req.query.notificationType as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const result = await notificationService.getUserNotifications(req.user!.id, {
        page,
        limit,
        isRead,
        severity,
        notificationType,
        startDate,
        endDate
      });

      const isUnpaginated =
        req.query.page === undefined &&
        req.query.limit === undefined &&
        req.query.isRead === undefined &&
        req.query.severity === undefined &&
        req.query.notificationType === undefined &&
        req.query.startDate === undefined &&
        req.query.endDate === undefined;

      if (isUnpaginated) {
        sendSuccess(res, result.notifications, "User notifications retrieved successfully");
      } else {
        sendSuccess(res, result, "User notifications retrieved successfully");
      }
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const unreadCount = await notificationService.getUnreadCount(req.user!.id);
      sendSuccess(res, { unreadCount }, "Unread notification count retrieved");
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // 1. Direct query scoped to user
      const notification = await notificationService.getNotificationById(id, userId, req.user!.isCommonAdmin);

      if (!notification) {
        // IDOR check: does this notification exist for another user?
        const checkForeign = await notificationService.getNotificationById(id, userId, true);
        if (checkForeign && checkForeign.user_id !== userId && !req.user!.isCommonAdmin) {
          // Log security IDOR violation
          await query(`
            INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, ip_address, user_agent, category, severity, status, new_values_json)
            VALUES ($1, $2, 'IDOR_NOTIFICATION_ACCESS', 'notifications', $3, $4, $5, 'SECURITY', 'CRITICAL', 'FAILURE', $6::jsonb)
          `, [
            req.user!.companyId,
            req.user!.id,
            id,
            req.ip,
            req.get("user-agent") || null,
            JSON.stringify({ targetUserId: checkForeign.user_id, path: req.originalUrl })
          ]);
          throw new ForbiddenError("You are not authorized to access this notification");
        }

        throw new NotFoundError(`Notification '${id}' not found`);
      }

      sendSuccess(res, notification, "Notification retrieved successfully");
    } catch (error) {
      next(error);
    }
  }

  async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const updated = await notificationService.markAsRead(id, userId);

      if (!updated) {
        // Check if already read
        const existing = await notificationService.getNotificationById(id, userId, req.user!.isCommonAdmin);
        if (existing && existing.is_read) {
          sendSuccess(res, { id, isRead: true }, "Notification already marked as read");
          return;
        }

        // IDOR check: does this notification exist for another user?
        const checkForeign = await notificationService.getNotificationById(id, userId, true);
        if (checkForeign && checkForeign.user_id !== userId) {
          // Log security violation
          await query(`
            INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, ip_address, user_agent, category, severity, status, new_values_json)
            VALUES ($1, $2, 'IDOR_NOTIFICATION_MUTATION', 'notifications', $3, $4, $5, 'SECURITY', 'CRITICAL', 'FAILURE', $6::jsonb)
          `, [
            req.user!.companyId,
            req.user!.id,
            id,
            req.ip,
            req.get("user-agent") || null,
            JSON.stringify({ targetUserId: checkForeign.user_id, path: req.originalUrl })
          ]);
          throw new ForbiddenError("You are not authorized to modify another user's notifications");
        }

        throw new NotFoundError(`Notification '${id}' not found`);
      }

      sendSuccess(res, { id, isRead: true }, "Notification marked as read");
    } catch (error) {
      next(error);
    }
  }

  async markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const markedCount = await notificationService.markAllAsRead(req.user!.id);
      sendSuccess(res, { markedCount }, "All unread notifications marked as read");
    } catch (error) {
      next(error);
    }
  }

  async getPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const prefs = await notificationService.getPreferences(req.user!.id);
      sendSuccess(res, prefs, "User notification preferences retrieved");
    } catch (error) {
      next(error);
    }
  }

  async updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const prefs = await notificationService.updatePreferences(
        req.user!.id,
        req.user!.companyId,
        req.body
      );
      sendSuccess(res, prefs, "Notification preferences updated successfully");
    } catch (error) {
      next(error);
    }
  }
}

export const notificationsController = new NotificationsController();
