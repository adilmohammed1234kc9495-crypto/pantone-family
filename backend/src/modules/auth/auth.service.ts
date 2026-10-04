import { query } from "../../config/database";
import { comparePassword, generateSecureToken, hashToken } from "../../utils/crypto";
import { UnauthorizedError, ForbiddenError } from "../../utils/errors";
import { signAccessToken, resolveEffectivePermissions } from "../../middleware/auth.middleware";
import { rateLimiterService } from "./rate-limiter.service";
import { logger } from "../../config/logger";
import { notificationService } from "../notifications/notification.service";

export class AuthService {
  async login(identifier: string, plainTextPass: string, ip: string, userAgent?: string) {
    // 1. Brute force check
    await rateLimiterService.checkLimit(ip, identifier);

    // 2. Fetch user
    const userRes = await query(`
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.password_hash, 
        u.is_active, 
        u.company_id, 
        u.employee_id,
        c.code as company_code,
        c.name as company_name,
        c.is_active as company_active,
        r.id as role_id, 
        r.code as role_code,
        r.name as role_name,
        e.department_id,
        e.employee_code,
        e.designation
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN companies c ON u.company_id = c.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE LOWER(u.username) = LOWER($1) OR LOWER(u.email) = LOWER($1)
    `, [identifier.trim()]);

    if (userRes.rows.length === 0) {
      const { isLocked } = await rateLimiterService.recordFailure(ip, identifier);
      if (isLocked) {
        await this.writeAuditLog(null, null, "USER_ACCOUNT_LOCKED", { identifier, ip, userAgent }, "SECURITY", "CRITICAL", "FAILURE");
      } else {
        await this.writeAuditLog(null, null, "LOGIN_FAILED", { identifier, reason: "UNKNOWN_USER", ip, userAgent }, "AUTHENTICATION", "WARNING", "FAILURE");
      }
      throw new UnauthorizedError("Invalid credentials provided");
    }

    const user = userRes.rows[0];

    // 3. Compare password
    const isMatch = await comparePassword(plainTextPass, user.password_hash);
    if (!isMatch) {
      const { isLocked } = await rateLimiterService.recordFailure(ip, identifier);
      if (isLocked) {
        await this.writeAuditLog(user.company_id, user.id, "USER_ACCOUNT_LOCKED", { username: user.username, ip, userAgent }, "SECURITY", "CRITICAL", "FAILURE");
        if (user.company_id) {
          await notificationService.notifyCompanyAdmins(user.company_id, {
            notificationType: "USER_ACCOUNT_LOCKED",
            title: `Security Alert: Account Locked - ${user.username}`,
            message: `Account for user '${user.username}' has been locked due to repeated failed login attempts from IP ${ip}.`,
            severity: "CRITICAL",
            entityType: "users",
            entityId: user.id,
            actionUrl: `/users`,
            idempotencyKey: `LOCK:${user.id}:${new Date().toISOString().split("T")[0]}`
          });
        }
      } else {
        await this.writeAuditLog(user.company_id, user.id, "LOGIN_FAILED", { username: user.username, reason: "INVALID_PASSWORD", ip, userAgent }, "AUTHENTICATION", "WARNING", "FAILURE");
      }
      throw new UnauthorizedError("Invalid credentials provided");
    }

    // 4. Verify user and company active
    if (!user.is_active) {
      await this.writeAuditLog(user.company_id, user.id, "LOGIN_FAILED", { username: user.username, reason: "ACCOUNT_DEACTIVATED", ip, userAgent });
      throw new ForbiddenError("This user account has been deactivated");
    }

    if (user.company_id && user.company_active === false) {
      await this.writeAuditLog(user.company_id, user.id, "LOGIN_FAILED", { username: user.username, reason: "COMPANY_DEACTIVATED", ip, userAgent });
      throw new ForbiddenError("This company account has been deactivated");
    }

    // 5. Successful login: reset rate limit & update last_login_at
    await rateLimiterService.recordSuccess(ip, identifier);
    await query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);

    const isCommonAdmin = user.role_code === "COMMON_ADMIN" && user.company_id === null;

    // 6. Resolve effective permissions
    const permissions = await resolveEffectivePermissions(user.id, user.role_id);

    // 7. Generate JWT access token
    const accessToken = signAccessToken({
      sub: user.id,
      companyId: user.company_id,
      companyCode: user.company_code,
      roleCode: user.role_code,
      isCommonAdmin,
      permissions
    });

    // 8. Generate and persist refresh token session
    const rawRefreshToken = generateSecureToken(40);
    const tokenHash = hashToken(rawRefreshToken);
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await query(`
      INSERT INTO auth_sessions (user_id, token_hash, expires_at, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5)
    `, [user.id, tokenHash, sessionExpiresAt, ip, userAgent || null]);

