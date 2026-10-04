import { z } from "zod";

export const commonReportQuerySchema = z.object({
  companyId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.string().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc", "ASC", "DESC"]).default("desc"),
  format: z.enum(["json", "csv", "xlsx", "JSON", "CSV", "XLSX"]).default("json"),
});

export const assetReportQuerySchema = commonReportQuerySchema.extend({
  vendorId: z.string().uuid().optional(),
  condition: z.string().optional(),
  custodianId: z.string().uuid().optional(),
  minValue: z.coerce.number().nonnegative().optional(),
  maxValue: z.coerce.number().nonnegative().optional(),
  depreciationStatus: z.enum(["ALL", "FULLY_DEPRECIATED", "DEPRECIATING", "NOT_DEPRECIATING"]).optional(),
  search: z.string().optional(),
});

export const depreciationReportQuerySchema = commonReportQuerySchema.extend({
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  depreciationStatus: z.enum(["ALL", "FULLY_DEPRECIATED", "DEPRECIATING"]).optional(),
});

export const transfersReportQuerySchema = commonReportQuerySchema.extend({
  transferType: z.enum(["ALL", "INTERNAL", "INTER_COMPANY", "EMPLOYEE_TO_EMPLOYEE", "DEPT_TO_DEPT", "LOCATION_TO_LOCATION"]).optional(),
  fromCompanyId: z.string().uuid().optional(),
  toCompanyId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
});

export const custodyReportQuerySchema = commonReportQuerySchema.extend({
  employeeId: z.string().uuid().optional(),
  isOverdue: z.enum(["true", "false", "1", "0"]).optional(),
});

export const maintenanceReportQuerySchema = commonReportQuerySchema.extend({
  vendorId: z.string().uuid().optional(),
  priority: z.string().optional(),
  assetId: z.string().uuid().optional(),
});

export const stockReportQuerySchema = commonReportQuerySchema.extend({
  stockStatus: z.enum(["ALL", "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]).optional(),
  lowStockOnly: z.enum(["true", "false", "1", "0"]).optional(),
});

export const requestsReportQuerySchema = commonReportQuerySchema.extend({
  employeeId: z.string().uuid().optional(),
  priority: z.string().optional(),
  requestType: z.string().optional(),
});

export const auditReportQuerySchema = commonReportQuerySchema.extend({
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  entity: z.string().optional(),
});

export const scansReportQuerySchema = commonReportQuerySchema.extend({
  scanType: z.enum(["ALL", "QR", "BARCODE", "MANUAL"]).optional(),
  source: z.enum(["ALL", "WEB_CAMERA", "MANUAL_ENTRY", "HARDWARE_SCANNER"]).optional(),
  assetId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});
