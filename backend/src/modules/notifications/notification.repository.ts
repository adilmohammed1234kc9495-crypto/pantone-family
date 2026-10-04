import { PoolClient } from "pg";
import { query } from "../../config/database";
import { logger } from "../../config/logger";
import {
  CreateNotificationInput,
  NotificationItem,
  UserNotificationPreferences,
  UpdatePreferencesInput,
  ListNotificationsOptions
} from "./notification.types";

export class NotificationRepository {
  /**
   * Inserts a notification into the database with idempotency protection.
   */
  async create(data: CreateNotificationInput, client?: PoolClient): Promise<NotificationItem | null> {
    try {
      // 1. Idempotency Check: avoid creating duplicate notifications for same event key
      if (data.idempotencyKey) {
        const checkSql = `
          SELECT id FROM notifications 
          WHERE idempotency_key = $1
          LIMIT 1
        `;
        const existing = client
          ? await client.query(checkSql, [data.idempotencyKey])
          : await query(checkSql, [data.idempotencyKey]);

        if (existing.rows.length > 0) {
          logger.debug(`Idempotent notification skipped: ${data.idempotencyKey}`);
          return null;
        }
      }

      const sql = `
        INSERT INTO notifications (
          user_id,
          company_id,
          title,
          message,
          type,
          severity,
          notification_type,
          entity_type,
          entity_id,
          action_url,
          metadata,
          idempotency_key,
          expires_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13
        )
        RETURNING 
          id, user_id, company_id, title, message, type, severity,
          notification_type, is_read, entity_type, entity_id, action_url,
          metadata, created_at, read_at, expires_at, idempotency_key
      `;

      const severity = data.severity || "INFO";
      const notificationType = data.notificationType || "IMPORTANT_ADMIN_ACTION";
      const legacyType = data.type || severity;

      const params = [
        data.userId,
        data.companyId || null,
        data.title,
        data.message,
        legacyType,
        severity,
        notificationType,
        data.entityType || null,
        data.entityId || null,
        data.actionUrl || null,
        JSON.stringify(data.metadata || {}),
        data.idempotencyKey || null,
        data.expiresAt || null
      ];

      const res = client
        ? await client.query<NotificationItem>(sql, params)
        : await query<NotificationItem>(sql, params);

      return res.rows[0];
    } catch (err) {
      logger.error("NotificationRepository.create failed:", err);
      return null;
    }
  }

