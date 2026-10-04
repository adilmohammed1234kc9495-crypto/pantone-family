import { query } from "../../config/database";

export interface CompanyRow {
  id: string;
  code: string;
  name: string;
  tax_id: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyWithStats extends CompanyRow {
  branch_count: number;
  department_count: number;
  user_count: number;
  asset_count: number;
  location_count?: number;
}

export interface FindCompaniesOptions {
  search?: string;
  status?: "all" | "active" | "inactive";
  page?: number;
  limit?: number;
  sortBy?: "name" | "code" | "created_at" | "updated_at";
  sortOrder?: "asc" | "desc";
}

export class CompaniesRepository {
  async findAll(): Promise<CompanyRow[]> {
    const res = await query<CompanyRow>(
      "SELECT * FROM companies ORDER BY created_at ASC"
    );
    return res.rows;
  }

  async findWithStats(options: FindCompaniesOptions = {}): Promise<{ companies: CompanyWithStats[]; total: number }> {
    const {
      search,
      status = "all",
      page = 1,
      limit = 10,
      sortBy = "created_at",
      sortOrder = "asc"
    } = options;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (search && search.trim()) {
      conditions.push(`(c.name ILIKE $${paramIndex} OR c.code ILIKE $${paramIndex})`);
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    if (status === "active") {
      conditions.push(`c.is_active = true`);
    } else if (status === "inactive") {
      conditions.push(`c.is_active = false`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count query
    const countSql = `SELECT COUNT(*)::int as count FROM companies c ${whereClause}`;
    const countRes = await query<{ count: number }>(countSql, params);
    const total = countRes.rows[0]?.count || 0;

    // Sorting safe whitelist
    const validSortCols: Record<string, string> = {
      name: "c.name",
      code: "c.code",
      created_at: "c.created_at",
      updated_at: "c.updated_at"
    };
    const orderCol = validSortCols[sortBy] || "c.created_at";
    const orderDir = sortOrder.toLowerCase() === "desc" ? "DESC" : "ASC";

    const offset = Math.max(0, (page - 1) * limit);
    params.push(limit, offset);

    const listSql = `
      SELECT 
        c.*,
        (SELECT COUNT(*)::int FROM branches b WHERE b.company_id = c.id) as branch_count,
        (SELECT COUNT(*)::int FROM departments d WHERE d.company_id = c.id) as department_count,
        (SELECT COUNT(*)::int FROM users u WHERE u.company_id = c.id) as user_count,
        (SELECT COUNT(*)::int FROM assets a WHERE a.company_id = c.id) as asset_count
      FROM companies c
      ${whereClause}
      ORDER BY ${orderCol} ${orderDir}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const listRes = await query<CompanyWithStats>(listSql, params);
    return {
      companies: listRes.rows,
      total
    };
  }

  async findById(id: string): Promise<CompanyRow | null> {
    const res = await query<CompanyRow>(
      "SELECT * FROM companies WHERE id = $1",
      [id]
    );
    return res.rows[0] || null;
  }

  async findByIdWithStats(id: string): Promise<CompanyWithStats | null> {
    const res = await query<CompanyWithStats>(`
      SELECT 
        c.*,
        (SELECT COUNT(*)::int FROM branches b WHERE b.company_id = c.id) as branch_count,
        (SELECT COUNT(*)::int FROM departments d WHERE d.company_id = c.id) as department_count,
        (SELECT COUNT(*)::int FROM locations l WHERE l.company_id = c.id) as location_count,
        (SELECT COUNT(*)::int FROM users u WHERE u.company_id = c.id) as user_count,
        (SELECT COUNT(*)::int FROM assets a WHERE a.company_id = c.id) as asset_count
      FROM companies c
      WHERE c.id = $1
    `, [id]);
    return res.rows[0] || null;
  }

  async findByCode(code: string): Promise<CompanyRow | null> {
    const res = await query<CompanyRow>(
      "SELECT * FROM companies WHERE code = $1",
      [code]
    );
    return res.rows[0] || null;
  }

  async create(data: {
    code: string;
    name: string;
    taxId?: string;
    address?: string;
    phone?: string;
    email?: string;
  }): Promise<CompanyRow> {
    const res = await query<CompanyRow>(`
      INSERT INTO companies (code, name, tax_id, address, phone, email, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING *
    `, [data.code, data.name, data.taxId || null, data.address || null, data.phone || null, data.email || null]);
    return res.rows[0];
  }

  async update(id: string, data: {
    name?: string;
    taxId?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  }): Promise<CompanyRow | null> {
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(data.name);
    }
    if (data.taxId !== undefined) {
      updates.push(`tax_id = $${paramIndex++}`);
      params.push(data.taxId);
    }
    if (data.address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      params.push(data.address);
    }
    if (data.phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      params.push(data.phone);
    }
    if (data.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      params.push(data.email);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    params.push(id);
    const sql = `
      UPDATE companies 
      SET ${updates.join(", ")}, updated_at = NOW() 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const res = await query<CompanyRow>(sql, params);
    return res.rows[0] || null;
  }

  async updateStatus(id: string, isActive: boolean): Promise<CompanyRow | null> {
    const res = await query<CompanyRow>(`
      UPDATE companies 
      SET is_active = $1, updated_at = NOW() 
      WHERE id = $2 
      RETURNING *
    `, [isActive, id]);
    return res.rows[0] || null;
  }

  async getActivity(companyId: string, limit = 20): Promise<Record<string, unknown>[]> {
    const res = await query(`
      SELECT 
        a.id,
        a.action,
        a.entity,
        a.entity_id,
        a.old_values_json,
        a.new_values_json,
        a.timestamp,
        u.username as actor_username,
        u.email as actor_email
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.company_id = $1
      ORDER BY a.timestamp DESC
      LIMIT $2
    `, [companyId, limit]);
    return res.rows;
  }
}

export const companiesRepository = new CompaniesRepository();