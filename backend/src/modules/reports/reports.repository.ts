import { query } from "../../config/database";
import { TenantContext } from "../../middleware/tenant.middleware";
import { AuthUser } from "../../middleware/auth.middleware";

export interface ReportQueryResult<T> {
  rows: T[];
  total: number;
  summary?: Record<string, any>;
}

export class ReportsRepository {
  /**
   * Helper to build company and department tenant WHERE clauses.
   */
  private buildTenantScope(
    tenant: TenantContext,
    user: AuthUser,
    params: any[],
    tableCompanyCol = "company_id",
    tableDeptCol?: string
  ): string {
    const conditions: string[] = [];

    // 1. Company Scope
    if (!tenant.isGlobal && tenant.companyId) {
      params.push(tenant.companyId);
      conditions.push(`${tableCompanyCol} = $${params.length}`);
    }

    // 2. Department Manager Scope
    if (user.roleCode === "DEPT_MANAGER" && user.departmentId && tableDeptCol) {
      params.push(user.departmentId);
      conditions.push(`${tableDeptCol} = $${params.length}`);
    }

    return conditions.length > 0 ? conditions.join(" AND ") : "1=1";
  }

  // ===========================================================================
  // 1. EXECUTIVE DASHBOARD METRICS
  // ===========================================================================
  public async getDashboardMetrics(tenant: TenantContext, user: AuthUser): Promise<any> {
    const params: any[] = [];
    const assetScope = this.buildTenantScope(tenant, user, params, "company_id", "department_id");

    // 1. Asset & Valuation Aggregations
    const assetStatsRes = await query<any>(`
      SELECT 
        COUNT(*)::int as total_assets,
        COALESCE(SUM(purchase_cost), 0)::numeric as acquisition_cost,
        COALESCE(SUM(current_value), 0)::numeric as book_value,
        COALESCE(SUM(accumulated_depreciation), 0)::numeric as accumulated_depreciation,
        COUNT(*) FILTER (WHERE status = 'AVAILABLE')::int as available_assets,
        COUNT(*) FILTER (WHERE status = 'ASSIGNED')::int as assigned_assets,
        COUNT(*) FILTER (WHERE status = 'UNDER_MAINTENANCE')::int as under_maintenance,
        COUNT(*) FILTER (WHERE status = 'DAMAGED')::int as damaged_assets,
        COUNT(*) FILTER (WHERE status = 'IN_TRANSIT')::int as in_transit,
        COUNT(*) FILTER (WHERE status = 'DISPUTED')::int as disputed_assets,
        COUNT(*) FILTER (WHERE status = 'RETIRED')::int as retired_assets
      FROM assets
      WHERE ${assetScope}
    `, params);

    const assetStats = assetStatsRes.rows[0];

    // 2. Operational Counts
    // Total employees
    const empParams: any[] = [];
    const empScope = this.buildTenantScope(tenant, user, empParams, "company_id");
    const empRes = await query<any>(`SELECT COUNT(*)::int as total_employees FROM employees WHERE ${empScope}`, empParams);
    const totalEmployees = empRes.rows[0].total_employees;

    // Pending requests
    const reqParams: any[] = [];
    const reqScope = this.buildTenantScope(tenant, user, reqParams, "company_id", "department_id");
    const reqRes = await query<any>(`
      SELECT COUNT(*)::int as pending_requests 
      FROM asset_requests 
      WHERE ${reqScope} AND status IN ('PENDING', 'PENDING_APPROVAL', 'SUBMITTED')
    `, reqParams);
    const pendingRequests = reqRes.rows[0].pending_requests;

    // Pending approvals
    const appParams: any[] = [];
    const appScope = this.buildTenantScope(tenant, user, appParams, "ar.company_id", "ar.department_id");
    const appRes = await query<any>(`
      SELECT COUNT(*)::int as pending_approvals
      FROM asset_request_approvals ara
      JOIN asset_requests ar ON ara.request_id = ar.id
      WHERE ${appScope} 
        AND ara.status = 'PENDING'
    `, appParams);
    const pendingApprovals = appRes.rows[0].pending_approvals;

    // Open maintenance work orders
    const maintParams: any[] = [];
    const maintScope = this.buildTenantScope(tenant, user, maintParams, "company_id");
    const maintRes = await query<any>(`
      SELECT COUNT(*)::int as open_maintenance
      FROM maintenance_records
      WHERE ${maintScope} AND status IN ('OPEN', 'REPORTED', 'APPROVED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS')
    `, maintParams);
    const openMaintenance = maintRes.rows[0].open_maintenance;

    // Transfers
    const trfParams: any[] = [];
    let trfScope = "1=1";
    if (!tenant.isGlobal && tenant.companyId) {
      trfParams.push(tenant.companyId);
      trfScope = `(from_company_id = $${trfParams.length} OR to_company_id = $${trfParams.length})`;
    }
    const trfRes = await query<any>(`
      SELECT 
        COUNT(*) FILTER (WHERE transfer_type != 'INTER_COMPANY')::int as internal_transfers,
        COUNT(*) FILTER (WHERE transfer_type = 'INTER_COMPANY')::int as inter_company_transfers
      FROM asset_transfers
      WHERE ${trfScope}
    `, trfParams);
    const internalTransfers = trfRes.rows[0].internal_transfers;
    const interCompanyTransfers = trfRes.rows[0].inter_company_transfers;

    // Low stock items
    const stockParams: any[] = [];
    const stockScope = this.buildTenantScope(tenant, user, stockParams, "company_id");
    const stockRes = await query<any>(`
      SELECT COUNT(*)::int as low_stock_items
      FROM stock_items
      WHERE ${stockScope} AND quantity_on_hand <= minimum_quantity
    `, stockParams);
    const lowStockItems = stockRes.rows[0].low_stock_items;

    // Recent scans
    const scanCountParams: any[] = [];
    const scanCountScope = this.buildTenantScope(tenant, user, scanCountParams, "company_id");
    const scanCountRes = await query<any>(`SELECT COUNT(*)::int as total_scans FROM asset_scans WHERE ${scanCountScope}`, scanCountParams);
    const totalScans = scanCountRes.rows[0].total_scans;

    const recentScanParams: any[] = [];
    const recentScanScope = this.buildTenantScope(tenant, user, recentScanParams, "s.company_id");
    const recentScansRes = await query<any>(`
      SELECT s.id, s.scan_type, s.source, s.scanned_at, a.asset_tag, a.name as asset_name, u.username as scanned_by
      FROM asset_scans s
      JOIN assets a ON s.asset_id = a.id
      JOIN users u ON s.scanned_by = u.id
      WHERE ${recentScanScope}
      ORDER BY s.scanned_at DESC
      LIMIT 5
    `, recentScanParams);

    // Global Company Breakdown (if Common Admin viewing globally)
    let companyBreakdown: any[] = [];
    if (tenant.isGlobal) {
      const breakdownRes = await query<any>(`
        SELECT 
          c.id as company_id,
          c.name as company_name,
          c.code as company_code,
          COUNT(a.id)::int as total_assets,
          COALESCE(SUM(a.purchase_cost), 0)::numeric as acquisition_cost,
          COALESCE(SUM(a.current_value), 0)::numeric as book_value,
          COALESCE(SUM(a.accumulated_depreciation), 0)::numeric as accumulated_depreciation,
          COUNT(a.id) FILTER (WHERE a.status = 'AVAILABLE')::int as available_assets,
          COUNT(a.id) FILTER (WHERE a.status = 'ASSIGNED')::int as assigned_assets,
          COUNT(a.id) FILTER (WHERE a.status = 'UNDER_MAINTENANCE')::int as under_maintenance
        FROM companies c
        LEFT JOIN assets a ON c.id = a.company_id
        WHERE c.is_active = true
        GROUP BY c.id, c.name, c.code
        ORDER BY c.name
      `);
      companyBreakdown = breakdownRes.rows;
    }

    return {
      assets: {
        total: assetStats.total_assets,
        acquisitionCost: Number(assetStats.acquisition_cost),
        bookValue: Number(assetStats.book_value),
        accumulatedDepreciation: Number(assetStats.accumulated_depreciation),
        available: assetStats.available_assets,
        assigned: assetStats.assigned_assets,
        underMaintenance: assetStats.under_maintenance,
        damaged: assetStats.damaged_assets,
        inTransit: assetStats.in_transit,
        disputed: assetStats.disputed_assets,
        retired: assetStats.retired_assets,
      },
      operations: {
        totalEmployees,
        assetsAssigned: assetStats.assigned_assets,
        pendingRequests,
        pendingApprovals,
        openMaintenance,
        internalTransfers,
        interCompanyTransfers,
        lowStockItems,
        totalScans,
      },
      recentScans: recentScansRes.rows,
      companyBreakdown: companyBreakdown.length > 0 ? companyBreakdown : undefined,
    };
  }

