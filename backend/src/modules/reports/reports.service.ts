import { reportsRepository } from "./reports.repository";
import { exportService, ExportColumn, ExportMetadata } from "./export.service";
import { TenantContext } from "../../middleware/tenant.middleware";
import { AuthUser } from "../../middleware/auth.middleware";

export interface ReportResponse {
  type: "json" | "export";
  data?: any;
  total?: number;
  page?: number;
  limit?: number;
  summary?: Record<string, any>;
  exportBuffer?: Buffer | string;
  filename?: string;
  contentType?: string;
}

export class ReportsService {
  private getCompanyContextString(tenant: TenantContext): string {
    if (tenant.isGlobal) {
      return "Global Consolidated Enterprise (All Companies)";
    }
    return tenant.companyCode ? `Company: ${tenant.companyCode}` : "Company Scoped";
  }

  // 1. EXECUTIVE DASHBOARD
  public async getDashboard(tenant: TenantContext, user: AuthUser): Promise<any> {
    return reportsRepository.getDashboardMetrics(tenant, user);
  }

  // 2. ASSET REGISTER REPORT
  public async getAssetRegister(filters: any, tenant: TenantContext, user: AuthUser): Promise<ReportResponse> {
    const format = (filters.format || "json").toLowerCase();
    const result = await reportsRepository.getAssetRegisterReport(filters, tenant, user);

    if (format === "csv" || format === "xlsx") {
      const columns: ExportColumn[] = [
        { header: "Asset Tag", key: "asset_tag", width: 16 },
        { header: "Asset Name", key: "name", width: 28 },
        { header: "Category", key: "category_name", width: 20 },
        { header: "Company", key: "company_name", width: 24 },
        { header: "Branch", key: "branch_name", width: 20 },
        { header: "Department", key: "department_name", width: 20 },
        { header: "Location", key: "location_name", width: 22 },
        { header: "Vendor", key: "vendor_name", width: 22 },
        { header: "Purchase Date", key: "purchase_date", width: 14, format: "date" },
        { header: "Purchase Cost ($)", key: "purchase_cost", width: 16, format: "currency" },
        { header: "Depreciation Method", key: "depreciation_method", width: 18 },
        { header: "Useful Life (Months)", key: "useful_life_months", width: 18, format: "number" },
        { header: "Accumulated Dep. ($)", key: "accumulated_depreciation", width: 20, format: "currency" },
        { header: "Current Book Value ($)", key: "current_book_value", width: 20, format: "currency" },
        { header: "Status", key: "status", width: 16 },
        { header: "Condition", key: "condition", width: 14 },
        { header: "Custodian", key: "custodian_name", width: 22 },
      ];

      const meta: ExportMetadata = {
        title: "Fixed Asset Register Report",
        companyContext: this.getCompanyContextString(tenant),
        generatedBy: `${user.username} (${user.roleName})`,
        generatedAt: new Date().toISOString(),
        filtersApplied: filters,
        summaryMetrics: result.summary,
      };

      if (format === "csv") {
        const csv = exportService.generateCsv(columns, result.rows, meta);
        return {
          type: "export",
          exportBuffer: csv,
          filename: `asset_register_${Date.now()}.csv`,
          contentType: "text/csv; charset=utf-8",
        };
      } else {
        const xlsx = await exportService.generateXlsx(columns, result.rows, meta);
        return {
          type: "export",
          exportBuffer: xlsx,
          filename: `asset_register_${Date.now()}.xlsx`,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        };
      }
    }

    return {
      type: "json",
      data: result.rows,
      total: result.total,
      page: filters.page || 1,
      limit: filters.limit || 20,
      summary: result.summary,
    };
  }

