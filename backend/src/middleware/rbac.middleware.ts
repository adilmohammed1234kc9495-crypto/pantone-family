import { Request, Response, NextFunction } from "express";
import { ForbiddenError, UnauthorizedError } from "../utils/errors";
import { query } from "../config/database";

export function requirePermission(...permissionCodes: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        throw new UnauthorizedError("Authentication required");
      }

      // Common Admin inherently possesses all permissions
      if (user.isCommonAdmin) {
        return next();
      }

      // Auditor is strictly read-only
      if (user.roleCode === "AUDITOR" && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
        await logRbacViolation(user, "AUDITOR_MUTATION_ATTEMPT", req);
        throw new ForbiddenError("Auditor role has read-only compliance access and cannot mutate records");
      }

      const userPerms = new Set(user.permissions);
      const missing = permissionCodes.filter((code) => !userPerms.has(code));

      if (missing.length > 0) {
        await logRbacViolation(user, `MISSING_PERMISSIONS: ${missing.join(",")}`, req);
        throw new ForbiddenError(
          `Insufficient permissions. Missing required: ${missing.join(", ")}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAnyPermission(...permissionCodes: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        throw new UnauthorizedError("Authentication required");
      }

      if (user.isCommonAdmin) {
        return next();
      }

      if (user.roleCode === "AUDITOR" && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
        await logRbacViolation(user, "AUDITOR_MUTATION_ATTEMPT", req);
        throw new ForbiddenError("Auditor role has read-only compliance access and cannot mutate records");
      }

      const userPerms = new Set(user.permissions);
      const hasAny = permissionCodes.some((code) => userPerms.has(code));

      if (!hasAny) {
        await logRbacViolation(user, `REQUIRES_ONE_OF: ${permissionCodes.join(",")}`, req);
        throw new ForbiddenError(
          `Insufficient permissions. Requires one of: ${permissionCodes.join(", ")}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRole(...roleCodes: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        throw new UnauthorizedError("Authentication required");
      }

      if (user.isCommonAdmin) {
        return next();
      }

      if (!roleCodes.includes(user.roleCode)) {
        await logRbacViolation(user, `ROLE_RESTRICTED: ${roleCodes.join(",")}`, req);
        throw new ForbiddenError(
          `Access restricted to roles: ${roleCodes.join(", ")}. Current role: ${user.roleCode}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireCommonAdmin(req: Request, _res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user || !user.isCommonAdmin) {
    if (user) {
      logRbacViolation(user, "COMMON_ADMIN_REQUIRED", req).catch(() => {});
    }
    return next(new ForbiddenError("Access restricted to Common Administrator only"));
  }
  next();
}

async function logRbacViolation(user: { id?: string; companyId?: string | null }, reason: string, req: Request): Promise<void> {
  try {
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, ip_address, user_agent, new_values_json)
      VALUES ($1, $2, 'UNAUTHORIZED_ACCESS_ATTEMPT', 'rbac', $3, $4, $5::jsonb)
    `, [
      user.companyId || null,
      user.id,
      req.ip,
      req.get("user-agent") || null,
      JSON.stringify({ reason, path: req.originalUrl, method: req.method })
    ]);
  } catch {
    // Fail silently in audit logging to preserve primary error flow
  }
}