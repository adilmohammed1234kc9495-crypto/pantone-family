import { query } from "../../config/database";
import { TooManyRequestsError } from "../../utils/errors";
import { logger } from "../../config/logger";

export class RateLimiterService {
  private readonly maxFailures = 5;
  private readonly cooldownMinutes = 15;

  private normalizeIp(ip: string): string {
    const trimmed = (ip || "127.0.0.1").trim();
    if (trimmed.startsWith("::ffff:")) {
      return trimmed.substring(7);
    }
    if (trimmed === "::1") {
      return "127.0.0.1";
    }
    return trimmed;
  }

  private buildKey(ip: string, identifier: string): string {
    const cleanIp = this.normalizeIp(ip);
    return `${cleanIp}:${identifier.trim().toLowerCase()}`;
  }

  async checkLimit(ip: string, identifier: string): Promise<void> {
    const key = this.buildKey(ip, identifier);
    const res = await query<{
      failed_attempts: number;
      locked_until: Date | null;
      is_locked: boolean;
    }>(`
      SELECT 
        failed_attempts, 
        locked_until,
        (locked_until IS NOT NULL AND locked_until > NOW()) as is_locked
      FROM auth_rate_limits
      WHERE key = $1
    `, [key]);

    if (res.rows.length === 0) {
      return;
    }

    const row = res.rows[0];

    if (row.is_locked) {
      logger.warn(`Authentication rate limit active for key: ${key}`, {
        lockedUntil: row.locked_until
      });
      throw new TooManyRequestsError("Too many failed login attempts. Please try again after 15 minutes.");
    }

    // Cooldown has expired, clean up stale limit
    if (row.locked_until && !row.is_locked) {
      await this.resetLimit(ip, identifier);
    }
  }

  async recordFailure(ip: string, identifier: string): Promise<{ failedAttempts: number; isLocked: boolean }> {
    const key = this.buildKey(ip, identifier);

    const res = await query<{
      failed_attempts: number;
      locked_until: Date | null;
      is_locked: boolean;
    }>(`
      INSERT INTO auth_rate_limits (key, failed_attempts, first_attempt_at, last_attempt_at)
      VALUES ($1, 1, NOW(), NOW())
      ON CONFLICT (key) DO UPDATE SET
        failed_attempts = CASE
          WHEN auth_rate_limits.locked_until IS NOT NULL AND auth_rate_limits.locked_until <= NOW() THEN 1
          ELSE auth_rate_limits.failed_attempts + 1
        END,
        last_attempt_at = NOW(),
        locked_until = CASE
          WHEN (CASE
            WHEN auth_rate_limits.locked_until IS NOT NULL AND auth_rate_limits.locked_until <= NOW() THEN 1
            ELSE auth_rate_limits.failed_attempts + 1
          END) >= $2 THEN NOW() + ($3 || ' minutes')::interval
          ELSE NULL
        END
      RETURNING 
        failed_attempts, 
        locked_until,
        (locked_until IS NOT NULL AND locked_until > NOW()) as is_locked
    `, [key, this.maxFailures, this.cooldownMinutes]);

    const row = res.rows[0];
    return {
      failedAttempts: row.failed_attempts,
      isLocked: row.is_locked
    };
  }

  async resetLimit(ip: string, identifier: string): Promise<void> {
    await this.recordSuccess(ip, identifier);
  }

  async recordSuccess(ip: string, identifier: string): Promise<void> {
    const key = this.buildKey(ip, identifier);
    await query("DELETE FROM auth_rate_limits WHERE key = $1", [key]);
  }
}

export const rateLimiterService = new RateLimiterService();