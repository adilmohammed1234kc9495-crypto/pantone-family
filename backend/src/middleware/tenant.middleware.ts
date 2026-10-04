import { Request, Response, NextFunction } from "express";
import { ForbiddenError, BadRequestError } from "../utils/errors";
import { AuthUser } from "./auth.middleware";
import { query } from "../config/database";
import { logger } from "../config/logger";
import { notificationService } from "../modules/notifications/notification.service";

export interface TenantContext {
  companyId: string | null;
  companyCode: string | null;
  isGlobal: boolean;
}

/**
 * Resolves and injects tenant context from the authenticated user, headers, query, and payload.
 * Strictly enforces multi-company data isolation at backend level.
 */
export async function resolveTenantContext(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      throw new ForbiddenError("Authentication context missing for tenant resolution");
    }

    const requestedHeaderCompanyId = (
      req.headers["x-company-id"] || 
      req.headers["x-company-id".toLowerCase()]
    ) as string | undefined;

    // Check query & body for potential tenant tampering
    const requestedQueryCompanyId = req.query.companyId as string | undefined;
    const requestedBodyCompanyId = req.body && typeof req.body === "object" ? req.body.companyId : undefined;

    // 1. COMMON ADMIN: Global Authority
    if (user.isCommonAdmin) {
      const targetCompanyId = requestedHeaderCompanyId || requestedQueryCompanyId;

      if (targetCompanyId) {
        // Validate target company exists and is active
        const compRes = await query<{ id: string; code: string; is_active: boolean }>(`
          SELECT id, code, is_active FROM companies WHERE id = $1
        `, [targetCompanyId]);

        if (compRes.rows.length === 0 || !compRes.rows[0].is_active) {
          throw new BadRequestError("Specified target company context does not exist or is inactive");
        }

        req.tenant = {
          companyId: compRes.rows[0].id,
          companyCode: compRes.rows[0].code,
          isGlobal: false
        };
      } else {
        req.tenant = {
          companyId: null,
          companyCode: null,
          isGlobal: true
        };
      }
      return next();
    }

    // 2. COMPANY USERS: Strict Company Boundary
    if (!user.companyId) {
      throw new ForbiddenError("User is not associated with any active enterprise company");
    }

    // A: Header Tampering Check
    if (requestedHeaderCompanyId && requestedHeaderCompanyId !== user.companyId) {
      await logSecurityViolation(user, "HEADER_TENANT_TAMPERING", requestedHeaderCompanyId, req);
      throw new ForbiddenError(
        `Cross-company violation: User belonging to '${user.companyCode}' cannot access company '${requestedHeaderCompanyId}'`
      );
    }

    // B: Query Parameter Tampering Check
    if (requestedQueryCompanyId && requestedQueryCompanyId !== user.companyId) {
      await logSecurityViolation(user, "QUERY_TENANT_TAMPERING", requestedQueryCompanyId, req);
      throw new ForbiddenError(
        `Cross-company violation: Query parameter companyId does not match authenticated company`
      );
    }

    // C: Body Payload Tampering Check
    if (requestedBodyCompanyId && requestedBodyCompanyId !== user.companyId) {
      await logSecurityViolation(user, "BODY_TENANT_TAMPERING", requestedBodyCompanyId, req);
      throw new ForbiddenError(
        `Cross-company violation: Request body companyId does not match authenticated company`
      );
    }

    // Authoritative company context locked to authenticated user
    req.tenant = {
      companyId: user.companyId,
      companyCode: user.companyCode,
      isGlobal: false
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Requires a non-null company context.
 */
export function requireCompanyContext(req: Request, _res: Response, next: NextFunction): void {
  if (!req.tenant || !req.tenant.companyId) {
    return next(new BadRequestError("A specific company context is required for this operation."));
  }
  next();
}

/**
 * Validates that an accessed resource's companyId matches the user's company boundary.
 * Common Admin is permitted; Company users are strictly locked to user.companyId.
 */
export function assertCompanyAccess(user: AuthUser, targetCompanyId: string, req?: Request): void {
  if (user.isCommonAdmin) {
    return;
  }
  if (user.companyId !== targetCompanyId) {
    if (req) {
      logSecurityViolation(user, "IDOR_CROSS_COMPANY_ACCESS", targetCompanyId, req).catch(() => {});
    }
    throw new ForbiddenError(
      `Cross-company violation: Access denied to resource owned by company '${targetCompanyId}'`
    );
  }
}

/**
 * Scopes Department Managers to their assigned department where business rules require it.
 */
export function assertDepartmentAccess(user: AuthUser, targetDepartmentId: string): void {
  if (user.isCommonAdmin) {
    return;
  }
  if (user.roleCode === "COMPANY_ADMIN" || user.roleCode === "ASSET_MANAGER") {
    return; // Full company operational authority
  }
  if (user.roleCode === "DEPT_MANAGER") {
    if (!user.departmentId || user.departmentId !== targetDepartmentId) {
      throw new ForbiddenError(
        `Cross-department violation: You are only authorized to manage assets for your assigned department.`
      );
    }
  }
}

/**
 * Scopes Employee actions to personal custody.
 */
export function assertOwnershipAccess(user: AuthUser, resourceEmployeeId: string): void {
  if (user.isCommonAdmin || user.roleCode === "COMPANY_ADMIN" || user.roleCode === "ASSET_MANAGER" || user.roleCode === "DEPT_MANAGER") {
    return;
  }
  if (user.roleCode === "EMPLOYEE") {
    if (!user.employeeId || user.employeeId !== resourceEmployeeId) {
      throw new ForbiddenError("Access restricted: You may only view or manage your own assigned custody.");
    }
  }
}

async function logSecurityViolation(user: AuthUser, action: string, attemptedId: string, req: Request): Promise<void> {
  try {
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, ip_address, user_agent, category, severity, status, new_values_json)
      VALUES ($1, $2, 'FORBIDDEN_ACCESS_ATTEMPT', 'security', NULL, $3, $4, 'SECURITY', 'CRITICAL', 'FAILURE', $5::jsonb)
    `, [
      user.companyId,
      user.id,
      req.ip,
      req.get("user-agent") || null,
      JSON.stringify({ violation: action, attemptedTarget: attemptedId, path: req.originalUrl, method: req.method })
    ]);

    if (user.companyId) {
      await notificationService.notifyCompanyAdmins(user.companyId, {
        notificationType: "SYSTEM_SECURITY_ALERT",
        title: `Security Alert: Cross-Company Access Attempt`,
        message: `Security violation '${action}' detected from user '${user.username}' attempting to access target '${attemptedId}'.`,
        severity: "CRITICAL",
        entityType: "security",
        entityId: user.id,
        actionUrl: `/audit`,
        idempotencyKey: `SEC_ALERT:${user.id}:${action}:${new Date().toISOString().split("T")[0]}`
      });
    }
  } catch (err) {
    logger.error("Failed to write security audit log", { error: (err as Error).message });
  }
}