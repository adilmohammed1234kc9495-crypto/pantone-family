import { query } from "../../config/database";

export interface BranchRow {
  id: string;
  company_id: string;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BranchWithStats extends BranchRow {
  company_name: string;
  departments_count: number;
  locations_count: number;
  assets_count: number;
}

export interface FindBranchesOptions {
  companyId?: string;
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sortBy?: "code" | "name" | "created_at" | "city";
  sortOrder?: "asc" | "desc";
}

export class BranchesRepository {
  async findWithStats(options: FindBranchesOptions = {}): Promise<{ branches: BranchWithStats[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;
    const sortField = options.sortBy || "name";
    const sortOrder = options.sortOrder === "desc" ? "DESC" : "ASC";

    const conditions: string[] = [];
    const params: unknown[] = [];
    let pIdx = 1;

    if (options.companyId) {
      conditions.push(`b.company_id = $${pIdx++}`);
      params.push(options.companyId);
    }

    if (options.isActive !== undefined) {
      conditions.push(`b.is_active = $${pIdx++}`);
      params.push(options.isActive);
    }

    if (options.search) {
      conditions.push(`(b.code ILIKE $${pIdx} OR b.name ILIKE $${pIdx} OR b.city ILIKE $${pIdx})`);
      params.push(`%${options.search}%`);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*) AS total FROM branches b ${whereClause}`;
    const countRes = await query<{ total: string }>(countSql, params);
    const total = parseInt(countRes.rows[0]?.total || "0", 10);

    const dataSql = `
      SELECT 
        b.id,
        b.company_id,
        c.name AS company_name,
        b.code,
        b.name,
        b.address,
        b.city,
        b.state,
        b.is_active,
        b.created_at,
        b.updated_at,
        COUNT(DISTINCT d.id) AS departments_count,
        COUNT(DISTINCT l.id) AS locations_count,
        COUNT(DISTINCT a.id) AS assets_count
      FROM branches b
      JOIN companies c ON c.id = b.company_id
      LEFT JOIN departments d ON d.branch_id = b.id
      LEFT JOIN locations l ON l.branch_id = b.id
      LEFT JOIN assets a ON a.branch_id = b.id
      ${whereClause}
      GROUP BY b.id, c.name
      ORDER BY b.${sortField} ${sortOrder}
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `;

    const dataRes = await query<Record<string, unknown>>(dataSql, [...params, limit, offset]);

    const branches: BranchWithStats[] = dataRes.rows.map((r) => ({
      id: r.id as string,
      company_id: r.company_id as string,
      company_name: r.company_name as string,
      code: r.code as string,
      name: r.name as string,
      address: r.address as string | null,
      city: r.city as string | null,
      state: r.state as string | null,
      is_active: Boolean(r.is_active),
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      departments_count: parseInt((r.departments_count as string) || "0", 10),
      locations_count: parseInt((r.locations_count as string) || "0", 10),
      assets_count: parseInt((r.assets_count as string) || "0", 10),
    }));

    return { branches, total };
  }

  async findById(id: string): Promise<BranchWithStats | null> {
    const sql = `
      SELECT 
        b.id,
        b.company_id,
        c.name AS company_name,
        b.code,
        b.name,
        b.address,
        b.city,
        b.state,
        b.is_active,
        b.created_at,
        b.updated_at,
        COUNT(DISTINCT d.id) AS departments_count,
        COUNT(DISTINCT l.id) AS locations_count,
        COUNT(DISTINCT a.id) AS assets_count
      FROM branches b
      JOIN companies c ON c.id = b.company_id
      LEFT JOIN departments d ON d.branch_id = b.id
      LEFT JOIN locations l ON l.branch_id = b.id
      LEFT JOIN assets a ON a.branch_id = b.id
      WHERE b.id = $1
      GROUP BY b.id, c.name
    `;
    const res = await query<Record<string, unknown>>(sql, [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id as string,
      company_id: r.company_id as string,
      company_name: r.company_name as string,
      code: r.code as string,
      name: r.name as string,
      address: r.address as string | null,
      city: r.city as string | null,
      state: r.state as string | null,
      is_active: Boolean(r.is_active),
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      departments_count: parseInt((r.departments_count as string) || "0", 10),
      locations_count: parseInt((r.locations_count as string) || "0", 10),
      assets_count: parseInt((r.assets_count as string) || "0", 10),
    };
  }

  async findByCode(companyId: string, code: string): Promise<BranchRow | null> {
    const res = await query<BranchRow>(
      "SELECT * FROM branches WHERE company_id = $1 AND code = $2",
      [companyId, code]
    );
    return res.rows[0] || null;
  }

  async create(data: {
    companyId: string;
    code: string;
    name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
  }): Promise<BranchRow> {
    const res = await query<BranchRow>(`
      INSERT INTO branches (company_id, code, name, address, city, state, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING *
    `, [data.companyId, data.code, data.name, data.address || null, data.city || null, data.state || null]);
    return res.rows[0];
  }

  async update(id: string, data: {
    name?: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
  }): Promise<BranchRow> {
    const res = await query<BranchRow>(`
      UPDATE branches
      SET name = COALESCE($1, name),
          address = COALESCE($2, address),
          city = COALESCE($3, city),
          state = COALESCE($4, state),
          updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `, [data.name || null, data.address || null, data.city || null, data.state || null, id]);
    return res.rows[0];
  }

  async updateStatus(id: string, isActive: boolean): Promise<BranchRow> {
    const res = await query<BranchRow>(`
      UPDATE branches
      SET is_active = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [isActive, id]);
    return res.rows[0];
  }
}

export const branchesRepository = new BranchesRepository();