  /**
   * Retrieves paginated notifications strictly scoped to a user.
   */
  async listForUser(
    userId: string,
    options: ListNotificationsOptions
  ): Promise<{
    notifications: NotificationItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ["user_id = $1"];
    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (options.isRead !== undefined) {
      conditions.push(`is_read = $${paramIndex++}`);
      params.push(options.isRead);
    }

    if (options.severity) {
      conditions.push(`severity = $${paramIndex++}`);
      params.push(options.severity);
    }

    if (options.notificationType) {
      conditions.push(`notification_type = $${paramIndex++}`);
      params.push(options.notificationType);
    }

    if (options.startDate) {
      conditions.push(`created_at >= $${paramIndex++}::timestamp`);
      params.push(options.startDate);
    }

    if (options.endDate) {
      conditions.push(`created_at < ($${paramIndex++}::date + INTERVAL '1 day')`);
      params.push(options.endDate);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const countSql = `
      SELECT COUNT(*)::int as total
      FROM notifications
      ${whereClause}
    `;
    const countRes = await query<{ total: number }>(countSql, params);
    const total = countRes.rows[0]?.total || 0;

    const listSql = `
      SELECT 
        id, user_id, company_id, title, message, type, severity,
        notification_type, is_read, entity_type, entity_id, action_url,
        metadata, created_at, read_at, expires_at, idempotency_key
      FROM notifications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);
    const listRes = await query<NotificationItem>(listSql, params);

    return {
      notifications: listRes.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Fast indexed unread notification count for badge display.
   */
  async getUnreadCount(userId: string): Promise<number> {
    const sql = `
      SELECT COUNT(*)::int as count
      FROM notifications
      WHERE user_id = $1 AND is_read = false
    `;
    const res = await query<{ count: number }>(sql, [userId]);
    return res.rows[0]?.count || 0;
  }

  /**
   * Marks a specific notification as read, strictly isolated to the user.
   */
  async markAsRead(id: string, userId: string): Promise<boolean> {
    const sql = `
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE id = $1 AND user_id = $2 AND is_read = false
      RETURNING id
    `;
    const res = await query(sql, [id, userId]);
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Marks all unread notifications as read for a given user.
   */
  async markAllAsRead(userId: string): Promise<number> {
    const sql = `
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE user_id = $1 AND is_read = false
      RETURNING id
    `;
    const res = await query(sql, [userId]);
    return res.rowCount ?? 0;
  }

  /**
   * Retrieves single notification by ID, with optional user scope for IDOR protection.
   */
  async findById(id: string, userId?: string): Promise<NotificationItem | null> {
    let sql = `
      SELECT 
        id, user_id, company_id, title, message, type, severity,
        notification_type, is_read, entity_type, entity_id, action_url,
        metadata, created_at, read_at, expires_at, idempotency_key
      FROM notifications
      WHERE id = $1
    `;
    const params: unknown[] = [id];

    if (userId) {
      sql += ` AND user_id = $2`;
      params.push(userId);
    }

    const res = await query<NotificationItem>(sql, params);
    return res.rows[0] || null;
  }

  /**
   * Retrieves user notification preferences, returning defaults if not yet customized.
   */
  async getPreferences(userId: string): Promise<UserNotificationPreferences> {
    const sql = `
      SELECT 
        id, user_id, company_id, asset_events, maintenance_events,
        stock_events, request_events, transfer_events, security_alerts,
        updated_at
      FROM user_notification_preferences
      WHERE user_id = $1
    `;
    const res = await query<UserNotificationPreferences>(sql, [userId]);

    if (res.rows.length > 0) {
      return res.rows[0];
    }

    // Default preferences
    return {
      id: "",
      user_id: userId,
      company_id: null,
      asset_events: true,
      maintenance_events: true,
      stock_events: true,
      request_events: true,
      transfer_events: true,
      security_alerts: true,
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Upserts user notification preferences.
   */
  async updatePreferences(
    userId: string,
    companyId: string | null,
    input: UpdatePreferencesInput
  ): Promise<UserNotificationPreferences> {
    const sql = `
      INSERT INTO user_notification_preferences (
        user_id, company_id, asset_events, maintenance_events,
        stock_events, request_events, transfer_events, security_alerts,
        updated_at
      ) VALUES (
        $1, $2,
        COALESCE($3, true), COALESCE($4, true), COALESCE($5, true),
        COALESCE($6, true), COALESCE($7, true), COALESCE($8, true),
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        company_id = COALESCE(EXCLUDED.company_id, user_notification_preferences.company_id),
        asset_events = COALESCE($3, user_notification_preferences.asset_events),
        maintenance_events = COALESCE($4, user_notification_preferences.maintenance_events),
        stock_events = COALESCE($5, user_notification_preferences.stock_events),
        request_events = COALESCE($6, user_notification_preferences.request_events),
        transfer_events = COALESCE($7, user_notification_preferences.transfer_events),
        security_alerts = COALESCE($8, user_notification_preferences.security_alerts),
        updated_at = NOW()
      RETURNING 
        id, user_id, company_id, asset_events, maintenance_events,
        stock_events, request_events, transfer_events, security_alerts,
        updated_at
    `;

    const params = [
      userId,
      companyId,
      input.assetEvents !== undefined ? input.assetEvents : null,
      input.maintenanceEvents !== undefined ? input.maintenanceEvents : null,
      input.stockEvents !== undefined ? input.stockEvents : null,
      input.requestEvents !== undefined ? input.requestEvents : null,
      input.transferEvents !== undefined ? input.transferEvents : null,
      input.securityAlerts !== undefined ? input.securityAlerts : null
    ];

    const res = await query<UserNotificationPreferences>(sql, params);
    return res.rows[0];
  }
}

export const notificationRepository = new NotificationRepository();
