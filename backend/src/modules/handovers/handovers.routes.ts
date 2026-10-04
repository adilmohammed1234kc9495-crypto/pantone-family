import { Router, Request, Response } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { sendSuccess } from "../../utils/response";

export const handoversRouter = Router();

handoversRouter.use(authenticate, resolveTenantContext);

handoversRouter.get("/health", (req: Request, res: Response) => {
  sendSuccess(res, {
    module: "handovers",
    tenant: req.tenant,
    status: "healthy"
  }, "Module handovers initialized and tenant-scoped");
});