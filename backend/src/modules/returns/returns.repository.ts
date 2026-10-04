import { PoolClient, QueryResult } from "pg";
import { query } from "../../config/database";

export interface ReturnRow {
  id: string;
  return_code: string;
  asset_id: string;
  assignment_id: string | null;
  company_id: string;
  returned_by: string;
  received_by: string | null;
  returned_at: string;
  condition: string;
  damage_description: string | null;
  damage_photo_url: string | null;
  destination_status: string;
  remarks: string | null;
  return_reason: string | null;
  inspection_status: "PENDING_INSPECTION" | "PASSED" | "MAINTENANCE_REQUIRED" | "DAMAGE_REVIEW";
  inspected_by: string | null;
  inspected_at: string | null;
  missing_accessories: string | null;
  missing_components: string | null;
  functional_status: string | null;
  inspection_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReturnWithDetails extends ReturnRow {
  asset_tag: string;
  asset_name: string;
  serial_number: string | null;
  employee_first_name: string;
  employee_last_name: string;
  employee_code: string;
  received_by_username: string | null;
  inspected_by_username: string | null;
}

export interface CreateReturnData {
  returnCode: string;
  assetId: string;
  assignmentId?: string | null;
  companyId: string;
  returnedBy: string;
  receivedBy?: string | null;
  condition: string;
  damageDescription?: string | null;
  damagePhotoUrl?: string | null;
  destinationStatus?: string;
  remarks?: string | null;
  returnReason?: string | null;
}

export interface UpdateInspectionData {
  inspectionStatus: "PASSED" | "MAINTENANCE_REQUIRED" | "DAMAGE_REVIEW";
  inspectedBy: string;
  condition?: string;
  functionalStatus?: string | null;
  missingAccessories?: string | null;
  missingComponents?: string | null;
  inspectionNotes?: string | null;
  destinationStatus?: string;
}

export interface ListReturnsOptions {
  companyId?: string | null;
  assetId?: string;
  returnedBy?: string;
  inspectionStatus?: string;
  page?: number;
  limit?: number;
}

export class ReturnsRepository {
  async create(data: CreateReturnData, client?: PoolClient): Promise<ReturnRow> {
    const sql = `
      INSERT INTO asset_returns (
        return_code,
        asset_id,
        assignment_id,
        company_id,
        returned_by,
        received_by,
        condition,
        damage_description,
        damage_photo_url,
        destination_status,
        remarks,
        return_reason,
        inspection_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDING_INSPECTION')
      RETURNING *
    `;
    const params = [
      data.returnCode,
      data.assetId,
      data.assignmentId || null,
      data.companyId,
      data.returnedBy,
      data.receivedBy || null,
      data.condition,
      data.damageDescription || null,
      data.damagePhotoUrl || null,
      data.destinationStatus || 'IN_STOCK',
      data.remarks || null,
      data.returnReason || null
    ];

    const res: QueryResult<ReturnRow> = client
      ? await client.query(sql, params)
      : await query(sql, params);

    return res.rows[0];
  }

  async findById(id: string, client?: PoolClient): Promise<ReturnWithDetails | null> {
    const sql = `
      SELECT 
        ar.*,
        ast.asset_tag,
        ast.name as asset_name,
        ast.serial_number,
        emp.first_name as employee_first_name,
        emp.last_name as employee_last_name,
        emp.employee_code,
        u_rec.username as received_by_username,
        u_insp.username as inspected_by_username
      FROM asset_returns ar
      JOIN assets ast ON ar.asset_id = ast.id
      JOIN employees emp ON ar.returned_by = emp.id
      LEFT JOIN users u_rec ON ar.received_by = u_rec.id
      LEFT JOIN users u_insp ON ar.inspected_by = u_insp.id
      WHERE ar.id = $1
    `;
    const res: QueryResult<ReturnWithDetails> = client
      ? await client.query(sql, [id])
      : await query(sql, [id]);

    return res.rows[0] || null;
  }

  async updateInspection(id: string, data: UpdateInspectionData, client?: PoolClient): Promise<ReturnRow> {
    const sql = `
      UPDATE asset_returns
      SET 
        inspection_status = $2,
        inspected_by = $3,
        inspected_at = NOW(),
        functional_status = COALESCE($4, functional_status),
        missing_accessories = COALESCE($5, missing_accessories),
        missing_components = COALESCE($6, missing_components),
        inspection_notes = COALESCE($7, inspection_notes),
        destination_status = COALESCE($8, destination_status),
        condition = COALESCE($9, condition),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const params = [
      id,
      data.inspectionStatus,
      data.inspectedBy,
      data.functionalStatus || null,
      data.missingAccessories || null,
      data.missingComponents || null,
      data.inspectionNotes || null,
      data.destinationStatus || null,
      data.condition || null
    ];

    const res: QueryResult<ReturnRow> = client
      ? await client.query(sql, params)
      : await query(sql, params);

    return res.rows[0];
  }

  async list(options: ListReturnsOptions): Promise<{ returns: ReturnWithDetails[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (options.companyId) {
      conditions.push(`ar.company_id = $${idx++}`);
      params.push(options.companyId);
    }
    if (options.assetId) {
      conditions.push(`ar.asset_id = $${idx++}`);
      params.push(options.assetId);
    }
    if (options.returnedBy) {
      conditions.push(`ar.returned_by = $${idx++}`);
      params.push(options.returnedBy);
    }
    if (options.inspectionStatus) {
      conditions.push(`ar.inspection_status = $${idx++}`);
      params.push(options.inspectionStatus);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `
      SELECT COUNT(*)::int as count
      FROM asset_returns ar
      ${whereClause}
    `;
    const countRes = await query<{ count: number }>(countSql, params);
    const total = countRes.rows[0]?.count || 0;

    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    const listSql = `
      SELECT 
        ar.*,
        ast.asset_tag,
        ast.name as asset_name,
        ast.serial_number,
        emp.first_name as employee_first_name,
        emp.last_name as employee_last_name,
        emp.employee_code,
        u_rec.username as received_by_username,
        u_insp.username as inspected_by_username
      FROM asset_returns ar
      JOIN assets ast ON ar.asset_id = ast.id
      JOIN employees emp ON ar.returned_by = emp.id
      LEFT JOIN users u_rec ON ar.received_by = u_rec.id
      LEFT JOIN users u_insp ON ar.inspected_by = u_insp.id
      ${whereClause}
      ORDER BY ar.returned_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, offset);

    const listRes = await query<ReturnWithDetails>(listSql, params);
    return { returns: listRes.rows, total };
  }
}

export const returnsRepository = new ReturnsRepository();