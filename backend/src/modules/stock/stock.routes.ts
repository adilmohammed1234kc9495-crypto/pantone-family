import { Router, Request, Response } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { requirePermission } from "../../middleware/rbac.middleware";
import { stockController } from "./stock.controller";
import { sendSuccess } from "../../utils/response";

export const stockRouter = Router();

stockRouter.use(authenticate, resolveTenantContext);

stockRouter.get("/health", (req: Request, res: Response) => {
  sendSuccess(res, {
    module: "stock",
    tenant: req.tenant,
    status: "healthy"
  }, "Module stock initialized and tenant-scoped");
});

// Alerts endpoint must come before /:id to avoid router collision
stockRouter.get("/alerts", requirePermission("stock:view"), (req, res, next) => stockController.getStockAlerts(req, res, next));

stockRouter.post("/", requirePermission("stock:create"), (req, res, next) => stockController.createStockItem(req, res, next));
stockRouter.get("/", requirePermission("stock:view"), (req, res, next) => stockController.listStockItems(req, res, next));
stockRouter.get("/:id", requirePermission("stock:view"), (req, res, next) => stockController.getStockItemById(req, res, next));
stockRouter.put("/:id", requirePermission("stock:update"), (req, res, next) => stockController.updateStockItem(req, res, next));
stockRouter.patch("/:id/status", requirePermission("stock:update"), (req, res, next) => stockController.updateStockStatus(req, res, next));

stockRouter.post("/:id/movements", requirePermission("stock:movement"), (req, res, next) => stockController.recordMovement(req, res, next));
stockRouter.get("/:id/movements", requirePermission("stock:view"), (req, res, next) => stockController.getMovements(req, res, next));