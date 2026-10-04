import { PoolClient, QueryResult } from "pg";
import { query } from "../../config/database";

export interface AssetRequestRow {
  id: string;
  request_code: string;
  request_number: string;
  company_id: string;
  department_id: string | null;
  employee_id: string;
  requester_id: string | null;
  category_id: string | null;
  stock_item_id: string | null;
  specific_asset_id: string | null;
  item_name: string | null;
  quantity: number;
  reason: string;
  justification: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  required_by_date: string | null;
  preferred_location_id: string | null;
  status: "DRAFT" | "SUBMITTED" | "PENDING_APPROVAL" | "PARTIALLY_APPROVED" | "APPROVED" | "REJECTED" | "FULFILLED" | "CANCELLED";
  current_approval_level: number;
  approver_id: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  fulfilled_by: string | null;
  fulfilled_at: string | null;
  fulfilled_asset_id: string | null;
  fulfilled_stock_movement_id: string | null;
  fulfillment_notes: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetRequestWithDetails extends AssetRequestRow {
  employee_first_name: string;
  employee_last_name: string;
  employee_code: string;
  department_name: string | null;
  requester_username: string | null;
  category_name: string | null;
  stock_item_name: string | null;
  stock_code: string | null;
  preferred_location_name: string | null;
  fulfilled_asset_tag: string | null;
  fulfilled_asset_name: string | null;
  fulfilled_by_username: string | null;
}

export interface RequestHistoryRow {
  id: string;
  request_id: string;
  company_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  performed_by: string | null;
  performed_by_username?: string | null;
  remarks: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateRequestData {
  companyId: string;
  requesterId: string;
  employeeId: string;
  departmentId?: string | null;
  categoryId?: string | null;
  stockItemId?: string | null;
  itemName?: string | null;
  quantity?: number;
  justification: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  requiredByDate?: string | null;
  preferredLocationId?: string | null;
}

export interface UpdateRequestData {
  employeeId?: string;
  departmentId?: string | null;
  categoryId?: string | null;
  stockItemId?: string | null;
  itemName?: string | null;
  quantity?: number;
  justification?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  requiredByDate?: string | null;
  preferredLocationId?: string | null;
}

export interface ListRequestsOptions {
  companyId?: string | null;
  status?: string;
  priority?: string;
  departmentId?: string;
  employeeId?: string;
  requesterId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export class RequestsRepository {
  async generateNextRequestNumber(companyId: string, client?: PoolClient): Promise<string> {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const prefix = `REQ-${todayStr}-`;

    const sql = `
      SELECT request_number 
      FROM asset_requests 
      WHERE company_id = $1 AND request_number LIKE $2 
      ORDER BY request_number DESC 
      LIMIT 1;
    `;
    const res: QueryResult<{ request_number: string }> = client
      ? await client.query(sql, [companyId, `${prefix}%`])
      : await query(sql, [companyId, `${prefix}%`]);

    let seq = 1;
    if (res.rows.length > 0) {
      const parts = res.rows[0].request_number.split("-");
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}${seq.toString().padStart(4, "0")}`;
  }

  async create(data: CreateRequestData, client?: PoolClient): Promise<AssetRequestRow> {
    const reqNumber = await this.generateNextRequestNumber(data.companyId, client);

    const sql = `
      INSERT INTO asset_requests (
        request_code, request_number, company_id, requester_id, employee_id,
        department_id, category_id, stock_item_id, item_name, quantity,
        reason, justification, priority, required_by_date, preferred_location_id,
        status, current_approval_level
      ) VALUES (
        $1, $1, $2, $3, $4,
        $5, $6, $7, $8, $9,
        $10, $10, $11, $12, $13,
        'DRAFT', 1
      ) RETURNING *;
    `;
    const params = [
      reqNumber,
      data.companyId,
      data.requesterId,
      data.employeeId,
      data.departmentId || null,
      data.categoryId || null,
      data.stockItemId || null,
      data.itemName || null,
      data.quantity || 1,
      data.justification,
      data.priority || "MEDIUM",
      data.requiredByDate || null,
      data.preferredLocationId || null,
    ];

    const res: QueryResult<AssetRequestRow> = client
      ? await client.query(sql, params)
      : await query(sql, params);
    return res.rows[0];
  }

  async update(id: string, data: UpdateRequestData, client?: PoolClient): Promise<AssetRequestRow | null> {
    const fields: string[] = ["updated_at = NOW()"];
    const params: unknown[] = [id];
    let idx = 2;

    if (data.employeeId !== undefined) {
      fields.push(`employee_id = $${idx++}`);
      params.push(data.employeeId);
    }
    if (data.departmentId !== undefined) {
      fields.push(`department_id = $${idx++}`);
      params.push(data.departmentId);
    }
    if (data.categoryId !== undefined) {
      fields.push(`category_id = $${idx++}`);
      params.push(data.categoryId);
    }
    if (data.stockItemId !== undefined) {
      fields.push(`stock_item_id = $${idx++}`);
      params.push(data.stockItemId);
    }
    if (data.itemName !== undefined) {
      fields.push(`item_name = $${idx++}`);
      params.push(data.itemName);
    }
    if (data.quantity !== undefined) {
      fields.push(`quantity = $${idx++}`);
      params.push(data.quantity);
    }
    if (data.justification !== undefined) {
      fields.push(`justification = $${idx++}`);
      fields.push(`reason = $${idx++}`);
      params.push(data.justification, data.justification);
    }
    if (data.priority !== undefined) {
      fields.push(`priority = $${idx++}`);
      params.push(data.priority);
    }
    if (data.requiredByDate !== undefined) {
      fields.push(`required_by_date = $${idx++}`);
      params.push(data.requiredByDate);
    }
    if (data.preferredLocationId !== undefined) {
      fields.push(`preferred_location_id = $${idx++}`);
      params.push(data.preferredLocationId);
    }

    const sql = `UPDATE asset_requests SET ${fields.join(", ")} WHERE id = $1 RETURNING *;`;
    const res: QueryResult<AssetRequestRow> = client
      ? await client.query(sql, params)
      : await query(sql, params);
    return res.rows[0] || null;
  }

  async findById(id: string, client?: PoolClient): Promise<AssetRequestWithDetails | null> {
    const sql = `
      SELECT 
        r.*,
        e.first_name as employee_first_name,
        e.last_name as employee_last_name,
        e.employee_code,
        d.name as department_name,
        u.username as requester_username,
        c.name as category_name,
        s.item_name as stock_item_name,
        s.stock_code,
        loc.room_number as preferred_location_name,
        ast.asset_tag as fulfilled_asset_tag,
        ast.name as fulfilled_asset_name,
        fu.username as fulfilled_by_username
      FROM asset_requests r
      JOIN employees e ON r.employee_id = e.id
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN users u ON r.requester_id = u.id
      LEFT JOIN asset_categories c ON r.category_id = c.id
      LEFT JOIN stock_items s ON r.stock_item_id = s.id
      LEFT JOIN locations loc ON r.preferred_location_id = loc.id
      LEFT JOIN assets ast ON r.fulfilled_asset_id = ast.id
      LEFT JOIN users fu ON r.fulfilled_by = fu.id
      WHERE r.id = $1;
    `;
    const res: QueryResult<AssetRequestWithDetails> = client
      ? await client.query(sql, [id])
      : await query(sql, [id]);
    return res.rows[0] || null;
  }

  async findWithLock(id: string, client: PoolClient): Promise<AssetRequestRow | null> {
    const sql = `SELECT * FROM asset_requests WHERE id = $1 FOR UPDATE;`;
    const res: QueryResult<AssetRequestRow> = await client.query(sql, [id]);
    return res.rows[0] || null;
  }

  async updateStatus(
    id: string,
    status: string,
    currentApprovalLevel?: number,
    extraFields: Record<string, unknown> = {},
    client?: PoolClient
  ): Promise<AssetRequestRow> {
    const fields: string[] = [`status = $2`, `updated_at = NOW()`];
    const params: unknown[] = [id, status];
    let idx = 3;

    if (currentApprovalLevel !== undefined) {
      fields.push(`current_approval_level = $${idx++}`);
      params.push(currentApprovalLevel);
    }

    for (const [k, v] of Object.entries(extraFields)) {
      fields.push(`${k} = $${idx++}`);
      params.push(v);
    }

    const sql = `UPDATE asset_requests SET ${fields.join(", ")} WHERE id = $1 RETURNING *;`;
    const res: QueryResult<AssetRequestRow> = client
      ? await client.query(sql, params)
      : await query(sql, params);
    return res.rows[0];
  }

  async list(options: ListRequestsOptions): Promise<{ requests: AssetRequestWithDetails[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (options.companyId) {
      conditions.push(`r.company_id = $${idx++}`);
      params.push(options.companyId);
    }
    if (options.status) {
      conditions.push(`r.status = $${idx++}`);
      params.push(options.status);
    }
    if (options.priority) {
      conditions.push(`r.priority = $${idx++}`);
      params.push(options.priority);
    }
    if (options.departmentId) {
      conditions.push(`r.department_id = $${idx++}`);
      params.push(options.departmentId);
    }
    if (options.employeeId) {
      conditions.push(`r.employee_id = $${idx++}`);
      params.push(options.employeeId);
    }
    if (options.requesterId) {
      conditions.push(`r.requester_id = $${idx++}`);
      params.push(options.requesterId);
    }
    if (options.startDate) {
      conditions.push(`r.created_at >= $${idx++}`);
      params.push(options.startDate);
    }
    if (options.endDate) {
      conditions.push(`r.created_at <= $${idx++}`);
      params.push(options.endDate);
    }
    if (options.search && options.search.trim()) {
      conditions.push(`(r.request_number ILIKE $${idx} OR r.justification ILIKE $${idx} OR r.item_name ILIKE $${idx} OR e.first_name ILIKE $${idx} OR e.last_name ILIKE $${idx} OR e.employee_code ILIKE $${idx})`);
      params.push(`%${options.search.trim()}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `
      SELECT COUNT(*)::int as total 
      FROM asset_requests r
      JOIN employees e ON r.employee_id = e.id
      ${whereClause};
    `;
    const countRes = await query<{ total: number }>(countSql, params);
    const total = countRes.rows[0]?.total || 0;

    const listSql = `
      SELECT 
        r.*,
        e.first_name as employee_first_name,
        e.last_name as employee_last_name,
        e.employee_code,
        d.name as department_name,
        u.username as requester_username,
        c.name as category_name,
        s.item_name as stock_item_name,
        s.stock_code,
        loc.room_number as preferred_location_name,
        ast.asset_tag as fulfilled_asset_tag,
        ast.name as fulfilled_asset_name,
        fu.username as fulfilled_by_username
      FROM asset_requests r
      JOIN employees e ON r.employee_id = e.id
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN users u ON r.requester_id = u.id
      LEFT JOIN asset_categories c ON r.category_id = c.id
      LEFT JOIN stock_items s ON r.stock_item_id = s.id
      LEFT JOIN locations loc ON r.preferred_location_id = loc.id
      LEFT JOIN assets ast ON r.fulfilled_asset_id = ast.id
      LEFT JOIN users fu ON r.fulfilled_by = fu.id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    params.push(limit, offset);

    const listRes = await query<AssetRequestWithDetails>(listSql, params);

    return {
      requests: listRes.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    };
  }

  async addHistory(
    data: {
      requestId: string;
      companyId: string;
      action: string;
      fromStatus?: string | null;
      toStatus?: string | null;
      performedBy?: string | null;
      remarks?: string | null;
      metadata?: Record<string, unknown>;
    },
    client?: PoolClient
  ): Promise<RequestHistoryRow> {
    const sql = `
      INSERT INTO request_history (
        request_id, company_id, action, from_status, to_status,
        performed_by, remarks, metadata, created_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8::jsonb, NOW()
      ) RETURNING *;
    `;
    const params = [
      data.requestId,
      data.companyId,
      data.action,
      data.fromStatus || null,
      data.toStatus || null,
      data.performedBy || null,
      data.remarks || null,
      JSON.stringify(data.metadata || {}),
    ];

    const res: QueryResult<RequestHistoryRow> = client
      ? await client.query(sql, params)
      : await query(sql, params);
    return res.rows[0];
  }

  async listHistory(requestId: string): Promise<RequestHistoryRow[]> {
    const sql = `
      SELECT 
        h.*,
        u.username as performed_by_username
      FROM request_history h
      LEFT JOIN users u ON h.performed_by = u.id
      WHERE h.request_id = $1
      ORDER BY h.created_at ASC;
    `;
    const res = await query<RequestHistoryRow>(sql, [requestId]);
    return res.rows;
  }
}

export const requestsRepository = new RequestsRepository();
