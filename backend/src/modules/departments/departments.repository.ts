import { query } from "../../config/database";

export interface DepartmentRow {
  id: string;
  company_id: string;
  branch_id: string | null;
  code: string;
  name: string;
  head_employee_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DepartmentWithStats extends DepartmentRow {
  company_name: string;
  branch_name: string | null;
  branch_code: string | null;
  assets_count: number;
}

export interface FindDepartmentsOptions {
  companyId?: string;
  branchId?: string;
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sortBy?: "code" | "name" | "created_at";
  sortOrder?: "asc" | "desc";
}

export class DepartmentsRepository {
  async findWithStats(options: FindDepartmentsOptions = {}): Promise<{ departments: DepartmentWithStats[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;
    const sortField = options.sortBy || "name";
    const sortOrder = options.sortOrder === "desc" ? "DESC" : "ASC";

    const conditions: string[] = [];
    const params: unknown[] = [];
    let pIdx = 1;

    if (options.companyId) {
      conditions.push(`d.company_id = $${pIdx++}`);
      params.push(options.companyId);
    }

    if (options.branchId) {
      conditions.push(`d.branch_id = $${pIdx++}`);
      params.push(options.branchId);
    }

    if (options.isActive !== undefined) {
      conditions.push(`d.is_active = $${pIdx++}`);
      params.push(options.isActive);
    }

    if (options.search) {
      conditions.push(`(d.code ILIKE $${pIdx} OR d.name ILIKE $${pIdx})`);
      params.push(`%${options.search}%`);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*) AS total FROM departments d ${whereClause}`;
    const countRes = await query<{ total: string }>(countSql, params);
    const total = parseInt(countRes.rows[0]?.total || "0", 10);

    const dataSql = `
      SELECT 
        d.id,
        d.company_id,
        c.name AS company_name,
        d.branch_id,
        b.name AS branch_name,
        b.code AS branch_code,
        d.code,
        d.name,
        d.head_employee_id,
        d.is_active,
        d.created_at,
        d.updated_at,
        COUNT(DISTINCT a.id) AS assets_count
      FROM departments d
      JOIN companies c ON c.id = d.company_id
      LEFT JOIN branches b ON b.id = d.branch_id
      LEFT JOIN assets a ON a.department_id = d.id
      ${whereClause}
      GROUP BY d.id, c.name, b.name, b.code
      ORDER BY d.${sortField} ${sortOrder}
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `;

    const dataRes = await query<Record<string, unknown>>(dataSql, [...params, limit, offset]);

    const departments: DepartmentWithStats[] = dataRes.rows.map((r) => ({
      id: r.id as string,
      company_id: r.company_id as string,
      company_name: r.company_name as string,
      branch_id: r.branch_id as string | null,
      branch_name: r.branch_name as string | null,
      branch_code: r.branch_code as string | null,
      code: r.code as string,
      name: r.name as string,
      head_employee_id: r.head_employee_id as string | null,
      is_active: Boolean(r.is_active),
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      assets_count: parseInt((r.assets_count as string) || "0", 10),
    }));

    return { departments, total };
  }

  async findById(id: string): Promise<DepartmentWithStats | null> {
    const sql = `
      SELECT 
        d.id,
        d.company_id,
        c.name AS company_name,
        d.branch_id,
        b.name AS branch_name,
        b.code AS branch_code,
        d.code,
        d.name,
        d.head_employee_id,
        d.is_active,
        d.created_at,
        d.updated_at,
        COUNT(DISTINCT a.id) AS assets_count
      FROM departments d
      JOIN companies c ON c.id = d.company_id
      LEFT JOIN branches b ON b.id = d.branch_id
      LEFT JOIN assets a ON a.department_id = d.id
      WHERE d.id = $1
      GROUP BY d.id, c.name, b.name, b.code
    `;
    const res = await query<Record<string, unknown>>(sql, [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id as string,
      company_id: r.company_id as string,
      company_name: r.company_name as string,
      branch_id: r.branch_id as string | null,
      branch_name: r.branch_name as string | null,
      branch_code: r.branch_code as string | null,
      code: r.code as string,
      name: r.name as string,
      head_employee_id: r.head_employee_id as string | null,
      is_active: Boolean(r.is_active),
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      assets_count: parseInt((r.assets_count as string) || "0", 10),
    };
  }

  async findByCode(companyId: string, code: string): Promise<DepartmentRow | null> {
    const res = await query<DepartmentRow>(
      "SELECT * FROM departments WHERE company_id = $1 AND code = $2",
      [companyId, code]
    );
    return res.rows[0] || null;
  }

  async create(data: {
    companyId: string;
    branchId?: string | null;
    code: string;
    name: string;
    headEmployeeId?: string | null;
  }): Promise<DepartmentRow> {
    const res = await query<DepartmentRow>(`
      INSERT INTO departments (company_id, branch_id, code, name, head_employee_id, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING *
    `, [data.companyId, data.branchId || null, data.code, data.name, data.headEmployeeId || null]);
    return res.rows[0];
  }

  async update(id: string, data: {
    name?: string;
    branchId?: string | null;
    headEmployeeId?: string | null;
  }): Promise<DepartmentRow> {
    const res = await query<DepartmentRow>(`
      UPDATE departments
      SET name = COALESCE($1, name),
          branch_id = $2,
          head_employee_id = $3,
          updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [data.name || null, data.branchId !== undefined ? data.branchId : null, data.headEmployeeId !== undefined ? data.headEmployeeId : null, id]);
    return res.rows[0];
  }

  async updateStatus(id: string, isActive: boolean): Promise<DepartmentRow> {
    const res = await query<DepartmentRow>(`
      UPDATE departments
      SET is_active = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [isActive, id]);
    return res.rows[0];
  }
}

export const departmentsRepository = new DepartmentsRepository();