  // 3. DEPRECIATION REPORT
  public async getDepreciation(filters: any, tenant: TenantContext, user: AuthUser): Promise<ReportResponse> {
    const format = (filters.format || "json").toLowerCase();
    const result = await reportsRepository.getDepreciationReport(filters, tenant, user);

    if (format === "csv" || format === "xlsx") {
      const columns: ExportColumn[] = [
        { header: "Asset Tag", key: "asset_tag", width: 16 },
        { header: "Asset Name", key: "name", width: 28 },
        { header: "Category", key: "category_name", width: 20 },
        { header: "Company", key: "company_name", width: 22 },
        { header: "Purchase Date", key: "purchase_date", width: 14, format: "date" },
        { header: "Gross Cost ($)", key: "purchase_cost", width: 16, format: "currency" },
        { header: "Useful Life (Mo)", key: "useful_life_months", width: 16, format: "number" },
        { header: "Monthly Dep. ($)", key: "monthly_depreciation", width: 16, format: "currency" },
        { header: "Annual Dep. ($)", key: "annual_depreciation", width: 16, format: "currency" },
        { header: "Accumulated Dep. ($)", key: "accumulated_depreciation", width: 20, format: "currency" },
        { header: "Net Book Value ($)", key: "current_book_value", width: 18, format: "currency" },
        { header: "Remaining Life (Mo)", key: "remaining_useful_life_months", width: 18, format: "number" },
        { header: "Depreciation Status", key: "depreciation_status", width: 20 },
      ];

      const meta: ExportMetadata = {
        title: "Straight-Line Depreciation & Valuation Report",
        companyContext: this.getCompanyContextString(tenant),
        generatedBy: `${user.username} (${user.roleName})`,
        generatedAt: new Date().toISOString(),
        filtersApplied: filters,
        summaryMetrics: result.summary,
      };

      if (format === "csv") {
        return {
          type: "export",
          exportBuffer: exportService.generateCsv(columns, result.rows, meta),
          filename: `depreciation_report_${Date.now()}.csv`,
          contentType: "text/csv; charset=utf-8",
        };
      } else {
        return {
          type: "export",
          exportBuffer: await exportService.generateXlsx(columns, result.rows, meta),
          filename: `depreciation_report_${Date.now()}.xlsx`,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        };
      }
    }

    return {
      type: "json",
      data: result.rows,
      total: result.total,
      page: filters.page || 1,
      limit: filters.limit || 20,
      summary: result.summary,
    };
  }

  // 4. TRANSFERS / MOVEMENT REPORT
  public async getTransfers(filters: any, tenant: TenantContext, user: AuthUser): Promise<ReportResponse> {
    const format = (filters.format || "json").toLowerCase();
    const result = await reportsRepository.getTransfersReport(filters, tenant, user);

    if (format === "csv" || format === "xlsx") {
      const columns: ExportColumn[] = [
        { header: "Transfer Code", key: "transfer_code", width: 18 },
        { header: "Type", key: "transfer_type", width: 18 },
        { header: "Asset Tag", key: "asset_tag", width: 16 },
        { header: "Asset Name", key: "asset_name", width: 26 },
        { header: "From Company", key: "from_company_name", width: 22 },
        { header: "To Company", key: "to_company_name", width: 22 },
        { header: "From Dept", key: "from_department_name", width: 20 },
        { header: "To Dept", key: "to_department_name", width: 20 },
        { header: "Transfer Date", key: "transfer_date", width: 14, format: "date" },
        { header: "Dispatch Date", key: "dispatch_date", width: 14, format: "date" },
        { header: "Delivery Date", key: "actual_delivery_date", width: 14, format: "date" },
        { header: "Status", key: "status", width: 16 },
        { header: "Condition Before", key: "condition_before", width: 16 },
        { header: "Condition After", key: "condition_after", width: 16 },
        { header: "Dispute Reason", key: "dispute_reason", width: 24 },
        { header: "Initiated By", key: "requested_by_name", width: 20 },
      ];

      const meta: ExportMetadata = {
        title: "Asset Movement & Transfer Ledger Report",
        companyContext: this.getCompanyContextString(tenant),
        generatedBy: `${user.username} (${user.roleName})`,
        generatedAt: new Date().toISOString(),
        filtersApplied: filters,
        summaryMetrics: result.summary,
      };

      if (format === "csv") {
        return {
          type: "export",
          exportBuffer: exportService.generateCsv(columns, result.rows, meta),
          filename: `asset_transfers_${Date.now()}.csv`,
          contentType: "text/csv; charset=utf-8",
        };
      } else {
        return {
          type: "export",
          exportBuffer: await exportService.generateXlsx(columns, result.rows, meta),
          filename: `asset_transfers_${Date.now()}.xlsx`,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        };
      }
    }

    return {
      type: "json",
      data: result.rows,
      total: result.total,
      page: filters.page || 1,
      limit: filters.limit || 20,
      summary: result.summary,
    };
  }

