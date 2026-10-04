import { Router, Request, Response } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { requirePermission } from "../../middleware/rbac.middleware";
import { requestsController } from "./requests.controller";
import { approvalsController } from "../approvals/approvals.controller";
import { sendSuccess } from "../../utils/response";

export const requestsRouter = Router();

requestsRouter.use(authenticate, resolveTenantContext);

requestsRouter.get("/health", (req: Request, res: Response) => {
  sendSuccess(res, {
    module: "requests",
    tenant: req.tenant,
    status: "healthy"
  }, "Module requests initialized and tenant-scoped");
});

requestsRouter.post(
  "/",
  requirePermission("requests:create"),
  (req, res, next) => requestsController.createRequest(req, res, next)
);

requestsRouter.get(
  "/",
  requirePermission("requests:view"),
  (req, res, next) => requestsController.listRequests(req, res, next)
);

requestsRouter.get(
  "/:id",
  requirePermission("requests:view"),
  (req, res, next) => requestsController.getRequestById(req, res, next)
);

requestsRouter.put(
  "/:id",
  requirePermission("requests:update"),
  (req, res, next) => requestsController.updateRequest(req, res, next)
);

requestsRouter.post(
  "/:id/submit",
  requirePermission("requests:submit"),
  (req, res, next) => requestsController.submitRequest(req, res, next)
);

requestsRouter.post(
  "/:id/cancel",
  requirePermission("requests:cancel"),
  (req, res, next) => requestsController.cancelRequest(req, res, next)
);

requestsRouter.post(
  "/:id/fulfill",
  requirePermission("requests:fulfill"),
  (req, res, next) => requestsController.fulfillRequest(req, res, next)
);

requestsRouter.get(
  "/:id/history",
  requirePermission("requests:view"),
  (req, res, next) => requestsController.getRequestHistory(req, res, next)
);

// Nested Approval Endpoints
requestsRouter.get(
  "/:id/approvals",
  requirePermission("approvals:view"),
  (req, res, next) => approvalsController.getRequestApprovals(req, res, next)
);

requestsRouter.post(
  "/:id/approvals/:approvalId/approve",
  requirePermission("approvals:approve"),
  (req, res, next) => approvalsController.approve(req, res, next)
);

requestsRouter.post(
  "/:id/approvals/:approvalId/reject",
  requirePermission("approvals:reject"),
  (req, res, next) => approvalsController.reject(req, res, next)
);

requestsRouter.post(
  "/:id/approvals/:approvalId/return",
  requirePermission("approvals:return"),
  (req, res, next) => approvalsController.returnForCorrection(req, res, next)
);