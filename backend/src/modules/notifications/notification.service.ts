import { PoolClient } from "pg";
import { query } from "../../config/database";
import { logger } from "../../config/logger";
import {
  CreateNotificationInput,
  NotificationItem,
  UserNotificationPreferences,
  UpdatePreferencesInput,
  ListNotificationsOptions,
  getPreferenceKeyForNotification,
  isNonSuppressibleNotification
} from "./notification.types";
import { notificationRepository } from "./notification.repository";

export class NotificationService {
  /**
   * Safe notification creator that respects user category preferences
   * unless the notification is critical/security-related.
   */
  async create(data: CreateNotificationInput, client?: PoolClient): Promise<NotificationItem | null> {
    try {
      const notificationType = data.notificationType || data.type || "IMPORTANT_ADMIN_ACTION";
      // 1. Preference check: Can this notification be suppressed?
      const isCriticalOrMandatory = isNonSuppressibleNotification(notificationType, data.severity);

      if (!isCriticalOrMandatory) {
        const prefKey = getPreferenceKeyForNotification(notificationType);
        if (prefKey) {
          const userPrefs = await notificationRepository.getPreferences(data.userId);
          if (userPrefs && userPrefs[prefKey] === false) {
            logger.debug(`Notification suppressed by user preference: ${notificationType} for user ${data.userId}`);
            return null;
          }
        }
      }

      return await notificationRepository.create(data, client);
    } catch (err) {
      logger.error("Failed to create notification:", err);
      return null;
    }
  }

  /**
   * Broadcasts a notification to all active users with a specified role within a company.
   * Strictly enforces tenant isolation (never broadcasts cross-company).
   */
  async notifyRole(
    companyId: string,
    roleCode: string,
    notification: Omit<CreateNotificationInput, "userId" | "companyId">,
    client?: PoolClient
  ): Promise<number> {
    let createdCount = 0;
    try {
      const sql = `
        SELECT u.id 
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.company_id = $1 AND r.code = $2 AND u.is_active = true
      `;
      const res = client 
        ? await client.query<{ id: string }>(sql, [companyId, roleCode])
        : await query<{ id: string }>(sql, [companyId, roleCode]);

      for (const row of res.rows) {
        const item = await this.create({
          ...notification,
          userId: row.id,
          companyId
        }, client);
        if (item) createdCount++;
      }
    } catch (err) {
      logger.error(`Failed to notify role ${roleCode} in company ${companyId}:`, err);
    }
    return createdCount;
  }

  /**
   * Broadcasts to company administrators (Company Admin + Asset Manager).
   */
  async notifyCompanyAdmins(
    companyId: string,
    notification: Omit<CreateNotificationInput, "userId" | "companyId">,
    client?: PoolClient
  ): Promise<number> {
    let createdCount = 0;
    try {
      const sql = `
        SELECT u.id 
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.company_id = $1 AND r.code IN ('COMPANY_ADMIN', 'ASSET_MANAGER') AND u.is_active = true
      `;
      const res = client 
        ? await client.query<{ id: string }>(sql, [companyId])
        : await query<{ id: string }>(sql, [companyId]);

      for (const row of res.rows) {
        const item = await this.create({
          ...notification,
          userId: row.id,
          companyId
        }, client);
        if (item) createdCount++;
      }
    } catch (err) {
      logger.error(`Failed to notify company admins for ${companyId}:`, err);
    }
    return createdCount;
  }

  /**
   * Broadcasts to overarching Common Administrator(s).
   */
  async notifyCommonAdmin(
    notification: Omit<CreateNotificationInput, "userId" | "companyId">,
    client?: PoolClient
  ): Promise<number> {
    let createdCount = 0;
    try {
      const sql = `
        SELECT u.id 
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.company_id IS NULL AND r.code = 'COMMON_ADMIN' AND u.is_active = true
      `;
      const res = client 
        ? await client.query<{ id: string }>(sql)
        : await query<{ id: string }>(sql);

      for (const row of res.rows) {
        const item = await this.create({
          ...notification,
          userId: row.id,
          companyId: null
        }, client);
        if (item) createdCount++;
      }
    } catch (err) {
      logger.error("Failed to notify Common Admin:", err);
    }
    return createdCount;
  }

  /**
   * Notifies a specific employee if they have an active user account.
   */
  async notifyEmployee(
    employeeId: string,
    notification: Omit<CreateNotificationInput, "userId">,
    client?: PoolClient
  ): Promise<number> {
    let createdCount = 0;
    try {
      const sql = `
        SELECT id, company_id 
        FROM users 
        WHERE employee_id = $1 AND is_active = true
      `;
      const res = client
        ? await client.query<{ id: string; company_id: string }>(sql, [employeeId])
        : await query<{ id: string; company_id: string }>(sql, [employeeId]);

      for (const row of res.rows) {
        const item = await this.create({
          ...notification,
          userId: row.id,
          companyId: notification.companyId !== undefined ? notification.companyId : row.company_id
        }, client);
        if (item) createdCount++;
      }
    } catch (err) {
      logger.error(`Failed to notify employee ${employeeId}:`, err);
    }
    return createdCount;
  }

  /**
   * Retrieves paginated list of notifications for authenticated user.
   */
  async getUserNotifications(userId: string, options: ListNotificationsOptions = {}) {
    return await notificationRepository.listForUser(userId, options);
  }

  /**
   * Returns count of unread notifications for authenticated user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    return await notificationRepository.getUnreadCount(userId);
  }

  /**
   * Marks single notification as read, enforcing strict user ownership.
   */
  async markAsRead(id: string, userId: string): Promise<boolean> {
    return await notificationRepository.markAsRead(id, userId);
  }

  /**
   * Marks all unread notifications for a user as read.
   */
  async markAllAsRead(userId: string): Promise<number> {
    return await notificationRepository.markAllAsRead(userId);
  }

  /**
   * Retrieves notification by ID with IDOR protection.
   */
  async getNotificationById(id: string, userId: string, isCommonAdmin = false): Promise<NotificationItem | null> {
    return await notificationRepository.findById(id, isCommonAdmin ? undefined : userId);
  }

  /**
   * Retrieves notification preferences for a user.
   */
  async getPreferences(userId: string): Promise<UserNotificationPreferences> {
    return await notificationRepository.getPreferences(userId);
  }

  /**
   * Updates notification preferences for a user.
   */
  async updatePreferences(
    userId: string,
    companyId: string | null,
    input: UpdatePreferencesInput
  ): Promise<UserNotificationPreferences> {
    return await notificationRepository.updatePreferences(userId, companyId, input);
  }
}

export const notificationService = new NotificationService();
