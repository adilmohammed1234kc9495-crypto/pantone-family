import { Router, Request, Response, NextFunction } from "express";
import { auditController } from "./audit.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { requirePermission } from "../../middleware/rbac.middleware";
import { sendSuccess } from "../../utils/response";
import { ForbiddenError } from "../../utils/errors";
import { query } from "../../config/database";

export const auditRouter = Router();

auditRouter.use(authenticate, resolveTenantContext);

auditRouter.get("/health", (req: Request, res: Response) => {
  sendSuccess(res, {
    module: "audit",
    tenant: req.tenant,
    status: "healthy"
  }, "Module audit initialized and tenant-scoped");
});

auditRouter.get("/", requirePermission("audit:view"), auditController.list);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Explicit immutability rejection handlers: audit logs can never be modified or deleted via HTTP CRUD
const rejectAuditModification = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (user) {
      const validEntityId = req.params.id && UUID_REGEX.test(req.params.id) ? req.params.id : null;
      await query(`
        INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, ip_address, user_agent, category, severity, status, new_values_json)
        VALUES ($1, $2, 'AUDIT_TAMPERING_ATTEMPT', 'audit_logs', $3, $4, $5, 'SECURITY', 'CRITICAL', 'FAILURE', $6::jsonb)
      `, [
        user.companyId,
        user.id,
        validEntityId,
        req.ip,
        req.get("user-agent") || null,
        JSON.stringify({ method: req.method, path: req.originalUrl, attemptedId: req.params.id || null })
      ]);
    }
    throw new ForbiddenError(`Audit logs are immutable. HTTP ${req.method} operations are strictly forbidden.`);
  } catch (err) {
    next(err);
  }
};

auditRouter.put("/:id", rejectAuditModification);
auditRouter.patch("/:id", rejectAuditModification);
auditRouter.delete("/:id", rejectAuditModification);
auditRouter.delete("/", rejectAuditModification);
auditRouter.post("/", rejectAuditModification);