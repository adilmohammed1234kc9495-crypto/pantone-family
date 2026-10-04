import { PoolClient, QueryResult } from "pg";
import { query } from "../../config/database";

export interface DamageInspectionRow {
  id: string;
  inspection_code: string;
  asset_id: string;
  return_id: string | null;
  company_id: string;
  inspector_id: string;
  inspection_date: string;
  damage_type: string;
  severity: "MINOR" | "MODERATE" | "MAJOR" | "CRITICAL";
  description: string;
  estimated_repair_cost: number;
  recommendation: "REPAIR" | "REPLACE_PARTS" | "SCRAP_RECOMMENDED" | "INSURANCE_CLAIM";
  status: "PENDING_DECISION" | "APPROVED_FOR_REPAIR" | "ESCALATED_DISPOSAL" | "RESOLVED" | "CLOSED";
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DamageInspectionWithDetails extends DamageInspectionRow {
  asset_tag: string;
  asset_name: string;
  serial_number: string | null;
  inspector_username: string;
  return_code: string | null;
}

export interface CreateDamageInspectionData {
  inspectionCode: string;
  assetId: string;
  returnId?: string | null;
  companyId: string;
  inspectorId: string;
  damageType: string;
  severity: "MINOR" | "MODERATE" | "MAJOR" | "CRITICAL";
  description: string;
  estimatedRepairCost?: number;
  recommendation: "REPAIR" | "REPLACE_PARTS" | "SCRAP_RECOMMENDED" | "INSURANCE_CLAIM";
  status?: string;
}

export interface UpdateDecisionData {
  status: "PENDING_DECISION" | "APPROVED_FOR_REPAIR" | "ESCALATED_DISPOSAL" | "RESOLVED" | "CLOSED";
  resolutionNotes?: string | null;
}

export interface ListDamageInspectionsOptions {
  companyId?: string | null;
  assetId?: string;
  severity?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class DamageInspectionsRepository {
  async create(data: CreateDamageInspectionData, client?: PoolClient): Promise<DamageInspectionRow> {
    const sql = `
      INSERT INTO damage_inspections (
        inspection_code,
        asset_id,
        return_id,
        company_id,
        inspector_id,
        damage_type,
        severity,
        description,
        estimated_repair_cost,
        recommendation,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const params = [
      data.inspectionCode,
      data.assetId,
      data.returnId || null,
      data.companyId,
      data.inspectorId,
      data.damageType,
      data.severity,
      data.description,
      data.estimatedRepairCost || 0.00,
      data.recommendation,
      data.status || 'PENDING_DECISION'
    ];

    const res: QueryResult<DamageInspectionRow> = client
      ? await client.query(sql, params)
      : await query(sql, params);

    return res.rows[0];
  }

  async findById(id: string, client?: PoolClient): Promise<DamageInspectionWithDetails | null> {
    const sql = `
      SELECT 
        di.*,
        ast.asset_tag,
        ast.name as asset_name,
        ast.serial_number,
        u_insp.username as inspector_username,
        ar.return_code
      FROM damage_inspections di
      JOIN assets ast ON di.asset_id = ast.id
      JOIN users u_insp ON di.inspector_id = u_insp.id
      LEFT JOIN asset_returns ar ON di.return_id = ar.id
      WHERE di.id = $1
    `;
    const res: QueryResult<DamageInspectionWithDetails> = client
      ? await client.query(sql, [id])
      : await query(sql, [id]);

    return res.rows[0] || null;
  }

  async updateDecision(id: string, data: UpdateDecisionData, client?: PoolClient): Promise<DamageInspectionRow> {
    const sql = `
      UPDATE damage_inspections
      SET 
        status = $2,
        resolution_notes = COALESCE($3, resolution_notes),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const params = [id, data.status, data.resolutionNotes || null];

    const res: QueryResult<DamageInspectionRow> = client
      ? await client.query(sql, params)
      : await query(sql, params);

    return res.rows[0];
  }

  async list(options: ListDamageInspectionsOptions): Promise<{ inspections: DamageInspectionWithDetails[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (options.companyId) {
      conditions.push(`di.company_id = $${idx++}`);
      params.push(options.companyId);
    }
    if (options.assetId) {
      conditions.push(`di.asset_id = $${idx++}`);
      params.push(options.assetId);
    }
    if (options.severity) {
      conditions.push(`di.severity = $${idx++}`);
      params.push(options.severity);
    }
    if (options.status) {
      conditions.push(`di.status = $${idx++}`);
      params.push(options.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `
      SELECT COUNT(*)::int as count
      FROM damage_inspections di
      ${whereClause}
    `;
    const countRes = await query<{ count: number }>(countSql, params);
    const total = countRes.rows[0]?.count || 0;

    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    const listSql = `
      SELECT 
        di.*,
        ast.asset_tag,
        ast.name as asset_name,
        ast.serial_number,
        u_insp.username as inspector_username,
        ar.return_code
      FROM damage_inspections di
      JOIN assets ast ON di.asset_id = ast.id
      JOIN users u_insp ON di.inspector_id = u_insp.id
      LEFT JOIN asset_returns ar ON di.return_id = ar.id
      ${whereClause}
      ORDER BY di.inspection_date DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, offset);

    const listRes = await query<DamageInspectionWithDetails>(listSql, params);
    return { inspections: listRes.rows, total };
  }
}

export const damageInspectionsRepository = new DamageInspectionsRepository();