import { PoolClient, QueryResult } from "pg";
import { query } from "../../config/database";

export interface MaintenanceRow {
  id: string;
  maintenance_code: string;
  work_order_number: string | null;
  asset_id: string;
  company_id: string;
  problem: string;
  reported_by: string | null;
  report_date: string;
  vendor_id: string | null;
  technician_name: string | null;
  estimated_cost: number;
  actual_cost: number;
  currency: string;
  invoice_reference: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  maintenance_type: string;
  priority: string;
  description: string | null;
  remarks: string | null;
  completed_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  closed_at: string | null;
  inspection_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceWithDetails extends MaintenanceRow {
  asset_tag: string;
  asset_name: string;
  serial_number: string | null;
  reported_by_username: string | null;
  completed_by_username: string | null;
  verified_by_username: string | null;
  vendor_name: string | null;
}

export interface CreateMaintenanceData {
  maintenanceCode: string;
  workOrderNumber: string;
  assetId: string;
  companyId: string;
  problem: string;
  reportedBy?: string | null;
  vendorId?: string | null;
  technicianName?: string | null;
  estimatedCost?: number;
  maintenanceType?: string;
  priority?: string;
  description?: string | null;
  inspectionId?: string | null;
}

export interface UpdateStatusData {
  status: string;
  technicianName?: string | null;
  remarks?: string | null;
  actualCost?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  completedBy?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  closedAt?: string | null;
}

export interface UpdateCostData {
  actualCost: number;
  currency?: string;
  invoiceReference?: string | null;
  remarks?: string | null;
}

export interface ListMaintenanceOptions {
  companyId?: string | null;
  assetId?: string;
  status?: string;
  priority?: string;
  maintenanceType?: string;
  vendorId?: string;
  page?: number;
  limit?: number;
}

export class MaintenanceRepository {
  async create(data: CreateMaintenanceData, client?: PoolClient): Promise<MaintenanceRow> {
    const sql = `
      INSERT INTO maintenance_records (
        maintenance_code,
        work_order_number,
        asset_id,
        company_id,
        problem,
        reported_by,
        vendor_id,
        technician_name,
        estimated_cost,
        actual_cost,
        currency,
        status,
        maintenance_type,
        priority,
        description,
        inspection_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0.00, 'USD', 'OPEN', $10, $11, $12, $13)
      RETURNING *
    `;
    const params = [
      data.maintenanceCode,
      data.workOrderNumber,
      data.assetId,
      data.companyId,
      data.problem,
      data.reportedBy || null,
      data.vendorId || null,
      data.technicianName || null,
      data.estimatedCost || 0.00,
      data.maintenanceType || 'CORRECTIVE',
      data.priority || 'MEDIUM',
      data.description || null,
      data.inspectionId || null
    ];

    const res: QueryResult<MaintenanceRow> = client
      ? await client.query(sql, params)
      : await query(sql, params);

    return res.rows[0];
  }

  async findById(id: string, client?: PoolClient): Promise<MaintenanceWithDetails | null> {
    const sql = `
      SELECT 
        mr.*,
        ast.asset_tag,
        ast.name as asset_name,
        ast.serial_number,
        u_rep.username as reported_by_username,
        u_comp.username as completed_by_username,
        u_ver.username as verified_by_username,
        v.name as vendor_name
      FROM maintenance_records mr
      JOIN assets ast ON mr.asset_id = ast.id
      LEFT JOIN users u_rep ON mr.reported_by = u_rep.id
      LEFT JOIN users u_comp ON mr.completed_by = u_comp.id
      LEFT JOIN users u_ver ON mr.verified_by = u_ver.id
      LEFT JOIN vendors v ON mr.vendor_id = v.id
      WHERE mr.id = $1
    `;
    const res: QueryResult<MaintenanceWithDetails> = client
      ? await client.query(sql, [id])
      : await query(sql, [id]);

    return res.rows[0] || null;
  }

  async updateStatus(id: string, data: UpdateStatusData, client?: PoolClient): Promise<MaintenanceRow> {
    const sql = `
      UPDATE maintenance_records
      SET 
        status = $2,
        technician_name = COALESCE($3, technician_name),
        remarks = COALESCE($4, remarks),
        actual_cost = COALESCE($5, actual_cost),
        start_date = COALESCE($6, start_date),
        end_date = COALESCE($7, end_date),
        completed_by = COALESCE($8, completed_by),
        verified_by = COALESCE($9, verified_by),
        verified_at = COALESCE($10, verified_at),
        closed_at = COALESCE($11, closed_at),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const params = [
      id,
      data.status,
      data.technicianName || null,
      data.remarks || null,
      data.actualCost !== undefined ? data.actualCost : null,
      data.startDate || null,
      data.endDate || null,
      data.completedBy || null,
      data.verifiedBy || null,
      data.verifiedAt || null,
      data.closedAt || null
    ];

    const res: QueryResult<MaintenanceRow> = client
      ? await client.query(sql, params)
      : await query(sql, params);

    return res.rows[0];
  }

  async updateCosts(id: string, data: UpdateCostData, client?: PoolClient): Promise<MaintenanceRow> {
    const sql = `
      UPDATE maintenance_records
      SET 
        actual_cost = $2,
        currency = COALESCE($3, currency),
        invoice_reference = COALESCE($4, invoice_reference),
        remarks = COALESCE($5, remarks),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const params = [
      id,
      data.actualCost,
      data.currency || null,
      data.invoiceReference || null,
      data.remarks || null
    ];

    const res: QueryResult<MaintenanceRow> = client
      ? await client.query(sql, params)
      : await query(sql, params);

    return res.rows[0];
  }

  async list(options: ListMaintenanceOptions): Promise<{ workOrders: MaintenanceWithDetails[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (options.companyId) {
      conditions.push(`mr.company_id = $${idx++}`);
      params.push(options.companyId);
    }
    if (options.assetId) {
      conditions.push(`mr.asset_id = $${idx++}`);
      params.push(options.assetId);
    }
    if (options.status) {
      conditions.push(`mr.status = $${idx++}`);
      params.push(options.status);
    }
    if (options.priority) {
      conditions.push(`mr.priority = $${idx++}`);
      params.push(options.priority);
    }
    if (options.maintenanceType) {
      conditions.push(`mr.maintenance_type = $${idx++}`);
      params.push(options.maintenanceType);
    }
    if (options.vendorId) {
      conditions.push(`mr.vendor_id = $${idx++}`);
      params.push(options.vendorId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `
      SELECT COUNT(*)::int as count
      FROM maintenance_records mr
      ${whereClause}
    `;
    const countRes = await query<{ count: number }>(countSql, params);
    const total = countRes.rows[0]?.count || 0;

    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    const listSql = `
      SELECT 
        mr.*,
        ast.asset_tag,
        ast.name as asset_name,
        ast.serial_number,
        u_rep.username as reported_by_username,
        u_comp.username as completed_by_username,
        u_ver.username as verified_by_username,
        v.name as vendor_name
      FROM maintenance_records mr
      JOIN assets ast ON mr.asset_id = ast.id
      LEFT JOIN users u_rep ON mr.reported_by = u_rep.id
      LEFT JOIN users u_comp ON mr.completed_by = u_comp.id
      LEFT JOIN users u_ver ON mr.verified_by = u_ver.id
      LEFT JOIN vendors v ON mr.vendor_id = v.id
      ${whereClause}
      ORDER BY mr.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, offset);

    const listRes = await query<MaintenanceWithDetails>(listSql, params);
    return { workOrders: listRes.rows, total };
  }
}

export const maintenanceRepository = new MaintenanceRepository();