  // ===========================================================================
  // 2. ASSET REGISTER REPORT
  // ===========================================================================
  public async getAssetRegisterReport(filters: any, tenant: TenantContext, user: AuthUser): Promise<ReportQueryResult<any>> {
    const params: any[] = [];
    const conditions: string[] = [];

    // Tenant / Company scoping
    if (!tenant.isGlobal && tenant.companyId) {
      params.push(tenant.companyId);
      conditions.push(`a.company_id = $${params.length}`);
    } else if (filters.companyId) {
      params.push(filters.companyId);
      conditions.push(`a.company_id = $${params.length}`);
    }

    // Department scope
    if (user.roleCode === "DEPT_MANAGER" && user.departmentId) {
      if (filters.departmentId && filters.departmentId !== user.departmentId) {
        conditions.push("1=0");
      } else {
        params.push(user.departmentId);
        conditions.push(`a.department_id = $${params.length}`);
      }
    } else if (filters.departmentId) {
      params.push(filters.departmentId);
      conditions.push(`a.department_id = $${params.length}`);
    }

    if (filters.branchId) {
      params.push(filters.branchId);
      conditions.push(`a.branch_id = $${params.length}`);
    }
    if (filters.categoryId) {
      params.push(filters.categoryId);
      conditions.push(`a.category_id = $${params.length}`);
    }
    if (filters.vendorId) {
      params.push(filters.vendorId);
      conditions.push(`a.vendor_id = $${params.length}`);
    }
    if (filters.locationId) {
      params.push(filters.locationId);
      conditions.push(`a.location_id = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`a.status = $${params.length}`);
    }
    if (filters.condition) {
      params.push(filters.condition);
      conditions.push(`a.condition = $${params.length}`);
    }
    if (filters.custodianId) {
      params.push(filters.custodianId);
      conditions.push(`a.assigned_employee_id = $${params.length}`);
    }
    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      conditions.push(`a.purchase_date >= $${params.length}`);
    }
    if (filters.dateTo) {
      params.push(filters.dateTo);
      conditions.push(`a.purchase_date <= $${params.length}`);
    }
    if (filters.minValue !== undefined) {
      params.push(filters.minValue);
      conditions.push(`a.purchase_cost >= $${params.length}`);
    }
    if (filters.maxValue !== undefined) {
      params.push(filters.maxValue);
      conditions.push(`a.purchase_cost <= $${params.length}`);
    }
    if (filters.depreciationStatus === "FULLY_DEPRECIATED") {
      conditions.push(`(a.current_value <= 0 OR a.accumulated_depreciation >= a.purchase_cost)`);
    } else if (filters.depreciationStatus === "DEPRECIATING") {
      conditions.push(`(a.current_value > 0 AND a.accumulated_depreciation < a.purchase_cost)`);
    }
    if (filters.search) {
      params.push(`%${filters.search}%`);
      conditions.push(`(a.name ILIKE $${params.length} OR a.asset_tag ILIKE $${params.length} OR a.serial_number ILIKE $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count and summary
    const countRes = await query<any>(`
      SELECT 
        COUNT(*)::int as total,
        COALESCE(SUM(a.purchase_cost), 0)::numeric as total_gross_value,
        COALESCE(SUM(a.current_value), 0)::numeric as total_book_value,
        COALESCE(SUM(a.accumulated_depreciation), 0)::numeric as total_accumulated_depreciation
      FROM assets a
      ${whereClause}
    `, params);

    const total = countRes.rows[0].total;
    const summary = {
      totalAssets: total,
      totalGrossValue: Number(countRes.rows[0].total_gross_value),
      totalBookValue: Number(countRes.rows[0].total_book_value),
      totalAccumulatedDepreciation: Number(countRes.rows[0].total_accumulated_depreciation),
    };

    // Sort column sanitization
    const validSortCols: Record<string, string> = {
      tag: "a.asset_tag",
      name: "a.name",
      purchaseDate: "a.purchase_date",
      purchaseCost: "a.purchase_cost",
      bookValue: "a.current_value",
      status: "a.status",
      company: "comp.name",
      createdAt: "a.created_at",
    };
    const sortCol = validSortCols[filters.sortBy || ""] || "a.created_at";
    const sortDir = (filters.sortOrder || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

    // Pagination
    const page = Math.max(1, filters.page || 1);
    const limit = filters.format && filters.format !== "json" ? 50000 : Math.max(1, filters.limit || 20);
    const offset = (page - 1) * limit;

    const dataParams = [...params, limit, offset];
    const dataRes = await query<any>(`
      SELECT 
        a.id,
        a.asset_tag,
        a.name,
        c.name as category_name,
        comp.name as company_name,
        comp.code as company_code,
        b.name as branch_name,
        d.name as department_name,
        CONCAT_WS(' - ', l.building, l.floor, l.room_number) as location_name,
        v.name as vendor_name,
        a.purchase_date,
        a.purchase_cost,
        a.depreciation_method,
        a.useful_life_months,
        a.accumulated_depreciation,
        a.current_value as current_book_value,
        a.status,
        a.condition,
        CONCAT(emp.first_name, ' ', emp.last_name) as custodian_name,
        emp.employee_code as custodian_code
      FROM assets a
      LEFT JOIN asset_categories c ON a.category_id = c.id
      LEFT JOIN companies comp ON a.company_id = comp.id
      LEFT JOIN branches b ON a.branch_id = b.id
      LEFT JOIN departments d ON a.department_id = d.id
      LEFT JOIN locations l ON a.location_id = l.id
      LEFT JOIN vendors v ON a.vendor_id = v.id
      LEFT JOIN employees emp ON a.assigned_employee_id = emp.id
      ${whereClause}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `, dataParams);

    return {
      rows: dataRes.rows,
      total,
      summary,
    };
  }

  // ===========================================================================
  // 3. DEPRECIATION REPORT
  // ===========================================================================
  public async getDepreciationReport(filters: any, tenant: TenantContext, _user: AuthUser): Promise<ReportQueryResult<any>> {
    const params: any[] = [];
    const conditions: string[] = [];

    if (!tenant.isGlobal && tenant.companyId) {
      params.push(tenant.companyId);
      conditions.push(`a.company_id = $${params.length}`);
    } else if (filters.companyId) {
      params.push(filters.companyId);
      conditions.push(`a.company_id = $${params.length}`);
    }

    if (filters.categoryId) {
      params.push(filters.categoryId);
      conditions.push(`a.category_id = $${params.length}`);
    }
    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      conditions.push(`a.purchase_date >= $${params.length}`);
    }
    if (filters.dateTo) {
      params.push(filters.dateTo);
      conditions.push(`a.purchase_date <= $${params.length}`);
    }

    if (filters.depreciationStatus === "FULLY_DEPRECIATED") {
      conditions.push(`(a.current_value <= 0 OR a.accumulated_depreciation >= a.purchase_cost)`);
    } else if (filters.depreciationStatus === "DEPRECIATING") {
      conditions.push(`(a.current_value > 0 AND a.accumulated_depreciation < a.purchase_cost)`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Aggregated Summary Totals
    const summaryRes = await query<any>(`
      SELECT 
        COUNT(*)::int as total_assets,
        COALESCE(SUM(a.purchase_cost), 0)::numeric as gross_asset_value,
        COALESCE(SUM(a.accumulated_depreciation), 0)::numeric as total_accumulated_depreciation,
        COALESCE(SUM(a.current_value), 0)::numeric as total_net_book_value,
        COALESCE(SUM(CASE WHEN a.useful_life_months > 0 THEN a.purchase_cost / a.useful_life_months ELSE 0 END), 0)::numeric as total_monthly_depreciation,
        COALESCE(SUM(CASE WHEN a.useful_life_months > 0 THEN (a.purchase_cost / a.useful_life_months) * 12 ELSE 0 END), 0)::numeric as total_annual_depreciation,
        COUNT(*) FILTER (WHERE a.current_value <= 0 OR a.accumulated_depreciation >= a.purchase_cost)::int as fully_depreciated_count,
        COUNT(*) FILTER (WHERE a.current_value > 0 AND a.accumulated_depreciation < a.purchase_cost)::int as active_depreciating_count
      FROM assets a
      ${whereClause}
    `, params);

    const s = summaryRes.rows[0];
    const total = s.total_assets;
    const monthlyDep = Number(Number(s.total_monthly_depreciation).toFixed(2));
    const summary = {
      totalAssets: total,
      grossAssetValue: Number(s.gross_asset_value),
      totalAccumulatedDepreciation: Number(s.total_accumulated_depreciation),
      totalNetBookValue: Number(s.total_net_book_value),
      totalMonthlyDepreciation: monthlyDep,
      totalAnnualDepreciation: Number((monthlyDep * 12).toFixed(2)),
      fullyDepreciatedCount: s.fully_depreciated_count,
      activeDepreciatingCount: s.active_depreciating_count,
    };

    // Rows
    const page = Math.max(1, filters.page || 1);
    const limit = filters.format && filters.format !== "json" ? 50000 : Math.max(1, filters.limit || 20);
    const offset = (page - 1) * limit;

    const dataParams = [...params, limit, offset];
    const dataRes = await query<any>(`
      SELECT 
        a.id,
        a.asset_tag,
        a.name,
        c.name as category_name,
        comp.name as company_name,
        a.purchase_date,
        a.purchase_cost,
        a.depreciation_method,
        a.useful_life_months,
        ROUND((CASE WHEN a.useful_life_months > 0 THEN a.purchase_cost / a.useful_life_months ELSE 0 END), 2) as monthly_depreciation,
        ROUND((CASE WHEN a.useful_life_months > 0 THEN (a.purchase_cost / a.useful_life_months) * 12 ELSE 0 END), 2) as annual_depreciation,
        a.accumulated_depreciation,
        a.current_value as current_book_value,
        CASE 
          WHEN a.current_value <= 0 OR a.accumulated_depreciation >= a.purchase_cost THEN 'FULLY_DEPRECIATED'
          ELSE 'DEPRECIATING'
        END as depreciation_status,
        GREATEST(0, a.useful_life_months - (
          (EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM a.purchase_date)) * 12 + 
          (EXTRACT(MONTH FROM CURRENT_DATE) - EXTRACT(MONTH FROM a.purchase_date))
        ))::int as remaining_useful_life_months
      FROM assets a
      LEFT JOIN asset_categories c ON a.category_id = c.id
      LEFT JOIN companies comp ON a.company_id = comp.id
      ${whereClause}
      ORDER BY a.purchase_date DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `, dataParams);

    return {
      rows: dataRes.rows,
      total,
      summary,
    };
  }

  // ===========================================================================
  // 4. ASSET TRANSFERS / MOVEMENT REPORT
  // ===========================================================================
  public async getTransfersReport(filters: any, tenant: TenantContext, user: AuthUser): Promise<ReportQueryResult<any>> {
    const params: any[] = [];
    const conditions: string[] = [];

    if (!tenant.isGlobal && tenant.companyId) {
      params.push(tenant.companyId);
      conditions.push(`(t.from_company_id = $${params.length} OR t.to_company_id = $${params.length})`);
    } else if (filters.companyId) {
      params.push(filters.companyId);
      conditions.push(`(t.from_company_id = $${params.length} OR t.to_company_id = $${params.length})`);
    }

    if (user.roleCode === "DEPT_MANAGER" && user.departmentId) {
      params.push(user.departmentId);
      conditions.push(`(t.from_department_id = $${params.length} OR t.to_department_id = $${params.length})`);
    }

    if (filters.transferType === "INTERNAL") {
      conditions.push(`t.transfer_type != 'INTER_COMPANY'`);
    } else if (filters.transferType === "INTER_COMPANY") {
      conditions.push(`t.transfer_type = 'INTER_COMPANY'`);
    } else if (filters.transferType && filters.transferType !== "ALL") {
      params.push(filters.transferType);
      conditions.push(`t.transfer_type = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`t.status = $${params.length}`);
    }
    if (filters.assetId) {
      params.push(filters.assetId);
      conditions.push(`t.asset_id = $${params.length}`);
    }
    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      conditions.push(`t.transfer_date >= $${params.length}`);
    }
    if (filters.dateTo) {
      params.push(filters.dateTo);
      conditions.push(`t.transfer_date <= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query<any>(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE t.status = 'COMPLETED')::int as completed_count,
        COUNT(*) FILTER (WHERE t.status = 'DISPATCHED')::int as in_transit_count,
        COUNT(*) FILTER (WHERE t.status = 'DISPUTED')::int as disputed_count,
        COUNT(*) FILTER (WHERE t.transfer_type = 'INTER_COMPANY')::int as inter_company_count,
        COUNT(*) FILTER (WHERE t.transfer_type != 'INTER_COMPANY')::int as internal_count
      FROM asset_transfers t
      ${whereClause}
    `, params);

    const total = countRes.rows[0].total;
    const summary = {
      totalTransfers: total,
      completedCount: countRes.rows[0].completed_count,
      inTransitCount: countRes.rows[0].in_transit_count,
      disputedCount: countRes.rows[0].disputed_count,
      interCompanyCount: countRes.rows[0].inter_company_count,
      internalCount: countRes.rows[0].internal_count,
    };

    const page = Math.max(1, filters.page || 1);
    const limit = filters.format && filters.format !== "json" ? 50000 : Math.max(1, filters.limit || 20);
    const offset = (page - 1) * limit;

    const dataParams = [...params, limit, offset];
    const dataRes = await query<any>(`
      SELECT 
        t.id,
        t.transfer_code,
        t.transfer_type,
        a.asset_tag,
        a.name as asset_name,
        fc.name as from_company_name,
        tc.name as to_company_name,
        fd.name as from_department_name,
        td.name as to_department_name,
        t.transfer_date,
        t.dispatch_date,
        t.actual_delivery_date,
        t.status,
        t.reason,
        t.condition_before,
        t.condition_after,
        t.dispute_reason,
        CONCAT(u.first_name, ' ', u.last_name) as requested_by_name,
        h.digital_signature_token as handover_signature_ref
      FROM asset_transfers t
      JOIN assets a ON t.asset_id = a.id
      JOIN companies fc ON t.from_company_id = fc.id
      JOIN companies tc ON t.to_company_id = tc.id
      LEFT JOIN departments fd ON t.from_department_id = fd.id
      LEFT JOIN departments td ON t.to_department_id = td.id
      LEFT JOIN users u_acc ON t.requested_by = u_acc.id
      LEFT JOIN employees u ON u_acc.employee_id = u.id
      LEFT JOIN handover_records h ON t.id = h.transfer_id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `, dataParams);

    return {
      rows: dataRes.rows,
      total,
      summary,
    };
  }

  // ===========================================================================
  // 5. CUSTODY & ASSIGNMENT REPORT
  // ===========================================================================
  public async getCustodyReport(filters: any, tenant: TenantContext, user: AuthUser): Promise<ReportQueryResult<any>> {
    const params: any[] = [];
    const conditions: string[] = [];

    if (!tenant.isGlobal && tenant.companyId) {
      params.push(tenant.companyId);
      conditions.push(`aa.company_id = $${params.length}`);
    } else if (filters.companyId) {
      params.push(filters.companyId);
      conditions.push(`aa.company_id = $${params.length}`);
    }

    if (user.roleCode === "DEPT_MANAGER" && user.departmentId) {
      if (filters.departmentId && filters.departmentId !== user.departmentId) {
        conditions.push("1=0");
      } else {
        params.push(user.departmentId);
        conditions.push(`aa.department_id = $${params.length}`);
      }
    } else if (filters.departmentId) {
      params.push(filters.departmentId);
      conditions.push(`aa.department_id = $${params.length}`);
    }

    if (filters.employeeId) {
      params.push(filters.employeeId);
      conditions.push(`aa.employee_id = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`aa.status = $${params.length}`);
    }
    if (filters.isOverdue === "true" || filters.isOverdue === "1") {
      conditions.push(`(aa.status = 'ACTIVE' AND aa.return_due_date < CURRENT_DATE)`);
    }
    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      conditions.push(`aa.assigned_at >= $${params.length}`);
    }
    if (filters.dateTo) {
      params.push(filters.dateTo);
      conditions.push(`aa.assigned_at <= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query<any>(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE aa.status = 'ACTIVE')::int as active_custody,
        COUNT(*) FILTER (WHERE aa.status = 'RETURNED')::int as returned_count,
        COUNT(*) FILTER (WHERE aa.status = 'ACTIVE' AND aa.return_due_date < CURRENT_DATE)::int as overdue_count
      FROM asset_assignments aa
      ${whereClause}
    `, params);

    const total = countRes.rows[0].total;
    const summary = {
      totalAssignments: total,
      activeCustody: countRes.rows[0].active_custody,
      returnedCount: countRes.rows[0].returned_count,
      overdueCount: countRes.rows[0].overdue_count,
    };

    const page = Math.max(1, filters.page || 1);
    const limit = filters.format && filters.format !== "json" ? 50000 : Math.max(1, filters.limit || 20);
    const offset = (page - 1) * limit;

    const dataParams = [...params, limit, offset];
    const dataRes = await query<any>(`
      SELECT 
        aa.id,
        a.asset_tag,
        a.name as asset_name,
        e.employee_code,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        d.name as department_name,
        comp.name as company_name,
        aa.assigned_at,
        aa.return_due_date,
        aa.condition_at_assignment,
        aa.status,
        CASE 
          WHEN aa.status = 'ACTIVE' AND aa.return_due_date < CURRENT_DATE THEN true
          ELSE false
        END as is_overdue,
        ar.returned_at,
        ar.condition as return_condition,
        di.severity as damage_severity,
        di.description as damage_report
      FROM asset_assignments aa
      JOIN assets a ON aa.asset_id = a.id
      JOIN employees e ON aa.employee_id = e.id
      JOIN companies comp ON aa.company_id = comp.id
      LEFT JOIN departments d ON aa.department_id = d.id
      LEFT JOIN asset_returns ar ON aa.id = ar.assignment_id
      LEFT JOIN damage_inspections di ON ar.id = di.return_id
      ${whereClause}
      ORDER BY aa.assigned_at DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `, dataParams);

    return {
      rows: dataRes.rows,
      total,
      summary,
    };
  }

  // ===========================================================================
  // 6. MAINTENANCE REPORT
  // ===========================================================================
  public async getMaintenanceReport(filters: any, tenant: TenantContext, user: AuthUser): Promise<ReportQueryResult<any>> {
    const params: any[] = [];
    const conditions: string[] = [];

    if (!tenant.isGlobal && tenant.companyId) {
      params.push(tenant.companyId);
      conditions.push(`m.company_id = $${params.length}`);
    } else if (filters.companyId) {
      params.push(filters.companyId);
      conditions.push(`m.company_id = $${params.length}`);
    }

    if (user.roleCode === "DEPT_MANAGER" && user.departmentId) {
      if (filters.departmentId && filters.departmentId !== user.departmentId) {
        conditions.push("1=0");
      } else {
        params.push(user.departmentId);
        conditions.push(`a.department_id = $${params.length}`);
      }
    } else if (filters.departmentId) {
      params.push(filters.departmentId);
      conditions.push(`a.department_id = $${params.length}`);
    }

    if (filters.vendorId) {
      params.push(filters.vendorId);
      conditions.push(`m.vendor_id = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`m.status = $${params.length}`);
    }
    if (filters.priority) {
      params.push(filters.priority);
      conditions.push(`m.priority = $${params.length}`);
    }
    if (filters.assetId) {
      params.push(filters.assetId);
      conditions.push(`m.asset_id = $${params.length}`);
    }
    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      conditions.push(`m.created_at >= $${params.length}`);
    }
    if (filters.dateTo) {
      params.push(filters.dateTo);
      conditions.push(`m.created_at <= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query<any>(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE m.status IN ('OPEN', 'REPORTED', 'APPROVED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS'))::int as open_orders,
        COUNT(*) FILTER (WHERE m.status = 'COMPLETED')::int as completed_orders,
        COUNT(*) FILTER (WHERE m.status = 'CLOSED')::int as closed_orders,
        COALESCE(SUM(m.actual_cost), 0)::numeric as total_cost,
        COALESCE(AVG(m.actual_cost), 0)::numeric as avg_cost
      FROM maintenance_records m
      JOIN assets a ON m.asset_id = a.id
      ${whereClause}
    `, params);

    const s = countRes.rows[0];
    const total = s.total;

    // Assets with repeated maintenance (> 1 work order)
    const repeatRes = await query<any>(`
      SELECT COUNT(*)::int as repeat_assets_count
      FROM (
        SELECT asset_id 
        FROM maintenance_records m
        JOIN assets a ON m.asset_id = a.id
        ${whereClause}
        GROUP BY asset_id
        HAVING COUNT(*) > 1
      ) sub
    `, params);

    const summary = {
      totalWorkOrders: total,
      openOrders: s.open_orders,
      completedOrders: s.completed_orders,
      closedOrders: s.closed_orders,
      totalCost: Number(s.total_cost),
      avgCost: Number(Number(s.avg_cost).toFixed(2)),
      repeatedMaintenanceAssets: repeatRes.rows[0].repeat_assets_count,
    };

    const page = Math.max(1, filters.page || 1);
    const limit = filters.format && filters.format !== "json" ? 50000 : Math.max(1, filters.limit || 20);
    const offset = (page - 1) * limit;

    const dataParams = [...params, limit, offset];
    const dataRes = await query<any>(`
      SELECT 
        m.id,
        m.maintenance_code,
        m.work_order_number,
        a.asset_tag,
        a.name as asset_name,
        comp.name as company_name,
        d.name as department_name,
        m.problem,
        m.priority,
        m.status,
        v.name as vendor_name,
        m.technician_name,
        m.estimated_cost,
        m.actual_cost,
        m.report_date,
        m.created_at,
        m.closed_at
      FROM maintenance_records m
      JOIN assets a ON m.asset_id = a.id
      JOIN companies comp ON m.company_id = comp.id
      LEFT JOIN departments d ON a.department_id = d.id
      LEFT JOIN vendors v ON m.vendor_id = v.id
      ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `, dataParams);

    return {
      rows: dataRes.rows,
      total,
      summary,
    };
  }

  // ===========================================================================
  // 7. STOCK REPORT
  // ===========================================================================
  public async getStockReport(filters: any, tenant: TenantContext, _user: AuthUser): Promise<ReportQueryResult<any>> {
    const params: any[] = [];
    const conditions: string[] = [];

    if (!tenant.isGlobal && tenant.companyId) {
      params.push(tenant.companyId);
      conditions.push(`s.company_id = $${params.length}`);
    } else if (filters.companyId) {
      params.push(filters.companyId);
      conditions.push(`s.company_id = $${params.length}`);
    }

    if (filters.branchId) {
      params.push(filters.branchId);
      conditions.push(`s.branch_id = $${params.length}`);
    }
    if (filters.categoryId) {
      params.push(filters.categoryId);
      conditions.push(`s.category_id = $${params.length}`);
    }
    if (filters.stockStatus === "LOW_STOCK" || filters.lowStockOnly === "true" || filters.lowStockOnly === "1") {
      conditions.push(`s.quantity_on_hand <= s.minimum_quantity`);
    } else if (filters.stockStatus === "OUT_OF_STOCK") {
      conditions.push(`s.quantity_on_hand <= 0`);
    } else if (filters.stockStatus === "IN_STOCK") {
      conditions.push(`s.quantity_on_hand > s.minimum_quantity`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query<any>(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE s.quantity_on_hand <= s.minimum_quantity)::int as low_stock_items,
        COALESCE(SUM(s.quantity_on_hand), 0)::int as total_quantity,
        COALESCE(SUM(s.quantity_on_hand * s.unit_cost), 0)::numeric as total_stock_value
      FROM stock_items s
      ${whereClause}
    `, params);

    const s = countRes.rows[0];
    const total = s.total;
    const summary = {
      totalStockItems: total,
      lowStockItems: s.low_stock_items,
      totalQuantity: s.total_quantity,
      totalStockValue: Number(s.total_stock_value),
    };

    const page = Math.max(1, filters.page || 1);
    const limit = filters.format && filters.format !== "json" ? 50000 : Math.max(1, filters.limit || 20);
    const offset = (page - 1) * limit;

    const dataParams = [...params, limit, offset];
    const dataRes = await query<any>(`
      SELECT 
        s.id,
        s.stock_code,
        s.item_name,
        ac.name as category_name,
        b.name as branch_name,
        comp.name as company_name,
        s.quantity_on_hand as current_quantity,
        s.minimum_quantity,
        s.maximum_quantity,
        s.unit_cost,
        (s.quantity_on_hand * s.unit_cost) as total_value,
        CASE 
          WHEN s.quantity_on_hand <= 0 THEN 'OUT_OF_STOCK'
          WHEN s.quantity_on_hand <= s.minimum_quantity THEN 'LOW_STOCK'
          ELSE 'IN_STOCK'
        END as stock_status,
        s.status,
        s.updated_at as last_updated
      FROM stock_items s
      JOIN companies comp ON s.company_id = comp.id
      LEFT JOIN asset_categories ac ON s.category_id = ac.id
      LEFT JOIN branches b ON s.branch_id = b.id
      ${whereClause}
      ORDER BY s.item_name ASC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `, dataParams);

    return {
      rows: dataRes.rows,
      total,
      summary,
    };
  }

  // ===========================================================================
  // 8. REQUESTS / APPROVALS REPORT
  // ===========================================================================
  public async getRequestsReport(filters: any, tenant: TenantContext, user: AuthUser): Promise<ReportQueryResult<any>> {
    const params: any[] = [];
    const conditions: string[] = [];

    if (!tenant.isGlobal && tenant.companyId) {
      params.push(tenant.companyId);
      conditions.push(`r.company_id = $${params.length}`);
    } else if (filters.companyId) {
      params.push(filters.companyId);
      conditions.push(`r.company_id = $${params.length}`);
    }

    if (user.roleCode === "DEPT_MANAGER" && user.departmentId) {
      if (filters.departmentId && filters.departmentId !== user.departmentId) {
        conditions.push("1=0");
      } else {
        params.push(user.departmentId);
        conditions.push(`r.department_id = $${params.length}`);
      }
    } else if (filters.departmentId) {
      params.push(filters.departmentId);
      conditions.push(`r.department_id = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`r.status = $${params.length}`);
    }
    if (filters.priority) {
      params.push(filters.priority);
      conditions.push(`r.priority = $${params.length}`);
    }
    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      conditions.push(`r.created_at >= $${params.length}`);
    }
    if (filters.dateTo) {
      params.push(filters.dateTo);
      conditions.push(`r.created_at <= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query<any>(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE r.status IN ('PENDING', 'PENDING_APPROVAL', 'SUBMITTED'))::int as pending_count,
        COUNT(*) FILTER (WHERE r.status = 'APPROVED')::int as approved_count,
        COUNT(*) FILTER (WHERE r.status = 'REJECTED')::int as rejected_count,
        COUNT(*) FILTER (WHERE r.status = 'FULFILLED')::int as fulfilled_count,
        COUNT(*) FILTER (WHERE r.status = 'CANCELLED')::int as cancelled_count
      FROM asset_requests r
      ${whereClause}
    `, params);

    const s = countRes.rows[0];
    const total = s.total;
    const summary = {
      totalRequests: total,
      pendingCount: s.pending_count,
      approvedCount: s.approved_count,
      rejectedCount: s.rejected_count,
      fulfilledCount: s.fulfilled_count,
      cancelledCount: s.cancelled_count,
    };

    const page = Math.max(1, filters.page || 1);
    const limit = filters.format && filters.format !== "json" ? 50000 : Math.max(1, filters.limit || 20);
    const offset = (page - 1) * limit;

    const dataParams = [...params, limit, offset];
    const dataRes = await query<any>(`
      SELECT 
        r.id,
        COALESCE(r.request_number, r.request_code) as request_number,
        CONCAT(e.first_name, ' ', e.last_name) as requester_name,
        d.name as department_name,
        comp.name as company_name,
        r.created_at as request_date,
        r.priority,
        r.status,
        r.justification as reason,
        r.current_approval_level,
        r.fulfilled_at,
        fa.asset_tag as fulfilled_asset_tag
      FROM asset_requests r
      JOIN companies comp ON r.company_id = comp.id
      JOIN employees e ON r.employee_id = e.id
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN assets fa ON r.fulfilled_asset_id = fa.id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `, dataParams);

    return {
      rows: dataRes.rows,
      total,
      summary,
    };
  }

  // ===========================================================================
  // 9. AUDIT REPORT
  // ===========================================================================
  public async getAuditReport(filters: any, tenant: TenantContext, _user: AuthUser): Promise<ReportQueryResult<any>> {
    const params: any[] = [];
    const conditions: string[] = [];

    if (!tenant.isGlobal && tenant.companyId) {
      params.push(tenant.companyId);
      conditions.push(`al.company_id = $${params.length}`);
    } else if (filters.companyId) {
      params.push(filters.companyId);
      conditions.push(`al.company_id = $${params.length}`);
    }

    if (filters.userId) {
      params.push(filters.userId);
      conditions.push(`al.user_id = $${params.length}`);
    }
    if (filters.action) {
      params.push(filters.action);
      conditions.push(`al.action = $${params.length}`);
    }
    if (filters.entity) {
      params.push(filters.entity);
      conditions.push(`al.entity = $${params.length}`);
    }
    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      conditions.push(`al.timestamp >= $${params.length}`);
    }
    if (filters.dateTo) {
      params.push(filters.dateTo);
      conditions.push(`al.timestamp <= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query<any>(`
      SELECT COUNT(*)::int as total
      FROM audit_logs al
      ${whereClause}
    `, params);

    const total = countRes.rows[0].total;

    const page = Math.max(1, filters.page || 1);
    const limit = filters.format && filters.format !== "json" ? 50000 : Math.max(1, filters.limit || 20);
    const offset = (page - 1) * limit;

    const dataParams = [...params, limit, offset];
    const dataRes = await query<any>(`
      SELECT 
        al.id,
        al.timestamp,
        u.username as actor_username,
        comp.name as company_name,
        al.action,
        al.entity,
        al.entity_id,
        al.ip_address,
        al.user_agent
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN companies comp ON al.company_id = comp.id
      ${whereClause}
      ORDER BY al.timestamp DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `, dataParams);

    return {
      rows: dataRes.rows,
      total,
      summary: { totalAuditEvents: total },
    };
  }

  // ===========================================================================
  // 10. SCANS REPORT
  // ===========================================================================
  public async getScansReport(filters: any, tenant: TenantContext, _user: AuthUser): Promise<ReportQueryResult<any>> {
    const params: any[] = [];
    const conditions: string[] = [];

    if (!tenant.isGlobal && tenant.companyId) {
      params.push(tenant.companyId);
      conditions.push(`sc.company_id = $${params.length}`);
    } else if (filters.companyId) {
      params.push(filters.companyId);
      conditions.push(`sc.company_id = $${params.length}`);
    }

    if (filters.scanType && filters.scanType !== "ALL") {
      params.push(filters.scanType);
      conditions.push(`sc.scan_type = $${params.length}`);
    }
    if (filters.source && filters.source !== "ALL") {
      params.push(filters.source);
      conditions.push(`sc.source = $${params.length}`);
    }
    if (filters.assetId) {
      params.push(filters.assetId);
      conditions.push(`sc.asset_id = $${params.length}`);
    }
    if (filters.userId) {
      params.push(filters.userId);
      conditions.push(`sc.scanned_by = $${params.length}`);
    }
    if (filters.dateFrom) {
      params.push(filters.dateFrom);
      conditions.push(`sc.scanned_at >= $${params.length}`);
    }
    if (filters.dateTo) {
      params.push(filters.dateTo);
      conditions.push(`sc.scanned_at <= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query<any>(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE sc.scan_type = 'QR')::int as qr_scans,
        COUNT(*) FILTER (WHERE sc.scan_type = 'BARCODE')::int as barcode_scans,
        COUNT(*) FILTER (WHERE sc.scan_type = 'MANUAL')::int as manual_scans
      FROM asset_scans sc
      ${whereClause}
    `, params);

    const s = countRes.rows[0];
    const total = s.total;

    // Scan failure count from audit_logs
    const failParams: any[] = [];
    let failScope = "action = 'ASSET_SCAN_FAILED'";
    if (!tenant.isGlobal && tenant.companyId) {
      failParams.push(tenant.companyId);
      failScope += ` AND company_id = $${failParams.length}`;
    }
    const failRes = await query<any>(`SELECT COUNT(*)::int as failed_scans FROM audit_logs WHERE ${failScope}`, failParams);
    const failedScans = failRes.rows[0].failed_scans;

    const summary = {
      totalScans: total,
      qrScans: s.qr_scans,
      barcodeScans: s.barcode_scans,
      manualScans: s.manual_scans,
      failedScans,
    };

    const page = Math.max(1, filters.page || 1);
    const limit = filters.format && filters.format !== "json" ? 50000 : Math.max(1, filters.limit || 20);
    const offset = (page - 1) * limit;

    const dataParams = [...params, limit, offset];
    const dataRes = await query<any>(`
      SELECT 
        sc.id,
        sc.scanned_at as scan_time,
        a.asset_tag,
        a.name as asset_name,
        sc.scan_type,
        sc.source,
        u.username as operator_username,
        comp.name as company_name,
        'SUCCESS' as result,
        COALESCE(sc.metadata->>'notes', sc.scan_value) as notes
      FROM asset_scans sc
      JOIN assets a ON sc.asset_id = a.id
      JOIN companies comp ON sc.company_id = comp.id
      JOIN users u ON sc.scanned_by = u.id
      ${whereClause}
      ORDER BY sc.scanned_at DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `, dataParams);

    return {
      rows: dataRes.rows,
      total,
      summary,
    };
  }
}

export const reportsRepository = new ReportsRepository();
