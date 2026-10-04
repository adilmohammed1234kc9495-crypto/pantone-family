import { PoolClient, QueryResult } from "pg";
import { query } from "../../config/database";

export interface AssignmentRow {
  id: string;
  asset_id: string;
  company_id: string;
  employee_id: string;
  department_id: string | null;
  location_id: string | null;
  assigned_by: string | null;
  assigned_at: string;
  condition_at_assignment: string;
  return_due_date: string | null;
  remarks: string | null;
  status: "ACTIVE" | "RETURNED" | "CANCELLED";
  is_handed_over: boolean;
  handed_over_at: string | null;
  handed_over_by: string | null;
  handover_condition: string | null;
  handover_remarks: string | null;
  handover_signature_ref: string | null;
}

export interface AssignmentWithDetails extends AssignmentRow {
  asset_tag: string;
  asset_name: string;
  serial_number: string | null;
  employee_first_name: string;
  employee_last_name: string;
  employee_code: string;
  department_name: string | null;
  location_room: string | null;
  assigned_by_username: string | null;
  handed_over_by_username: string | null;
}

export interface CreateAssignmentData {
  assetId: string;
  companyId: string;
  employeeId: string;
  departmentId?: string | null;
  locationId?: string | null;
  assignedBy?: string | null;
  conditionAtAssignment?: string;
  returnDueDate?: string | null;
  remarks?: string | null;
}

export interface UpdateHandoverData {
  condition: string;
  remarks?: string | null;
  signatureRef?: string | null;
  handedOverBy: string;
}

export interface ListAssignmentsOptions {
  companyId?: string | null;
  assetId?: string;
  employeeId?: string;
  departmentId?: string;
  status?: string;
  isHandedOver?: boolean;
  page?: number;
  limit?: number;
}

export class AssignmentsRepository {
  async create(data: CreateAssignmentData, client?: PoolClient): Promise<AssignmentRow> {
    const sql = `
      INSERT INTO asset_assignments (
        asset_id,
        company_id,
        employee_id,
        department_id,
        location_id,
        assigned_by,
        condition_at_assignment,
        return_due_date,
        remarks,
        status,
        is_handed_over
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', false)
      RETURNING *
    `;
    const params = [
      data.assetId,
      data.companyId,
      data.employeeId,
      data.departmentId || null,
      data.locationId || null,
      data.assignedBy || null,
      data.conditionAtAssignment || 'GOOD',
      data.returnDueDate || null,
      data.remarks || null
    ];

    const res: QueryResult<AssignmentRow> = client 
      ? await client.query(sql, params)
      : await query(sql, params);

    return res.rows[0];
  }

  async findById(id: string, client?: PoolClient): Promise<AssignmentWithDetails | null> {
    const sql = `
      SELECT 
        aa.*,
        ast.asset_tag,
        ast.name as asset_name,
        ast.serial_number,
        emp.first_name as employee_first_name,
        emp.last_name as employee_last_name,
        emp.employee_code,
        dept.name as department_name,
        loc.room_number as location_room,
        u_assign.username as assigned_by_username,
        u_hand.username as handed_over_by_username
      FROM asset_assignments aa
      JOIN assets ast ON aa.asset_id = ast.id
      JOIN employees emp ON aa.employee_id = emp.id
      LEFT JOIN departments dept ON aa.department_id = dept.id
      LEFT JOIN locations loc ON aa.location_id = loc.id
      LEFT JOIN users u_assign ON aa.assigned_by = u_assign.id
      LEFT JOIN users u_hand ON aa.handed_over_by = u_hand.id
      WHERE aa.id = $1
    `;
    const res: QueryResult<AssignmentWithDetails> = client
      ? await client.query(sql, [id])
      : await query(sql, [id]);

    return res.rows[0] || null;
  }

  async findActiveByAssetId(assetId: string, client?: PoolClient): Promise<AssignmentRow | null> {
    const sql = `
      SELECT * FROM asset_assignments 
      WHERE asset_id = $1 AND status = 'ACTIVE'
      LIMIT 1
    `;
    const res: QueryResult<AssignmentRow> = client
      ? await client.query(sql, [assetId])
      : await query(sql, [assetId]);

    return res.rows[0] || null;
  }

  async updateHandover(id: string, data: UpdateHandoverData, client?: PoolClient): Promise<AssignmentRow> {
    const sql = `
      UPDATE asset_assignments
      SET 
        is_handed_over = true,
        handed_over_at = NOW(),
        handed_over_by = $2,
        handover_condition = $3,
        handover_remarks = $4,
        handover_signature_ref = $5
      WHERE id = $1
      RETURNING *
    `;
    const params = [
      id,
      data.handedOverBy,
      data.condition,
      data.remarks || null,
      data.signatureRef || null
    ];

    const res: QueryResult<AssignmentRow> = client
      ? await client.query(sql, params)
      : await query(sql, params);

    return res.rows[0];
  }

  async updateStatus(id: string, status: "ACTIVE" | "RETURNED" | "CANCELLED", client?: PoolClient): Promise<AssignmentRow> {
    const sql = `
      UPDATE asset_assignments
      SET status = $2
      WHERE id = $1
      RETURNING *
    `;
    const res: QueryResult<AssignmentRow> = client
      ? await client.query(sql, [id, status])
      : await query(sql, [id, status]);

    return res.rows[0];
  }

  async list(options: ListAssignmentsOptions): Promise<{ assignments: AssignmentWithDetails[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (options.companyId) {
      conditions.push(`aa.company_id = $${idx++}`);
      params.push(options.companyId);
    }
    if (options.assetId) {
      conditions.push(`aa.asset_id = $${idx++}`);
      params.push(options.assetId);
    }
    if (options.employeeId) {
      conditions.push(`aa.employee_id = $${idx++}`);
      params.push(options.employeeId);
    }
    if (options.departmentId) {
      conditions.push(`aa.department_id = $${idx++}`);
      params.push(options.departmentId);
    }
    if (options.status) {
      conditions.push(`aa.status = $${idx++}`);
      params.push(options.status);
    }
    if (options.isHandedOver !== undefined) {
      conditions.push(`aa.is_handed_over = $${idx++}`);
      params.push(options.isHandedOver);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `
      SELECT COUNT(*)::int as count
      FROM asset_assignments aa
      ${whereClause}
    `;
    const countRes = await query<{ count: number }>(countSql, params);
    const total = countRes.rows[0]?.count || 0;

    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    const listSql = `
      SELECT 
        aa.*,
        ast.asset_tag,
        ast.name as asset_name,
        ast.serial_number,
        emp.first_name as employee_first_name,
        emp.last_name as employee_last_name,
        emp.employee_code,
        dept.name as department_name,
        loc.room_number as location_room,
        u_assign.username as assigned_by_username,
        u_hand.username as handed_over_by_username
      FROM asset_assignments aa
      JOIN assets ast ON aa.asset_id = ast.id
      JOIN employees emp ON aa.employee_id = emp.id
      LEFT JOIN departments dept ON aa.department_id = dept.id
      LEFT JOIN locations loc ON aa.location_id = loc.id
      LEFT JOIN users u_assign ON aa.assigned_by = u_assign.id
      LEFT JOIN users u_hand ON aa.handed_over_by = u_hand.id
      ${whereClause}
      ORDER BY aa.assigned_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, offset);

    const listRes = await query<AssignmentWithDetails>(listSql, params);
    return { assignments: listRes.rows, total };
  }
}

export const assignmentsRepository = new AssignmentsRepository();