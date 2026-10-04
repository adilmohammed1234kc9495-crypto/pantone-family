import { Router, Request, Response } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { sendSuccess } from "../../utils/response";

export const qrRouter = Router();

qrRouter.use(authenticate, resolveTenantContext);

qrRouter.get("/health", (req: Request, res: Response) => {
  sendSuccess(res, {
    module: "qr",
    tenant: req.tenant,
    status: "healthy"
  }, "Module qr initialized and tenant-scoped");
});