    // 9. Write audit log
    await this.writeAuditLog(user.company_id, user.id, "LOGIN_SUCCESS", {
      username: user.username,
      email: user.email,
      role: user.role_code,
      ip,
      userAgent
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        company: user.company_id ? {
          id: user.company_id,
          code: user.company_code,
          name: user.company_name
        } : null,
        role: {
          id: user.role_id,
          code: user.role_code,
          name: user.role_name
        },
        employee: user.employee_id ? {
          id: user.employee_id,
          employeeCode: user.employee_code,
          departmentId: user.department_id,
          designation: user.designation
        } : null,
        isCommonAdmin,
        permissions
      }
    };
  }

  async refreshToken(rawRefreshToken: string, ip: string, userAgent?: string) {
    if (!rawRefreshToken || typeof rawRefreshToken !== "string") {
      throw new UnauthorizedError("Refresh token is required");
    }

    const tokenHash = hashToken(rawRefreshToken);

    const sessionRes = await query(`
      SELECT 
        s.id as session_id,
        s.user_id,
        s.expires_at,
        s.revoked_at,
        u.username,
        u.email,
        u.is_active as user_active,
        u.company_id,
        c.code as company_code,
        c.name as company_name,
        c.is_active as company_active,
        r.id as role_id,
        r.code as role_code,
        r.name as role_name
      FROM auth_sessions s
      JOIN users u ON s.user_id = u.id
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN companies c ON u.company_id = c.id
      WHERE s.token_hash = $1
    `, [tokenHash]);

    if (sessionRes.rows.length === 0) {
      throw new UnauthorizedError("Invalid or unknown refresh token");
    }

    const session = sessionRes.rows[0];

    if (session.revoked_at !== null) {
      await this.writeAuditLog(session.company_id, session.user_id, "TOKEN_REFRESH", {
        reason: "REVOKED_TOKEN_PRESENTED",
        ip
      });
      throw new UnauthorizedError("This session has been revoked. Please log in again.");
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      throw new UnauthorizedError("Refresh token has expired. Please log in again.");
    }

    if (!session.user_active || (session.company_id && session.company_active === false)) {
      throw new ForbiddenError("Account or company is no longer active");
    }

    // ROTATION: Revoke current session
    await query(`
      UPDATE auth_sessions 
      SET revoked_at = NOW(), last_used_at = NOW() 
      WHERE id = $1
    `, [session.session_id]);

    // Issue new refresh token session
    const newRawRefreshToken = generateSecureToken(40);
    const newTokenHash = hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await query(`
      INSERT INTO auth_sessions (user_id, token_hash, expires_at, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5)
    `, [session.user_id, newTokenHash, newExpiresAt, ip, userAgent || null]);

    const isCommonAdmin = session.role_code === "COMMON_ADMIN" && session.company_id === null;
    const permissions = await resolveEffectivePermissions(session.user_id, session.role_id);

    // Issue new access token
    const accessToken = signAccessToken({
      sub: session.user_id,
      companyId: session.company_id,
      companyCode: session.company_code,
      roleCode: session.role_code,
      isCommonAdmin,
      permissions
    });

    await this.writeAuditLog(session.company_id, session.user_id, "TOKEN_REFRESH", {
      username: session.username,
      ip
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken
    };
  }

  async logout(userId: string, rawRefreshToken?: string) {
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await query(`
        UPDATE auth_sessions 
        SET revoked_at = NOW() 
        WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL
      `, [userId, tokenHash]);
    } else {
      // Revoke latest active session for user
      await query(`
        UPDATE auth_sessions 
        SET revoked_at = NOW() 
        WHERE id = (
          SELECT id FROM auth_sessions 
          WHERE user_id = $1 AND revoked_at IS NULL 
          ORDER BY created_at DESC LIMIT 1
        )
      `, [userId]);
    }

    await this.writeAuditLog(null, userId, "LOGOUT", { userId });
  }

  async logoutAll(userId: string) {
    await query(`
      UPDATE auth_sessions 
      SET revoked_at = NOW() 
      WHERE user_id = $1 AND revoked_at IS NULL
    `, [userId]);

    await this.writeAuditLog(null, userId, "LOGOUT_ALL", { userId });
  }

  async getCurrentUser(userId: string) {
    const userRes = await query(`
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.is_active, 
        u.company_id, 
        u.last_login_at,
        c.code as company_code,
        c.name as company_name,
        r.id as role_id, 
        r.code as role_code,
        r.name as role_name,
        e.id as employee_id,
        e.employee_code,
        e.department_id,
        e.designation
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN companies c ON u.company_id = c.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE u.id = $1
    `, [userId]);

    if (userRes.rows.length === 0) {
      throw new UnauthorizedError("User not found");
    }

    const row = userRes.rows[0];
    const isCommonAdmin = row.role_code === "COMMON_ADMIN" && row.company_id === null;
    const permissions = await resolveEffectivePermissions(row.id, row.role_id);

    return {
      id: row.id,
      username: row.username,
      email: row.email,
      companyId: row.company_id,
      companyCode: row.company_code,
      company: row.company_id ? {
        id: row.company_id,
        code: row.company_code,
        name: row.company_name
      } : null,
      role: {
        id: row.role_id,
        code: row.role_code,
        name: row.role_name
      },
      permissions,
      employee: row.employee_id ? {
        id: row.employee_id,
        employeeCode: row.employee_code,
        departmentId: row.department_id,
        designation: row.designation
      } : null,
      isCommonAdmin,
      lastLoginAt: row.last_login_at
    };
  }

  private async writeAuditLog(
    companyId: string | null, 
    userId: string | null, 
    action: string, 
    details: Record<string, unknown>,
    category: string = "AUTHENTICATION",
    severity: string = "INFO",
    status: string = "SUCCESS"
  ): Promise<void> {
    try {
      await query(`
        INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, category, severity, status, new_values_json)
        VALUES ($1, $2, $3, 'auth', $2, $4, $5, $6, $7::jsonb)
      `, [companyId, userId, action, category, severity, status, JSON.stringify(details)]);
    } catch (err) {
      logger.error("Failed to write auth audit log", { error: (err as Error).message });
    }
  }
}

export const authService = new AuthService();