import { query } from "../../config/database";
import { AuthUser } from "../../middleware/auth.middleware";
import { ForbiddenError } from "../../utils/errors";
import { logger } from "../../config/logger";
import { AuditCategory } from "../notifications/notification.types";

export interface AuditLogItem {
  id: string;
  company_id: string | null;
  company_code: string | null;
  company_name: string | null;
  user_id: string | null;
  username: string | null;
  user_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  category: string;
  severity: string;
  status: string;
  old_values_json: Record<string, unknown> | null;
  new_values_json: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
}

export interface FindAuditLogsOptions {
  companyId?: string | null;
  action?: string;
  entity?: string;
  category?: string;
  severity?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateAuditLogData {
  companyId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  category?: AuditCategory | string;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  status?: "SUCCESS" | "FAILURE";
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditService {
  /**
   * Appends an audit log record with sanitized payload (no secrets).
   */
  async createAuditLog(data: CreateAuditLogData): Promise<string | null> {
    try {
      // Sanitize payload to guarantee no passwords/secrets are stored
      const sanitize = (obj?: Record<string, unknown> | null) => {
        if (!obj) return null;
        const copy = { ...obj };
        const secretKeys = ["password", "password_hash", "token", "rawRefreshToken", "secret", "authorization"];
        for (const k of Object.keys(copy)) {
          if (secretKeys.some(s => k.toLowerCase().includes(s))) {
            copy[k] = "[REDACTED]";
          }
        }
        return copy;
      };

      const sql = `
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id,
          category, severity, status, old_values_json, new_values_json,
          ip_address, user_agent, timestamp
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, NOW()
        )
        RETURNING id
      `;

      const params = [
        data.companyId || null,
        data.userId || null,
        data.action,
        data.entity,
        data.entityId || null,
        data.category || "SYSTEM",
        data.severity || "INFO",
        data.status || "SUCCESS",
        data.oldValues ? JSON.stringify(sanitize(data.oldValues)) : null,
        data.newValues ? JSON.stringify(sanitize(data.newValues)) : null,
        data.ipAddress || null,
        data.userAgent || null
      ];

      const res = await query<{ id: string }>(sql, params);
      return res.rows[0]?.id || null;
    } catch (err) {
      logger.error("AuditService.createAuditLog failed:", err);
      return null;
    }
  }

  /**
   * Immutability guarantee: Rejects any update operation.
   */
  async updateAuditLog(_id?: string, _data?: unknown): Promise<never> {
    throw new ForbiddenError("Audit logs are strictly append-only and cannot be modified or updated");
  }

  /**
   * Immutability guarantee: Rejects any delete operation.
   */
  async deleteAuditLog(_id?: string): Promise<never> {
    throw new ForbiddenError("Audit logs are strictly append-only and cannot be deleted");
  }

  /**
   * Alias for createAuditLog
   */
  async log(data: CreateAuditLogData): Promise<{ id: string | null }> {
    const id = await this.createAuditLog(data);
    return { id };
  }

  async getAuditLogs(options: FindAuditLogsOptions, actor: AuthUser): Promise<{ logs: AuditLogItem[]; total: number; page: number; limit: number; totalPages: number }> {
    const {
      action,
      entity,
      category,
      severity,
      status,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20
    } = options;

    let targetCompanyId = options.companyId;

    if (!actor.isCommonAdmin) {
      if (targetCompanyId && targetCompanyId !== actor.companyId) {
        throw new ForbiddenError("Cannot query audit records outside your own company");
      }
      targetCompanyId = actor.companyId;
    }

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (targetCompanyId !== undefined) {
      if (targetCompanyId === null) {
        conditions.push(`a.company_id IS NULL`);
      } else {
        conditions.push(`a.company_id = $${paramIndex++}`);
        params.push(targetCompanyId);
      }
    }

    if (action) {
      conditions.push(`a.action ILIKE $${paramIndex++}`);
      params.push(`%${action}%`);
    }

    if (entity) {
      conditions.push(`a.entity = $${paramIndex++}`);
      params.push(entity);
    }

    if (category) {
      conditions.push(`a.category = $${paramIndex++}`);
      params.push(category);
    }

    if (severity) {
      conditions.push(`a.severity = $${paramIndex++}`);
      params.push(severity);
    }

    if (status) {
      conditions.push(`a.status = $${paramIndex++}`);
      params.push(status);
    }

    if (startDate) {
      conditions.push(`a.timestamp >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`a.timestamp <= $${paramIndex++}`);
      params.push(endDate);
    }

    if (search && search.trim()) {
      conditions.push(`(a.action ILIKE $${paramIndex} OR a.entity ILIKE $${paramIndex} OR u.username ILIKE $${paramIndex})`);
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `
      SELECT COUNT(*)::int as count 
      FROM audit_logs a 
      LEFT JOIN users u ON a.user_id = u.id
      ${whereClause}
    `;
    const countRes = await query<{ count: number }>(countSql, params);
    const total = countRes.rows[0]?.count || 0;

    const offset = Math.max(0, (page - 1) * limit);
    params.push(limit, offset);

    const listSql = `
      SELECT 
        a.id,
        a.company_id,
        c.code as company_code,
        c.name as company_name,
        a.user_id,
        u.username,
        u.email as user_email,
        a.action,
        a.entity,
        a.entity_id,
        COALESCE(a.category, 'SYSTEM') as category,
        COALESCE(a.severity, 'INFO') as severity,
        COALESCE(a.status, 'SUCCESS') as status,
        a.old_values_json,
        a.new_values_json,
        a.ip_address,
        a.user_agent,
        a.timestamp
      FROM audit_logs a
      LEFT JOIN companies c ON a.company_id = c.id
      LEFT JOIN users u ON a.user_id = u.id
      ${whereClause}
      ORDER BY a.timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const listRes = await query<AuditLogItem>(listSql, params);

    return {
      logs: listRes.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}

export const auditService = new AuditService();
