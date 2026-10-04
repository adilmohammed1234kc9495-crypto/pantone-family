import { query } from "../../config/database";
import { AuthUser } from "../../middleware/auth.middleware";

export interface DashboardStats {
  scope: "GLOBAL" | "COMPANY";
  company_id: string | null;
  companies: {
    total: number;
    active: number;
    inactive: number;
  };
  users: {
    total: number;
    active: number;
    inactive: number;
  };
  assets: {
    total: number;
    total_valuation: number;
    by_status: Record<string, number>;
  };
  operations: {
    pending_approvals: number;
    active_transfers: number;
    pending_inter_company_transfers: number;
    active_maintenance: number;
  };
  company_summaries?: Array<{
    id: string;
    code: string;
    name: string;
    is_active: boolean;
    asset_count: number;
    user_count: number;
    branch_count: number;
  }>;
  recent_activity: Array<{
    id: string;
    action: string;
    entity: string;
    entity_id: string | null;
    timestamp: string;
    actor_username: string | null;
    company_name: string | null;
    company_code: string | null;
  }>;
}

export class DashboardService {
  async getStats(actor: AuthUser, explicitCompanyId?: string | null): Promise<DashboardStats> {
    const isGlobal = actor.isCommonAdmin && !explicitCompanyId;
    const companyId = isGlobal ? null : (explicitCompanyId || actor.companyId);

    // 1. Companies metrics
    let companiesCount = { total: 0, active: 0, inactive: 0 };
    if (isGlobal) {
      const compRes = await query<{ is_active: boolean; count: number }>(`
        SELECT is_active, COUNT(*)::int as count
        FROM companies
        GROUP BY is_active
      `);
      let active = 0;
      let inactive = 0;
      for (const row of compRes.rows) {
        if (row.is_active) active = row.count;
        else inactive = row.count;
      }
      companiesCount = {
        total: active + inactive,
        active,
        inactive
      };
    } else {
      const compRes = await query<{ is_active: boolean }>(
        "SELECT is_active FROM companies WHERE id = $1",
        [companyId]
      );
      if (compRes.rows.length > 0) {
        const isActive = compRes.rows[0].is_active;
        companiesCount = {
          total: 1,
          active: isActive ? 1 : 0,
          inactive: isActive ? 0 : 1
        };
      }
    }

    // 2. Users metrics
    const usersCountSql = `
      SELECT is_active, COUNT(*)::int as count 
      FROM users 
      ${companyId ? "WHERE company_id = $1" : ""}
      GROUP BY is_active
    `;
    const usersCountRes = await query<{ is_active: boolean; count: number }>(
      usersCountSql,
      companyId ? [companyId] : []
    );
    let usersActive = 0;
    let usersInactive = 0;
    for (const row of usersCountRes.rows) {
      if (row.is_active) usersActive += row.count;
      else usersInactive += row.count;
    }
    const usersCount = {
      total: usersActive + usersInactive,
      active: usersActive,
      inactive: usersInactive
    };

    // 3. Assets metrics
    const assetWhere = companyId ? "WHERE company_id = $1" : "";
    const assetParams = companyId ? [companyId] : [];

    const assetStatusRes = await query<{ status: string; count: number }>(`
      SELECT status, COUNT(*)::int as count
      FROM assets
      ${assetWhere}
      GROUP BY status
    `, assetParams);

    const byStatus: Record<string, number> = {};
    let totalAssets = 0;
    for (const row of assetStatusRes.rows) {
      byStatus[row.status] = row.count;
      totalAssets += row.count;
    }

    const assetValuationRes = await query<{ sum: string | null }>(`
      SELECT COALESCE(SUM(current_value), 0)::numeric as sum
      FROM assets
      ${assetWhere}
    `, assetParams);
    const totalValuation = parseFloat(assetValuationRes.rows[0]?.sum || "0");

    // 4. Operations metrics
    // Pending requests
    const reqWhere = companyId ? "WHERE company_id = $1 AND status = 'PENDING'" : "WHERE status = 'PENDING'";
    const reqRes = await query<{ count: number }>(`
      SELECT COUNT(*)::int as count FROM asset_requests ${reqWhere}
    `, assetParams);
    const pendingApprovals = reqRes.rows[0]?.count || 0;

    // Active transfers
    const transferWhere = companyId 
      ? "WHERE (from_company_id = $1 OR to_company_id = $1) AND status IN ('INITIATED', 'PENDING_APPROVAL', 'APPROVED', 'DISPATCHED', 'HANDOVER_PENDING')"
      : "WHERE status IN ('INITIATED', 'PENDING_APPROVAL', 'APPROVED', 'DISPATCHED', 'HANDOVER_PENDING')";
    const transferRes = await query<{ count: number }>(`
      SELECT COUNT(*)::int as count FROM asset_transfers ${transferWhere}
    `, assetParams);
    const activeTransfers = transferRes.rows[0]?.count || 0;

    // Pending inter-company transfers
    const interWhere = companyId
      ? "WHERE (from_company_id = $1 OR to_company_id = $1) AND status = 'PENDING_RECEIPT'"
      : "WHERE status = 'PENDING_RECEIPT'";
    const interRes = await query<{ count: number }>(`
      SELECT COUNT(*)::int as count FROM inter_company_transfers ${interWhere}
    `, assetParams);
    const pendingInterCompany = interRes.rows[0]?.count || 0;

    // Active maintenance
    const maintWhere = companyId
      ? "WHERE company_id = $1 AND status IN ('REPORTED', 'APPROVED', 'IN_PROGRESS')"
      : "WHERE status IN ('REPORTED', 'APPROVED', 'IN_PROGRESS')";
    const maintRes = await query<{ count: number }>(`
      SELECT COUNT(*)::int as count FROM maintenance_records ${maintWhere}
    `, assetParams);
    const activeMaintenance = maintRes.rows[0]?.count || 0;

    // 5. Company Summaries (Global only)
    let companySummaries: DashboardStats["company_summaries"] = undefined;
    if (isGlobal) {
      const summaryRes = await query<{
        id: string;
        code: string;
        name: string;
        is_active: boolean;
        asset_count: number;
        user_count: number;
        branch_count: number;
      }>(`
        SELECT 
          c.id,
          c.code,
          c.name,
          c.is_active,
          (SELECT COUNT(*)::int FROM assets a WHERE a.company_id = c.id) as asset_count,
          (SELECT COUNT(*)::int FROM users u WHERE u.company_id = c.id) as user_count,
          (SELECT COUNT(*)::int FROM branches b WHERE b.company_id = c.id) as branch_count
        FROM companies c
        ORDER BY c.created_at ASC
      `);
      companySummaries = summaryRes.rows;
    }

    // 6. Recent activity (last 10 events)
    const auditWhere = companyId ? "WHERE a.company_id = $1" : "";
    const activityRes = await query<{
      id: string;
      action: string;
      entity: string;
      entity_id: string | null;
      timestamp: string;
      actor_username: string | null;
      company_name: string | null;
      company_code: string | null;
    }>(`
      SELECT 
        a.id,
        a.action,
        a.entity,
        a.entity_id,
        a.timestamp,
        u.username as actor_username,
        c.name as company_name,
        c.code as company_code
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN companies c ON a.company_id = c.id
      ${auditWhere}
      ORDER BY a.timestamp DESC
      LIMIT 10
    `, assetParams);

    return {
      scope: isGlobal ? "GLOBAL" : "COMPANY",
      company_id: companyId,
      companies: companiesCount,
      users: usersCount,
      assets: {
        total: totalAssets,
        total_valuation: totalValuation,
        by_status: byStatus
      },
      operations: {
        pending_approvals: pendingApprovals,
        active_transfers: activeTransfers,
        pending_inter_company_transfers: pendingInterCompany,
        active_maintenance: activeMaintenance
      },
      company_summaries: companySummaries,
      recent_activity: activityRes.rows
    };
  }
}

export const dashboardService = new DashboardService();