  // 5. CUSTODY REPORT
  public async getCustody(filters: any, tenant: TenantContext, user: AuthUser): Promise<ReportResponse> {
    const format = (filters.format || "json").toLowerCase();
    const result = await reportsRepository.getCustodyReport(filters, tenant, user);

    if (format === "csv" || format === "xlsx") {
      const columns: ExportColumn[] = [
        { header: "Asset Tag", key: "asset_tag", width: 16 },
        { header: "Asset Name", key: "asset_name", width: 26 },
        { header: "Employee Code", key: "employee_code", width: 16 },
        { header: "Employee Name", key: "employee_name", width: 22 },
        { header: "Department", key: "department_name", width: 20 },
        { header: "Company", key: "company_name", width: 22 },
        { header: "Assigned Date", key: "assigned_at", width: 14, format: "date" },
        { header: "Due Date", key: "return_due_date", width: 14, format: "date" },
        { header: "Condition Handover", key: "condition_at_assignment", width: 18 },
        { header: "Status", key: "status", width: 14 },
        { header: "Overdue", key: "is_overdue", width: 12 },
        { header: "Returned Date", key: "returned_at", width: 14, format: "date" },
        { header: "Return Condition", key: "return_condition", width: 16 },
        { header: "Damage Severity", key: "damage_severity", width: 16 },
      ];

      const meta: ExportMetadata = {
        title: "Asset Custody & Assignment Tracking Report",
        companyContext: this.getCompanyContextString(tenant),
        generatedBy: `${user.username} (${user.roleName})`,
        generatedAt: new Date().toISOString(),
        filtersApplied: filters,
        summaryMetrics: result.summary,
      };

      if (format === "csv") {
        return {
          type: "export",
          exportBuffer: exportService.generateCsv(columns, result.rows, meta),
          filename: `custody_report_${Date.now()}.csv`,
          contentType: "text/csv; charset=utf-8",
        };
      } else {
        return {
          type: "export",
          exportBuffer: await exportService.generateXlsx(columns, result.rows, meta),
          filename: `custody_report_${Date.now()}.xlsx`,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        };
      }
    }

    return {
      type: "json",
      data: result.rows,
      total: result.total,
      page: filters.page || 1,
      limit: filters.limit || 20,
      summary: result.summary,
    };
  }

  // 6. MAINTENANCE REPORT
  public async getMaintenance(filters: any, tenant: TenantContext, user: AuthUser): Promise<ReportResponse> {
    const format = (filters.format || "json").toLowerCase();
    const result = await reportsRepository.getMaintenanceReport(filters, tenant, user);

    if (format === "csv" || format === "xlsx") {
      const columns: ExportColumn[] = [
        { header: "Code", key: "maintenance_code", width: 16 },
        { header: "Work Order #", key: "work_order_number", width: 18 },
        { header: "Asset Tag", key: "asset_tag", width: 16 },
        { header: "Asset Name", key: "asset_name", width: 26 },
        { header: "Company", key: "company_name", width: 22 },
        { header: "Department", key: "department_name", width: 20 },
        { header: "Problem", key: "problem", width: 30 },
        { header: "Priority", key: "priority", width: 14 },
        { header: "Status", key: "status", width: 16 },
        { header: "Vendor / Provider", key: "vendor_name", width: 22 },
        { header: "Technician", key: "technician_name", width: 18 },
        { header: "Estimated Cost ($)", key: "estimated_cost", width: 18, format: "currency" },
        { header: "Actual Cost ($)", key: "actual_cost", width: 16, format: "currency" },
        { header: "Report Date", key: "report_date", width: 14, format: "date" },
        { header: "Closed At", key: "closed_at", width: 14, format: "date" },
      ];

      const meta: ExportMetadata = {
        title: "Maintenance Work Orders & Repair Cost Analytics",
        companyContext: this.getCompanyContextString(tenant),
        generatedBy: `${user.username} (${user.roleName})`,
        generatedAt: new Date().toISOString(),
        filtersApplied: filters,
        summaryMetrics: result.summary,
      };

      if (format === "csv") {
        return {
          type: "export",
          exportBuffer: exportService.generateCsv(columns, result.rows, meta),
          filename: `maintenance_report_${Date.now()}.csv`,
          contentType: "text/csv; charset=utf-8",
        };
      } else {
        return {
          type: "export",
          exportBuffer: await exportService.generateXlsx(columns, result.rows, meta),
          filename: `maintenance_report_${Date.now()}.xlsx`,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        };
      }
    }

    return {
      type: "json",
      data: result.rows,
      total: result.total,
      page: filters.page || 1,
      limit: filters.limit || 20,
      summary: result.summary,
    };
  }

