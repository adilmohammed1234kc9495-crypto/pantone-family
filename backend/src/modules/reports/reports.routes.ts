import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { resolveTenantContext } from "../../middleware/tenant.middleware";
import { requirePermission } from "../../middleware/rbac.middleware";
import { reportsController } from "./reports.controller";

export const reportsRouter = Router();

// Apply Authentication and Tenant Boundary Isolation to all reports endpoints
reportsRouter.use(authenticate, resolveTenantContext);

// 1. Executive Dashboard
reportsRouter.get(
  "/dashboard",
  requirePermission("reports:view"),
  reportsController.getDashboard
);

// 2. Asset Register Report
reportsRouter.get(
  "/assets",
  requirePermission("reports:assets"),
  reportsController.getAssetRegister
);
reportsRouter.get(
  "/assets/export",
  requirePermission("reports:export"),
  reportsController.exportAssetRegister
);

// 3. Depreciation Report
reportsRouter.get(
  "/depreciation",
  requirePermission("reports:depreciation"),
  reportsController.getDepreciation
);
reportsRouter.get(
  "/depreciation/export",
  requirePermission("reports:export"),
  reportsController.exportDepreciation
);

// 4. Asset Movement / Transfer Report
reportsRouter.get(
  "/transfers",
  requirePermission("reports:transfers"),
  reportsController.getTransfers
);
reportsRouter.get(
  "/transfers/export",
  requirePermission("reports:export"),
  reportsController.exportTransfers
);

// 5. Custody / Assignment Report
reportsRouter.get(
  "/custody",
  requirePermission("reports:custody"),
  reportsController.getCustody
);
reportsRouter.get(
  "/custody/export",
  requirePermission("reports:export"),
  reportsController.exportCustody
);

// 6. Maintenance Report
reportsRouter.get(
  "/maintenance",
  requirePermission("reports:maintenance"),
  reportsController.getMaintenance
);
reportsRouter.get(
  "/maintenance/export",
  requirePermission("reports:export"),
  reportsController.exportMaintenance
);

// 7. Stock Report
reportsRouter.get(
  "/stock",
  requirePermission("reports:stock"),
  reportsController.getStock
);
reportsRouter.get(
  "/stock/export",
  requirePermission("reports:export"),
  reportsController.exportStock
);

// 8. Requests / Approval Report
reportsRouter.get(
  "/requests",
  requirePermission("reports:requests"),
  reportsController.getRequests
);
reportsRouter.get(
  "/requests/export",
  requirePermission("reports:export"),
  reportsController.exportRequests
);

// 9. Audit Report
reportsRouter.get(
  "/audit",
  requirePermission("reports:audit"),
  reportsController.getAudit
);
reportsRouter.get(
  "/audit/export",
  requirePermission("reports:export"),
  reportsController.exportAudit
);

// 10. Physical Scans Report
reportsRouter.get(
  "/scans",
  requirePermission("reports:scans"),
  reportsController.getScans
);
reportsRouter.get(
  "/scans/export",
  requirePermission("reports:export"),
  reportsController.exportScans
);