  // 7. STOCK REPORT
  public async getStock(filters: any, tenant: TenantContext, user: AuthUser): Promise<ReportResponse> {
    const format = (filters.format || "json").toLowerCase();
    const result = await reportsRepository.getStockReport(filters, tenant, user);

    if (format === "csv" || format === "xlsx") {
      const columns: ExportColumn[] = [
        { header: "Stock SKU / Code", key: "stock_code", width: 18 },
        { header: "Item Name", key: "item_name", width: 26 },
        { header: "Category", key: "category_name", width: 20 },
        { header: "Branch", key: "branch_name", width: 20 },
        { header: "Company", key: "company_name", width: 22 },
        { header: "Current Qty", key: "current_quantity", width: 14, format: "number" },
        { header: "Min Qty (Reorder)", key: "minimum_quantity", width: 18, format: "number" },
        { header: "Max Qty", key: "maximum_quantity", width: 14, format: "number" },
        { header: "Unit Cost ($)", key: "unit_cost", width: 14, format: "currency" },
        { header: "Total Value ($)", key: "total_value", width: 16, format: "currency" },
        { header: "Stock Status", key: "stock_status", width: 16 },
      ];

      const meta: ExportMetadata = {
        title: "Stock Inventory & Reorder Valuation Report",
        companyContext: this.getCompanyContextString(tenant),
        generatedBy: `${user.username} (${user.roleName})`,
        generatedAt: new Date().toISOString(),
        filtersApplied: filters,
        summaryMetrics: result.summary,
      };

      if (format === "csv") {
        return {
          type: "export",
          exportBuffer: exportService.generateCsv(columns, result.rows, meta),
          filename: `stock_report_${Date.now()}.csv`,
          contentType: "text/csv; charset=utf-8",
        };
      } else {
        return {
          type: "export",
          exportBuffer: await exportService.generateXlsx(columns, result.rows, meta),
          filename: `stock_report_${Date.now()}.xlsx`,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        };
      }
    }

    return {
      type: "json",
      data: result.rows,
      total: result.total,
      page: filters.page || 1,
      limit: filters.limit || 20,
      summary: result.summary,
    };
  }

  // 8. REQUESTS REPORT
  public async getRequests(filters: any, tenant: TenantContext, user: AuthUser): Promise<ReportResponse> {
    const format = (filters.format || "json").toLowerCase();
    const result = await reportsRepository.getRequestsReport(filters, tenant, user);

    if (format === "csv" || format === "xlsx") {
      const columns: ExportColumn[] = [
        { header: "Request #", key: "request_number", width: 18 },
        { header: "Requester", key: "requester_name", width: 22 },
        { header: "Department", key: "department_name", width: 20 },
        { header: "Company", key: "company_name", width: 22 },
        { header: "Request Date", key: "request_date", width: 14, format: "date" },
        { header: "Priority", key: "priority", width: 14 },
        { header: "Status", key: "status", width: 16 },
        { header: "Reason", key: "reason", width: 26 },
        { header: "Approval Level", key: "current_approval_level", width: 16, format: "number" },
        { header: "Fulfilled Date", key: "fulfilled_at", width: 14, format: "date" },
        { header: "Fulfilled Asset", key: "fulfilled_asset_tag", width: 18 },
      ];

      const meta: ExportMetadata = {
        title: "Asset Requisition & Approval Lifecycle Report",
        companyContext: this.getCompanyContextString(tenant),
        generatedBy: `${user.username} (${user.roleName})`,
        generatedAt: new Date().toISOString(),
        filtersApplied: filters,
        summaryMetrics: result.summary,
      };

      if (format === "csv") {
        return {
          type: "export",
          exportBuffer: exportService.generateCsv(columns, result.rows, meta),
          filename: `requests_report_${Date.now()}.csv`,
          contentType: "text/csv; charset=utf-8",
        };
      } else {
        return {
          type: "export",
          exportBuffer: await exportService.generateXlsx(columns, result.rows, meta),
          filename: `requests_report_${Date.now()}.xlsx`,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        };
      }
    }

    return {
      type: "json",
      data: result.rows,
      total: result.total,
      page: filters.page || 1,
      limit: filters.limit || 20,
      summary: result.summary,
    };
  }

  // 9. AUDIT REPORT
  public async getAudit(filters: any, tenant: TenantContext, user: AuthUser): Promise<ReportResponse> {
    const format = (filters.format || "json").toLowerCase();
    const result = await reportsRepository.getAuditReport(filters, tenant, user);

    if (format === "csv" || format === "xlsx") {
      const columns: ExportColumn[] = [
        { header: "Timestamp", key: "timestamp", width: 22, format: "date" },
        { header: "Operator / User", key: "actor_username", width: 20 },
        { header: "Company", key: "company_name", width: 22 },
        { header: "Action", key: "action", width: 24 },
        { header: "Entity", key: "entity", width: 18 },
        { header: "Entity ID", key: "entity_id", width: 34 },
        { header: "IP Address", key: "ip_address", width: 18 },
        { header: "User Agent", key: "user_agent", width: 36 },
      ];

      const meta: ExportMetadata = {
        title: "System Compliance & Audit Trail Report",
        companyContext: this.getCompanyContextString(tenant),
        generatedBy: `${user.username} (${user.roleName})`,
        generatedAt: new Date().toISOString(),
        filtersApplied: filters,
        summaryMetrics: result.summary,
      };

      if (format === "csv") {
        return {
          type: "export",
          exportBuffer: exportService.generateCsv(columns, result.rows, meta),
          filename: `audit_report_${Date.now()}.csv`,
          contentType: "text/csv; charset=utf-8",
        };
      } else {
        return {
          type: "export",
          exportBuffer: await exportService.generateXlsx(columns, result.rows, meta),
          filename: `audit_report_${Date.now()}.xlsx`,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        };
      }
    }

    return {
      type: "json",
      data: result.rows,
      total: result.total,
      page: filters.page || 1,
      limit: filters.limit || 20,
      summary: result.summary,
    };
  }

  // 10. SCANS REPORT
  public async getScans(filters: any, tenant: TenantContext, user: AuthUser): Promise<ReportResponse> {
    const format = (filters.format || "json").toLowerCase();
    const result = await reportsRepository.getScansReport(filters, tenant, user);

    if (format === "csv" || format === "xlsx") {
      const columns: ExportColumn[] = [
        { header: "Scan Time", key: "scan_time", width: 22, format: "date" },
        { header: "Asset Tag", key: "asset_tag", width: 16 },
        { header: "Asset Name", key: "asset_name", width: 26 },
        { header: "Scan Type", key: "scan_type", width: 14 },
        { header: "Device Source", key: "source", width: 20 },
        { header: "Operator", key: "operator_username", width: 20 },
        { header: "Company", key: "company_name", width: 22 },
        { header: "Result", key: "result", width: 14 },
        { header: "Notes", key: "notes", width: 24 },
      ];

      const meta: ExportMetadata = {
        title: "Physical QR & Barcode Scan Event Ledger Report",
        companyContext: this.getCompanyContextString(tenant),
        generatedBy: `${user.username} (${user.roleName})`,
        generatedAt: new Date().toISOString(),
        filtersApplied: filters,
        summaryMetrics: result.summary,
      };

      if (format === "csv") {
        return {
          type: "export",
          exportBuffer: exportService.generateCsv(columns, result.rows, meta),
          filename: `scan_report_${Date.now()}.csv`,
          contentType: "text/csv; charset=utf-8",
        };
      } else {
        return {
          type: "export",
          exportBuffer: await exportService.generateXlsx(columns, result.rows, meta),
          filename: `scan_report_${Date.now()}.xlsx`,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        };
      }
    }

    return {
      type: "json",
      data: result.rows,
      total: result.total,
      page: filters.page || 1,
      limit: filters.limit || 20,
      summary: result.summary,
    };
  }
}

export const reportsService = new ReportsService();
