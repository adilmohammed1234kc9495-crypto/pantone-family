import { query } from "../../config/database";

export interface CategoryRow {
  id: string;
  company_id: string | null;
  code: string;
  name: string;
  description: string | null;
  depreciation_method: string;
  depreciation_rate_percent: number;
  useful_life_months: number;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryWithStats extends CategoryRow {
  company_name: string | null;
  parent_name: string | null;
  parent_code: string | null;
  children_count: number;
  assets_count: number;
}

export interface CategoryTreeNode extends CategoryWithStats {
  children: CategoryTreeNode[];
}

export interface FindCategoriesOptions {
  companyId?: string;
  search?: string;
  parentId?: string | null;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sortBy?: "code" | "name" | "created_at";
  sortOrder?: "asc" | "desc";
}

export class CategoriesRepository {
  async findWithStats(options: FindCategoriesOptions = {}): Promise<{ categories: CategoryWithStats[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;
    const sortField = options.sortBy || "name";
    const sortOrder = options.sortOrder === "desc" ? "DESC" : "ASC";

    const conditions: string[] = [];
    const params: unknown[] = [];
    let pIdx = 1;

    if (options.companyId) {
      conditions.push(`(c.company_id = $${pIdx} OR c.company_id IS NULL)`);
      params.push(options.companyId);
      pIdx++;
    }

    if (options.parentId !== undefined) {
      if (options.parentId === null) {
        conditions.push("c.parent_id IS NULL");
      } else {
        conditions.push(`c.parent_id = $${pIdx++}`);
        params.push(options.parentId);
      }
    }

    if (options.isActive !== undefined) {
      conditions.push(`c.is_active = $${pIdx++}`);
      params.push(options.isActive);
    }

    if (options.search) {
      conditions.push(`(c.code ILIKE $${pIdx} OR c.name ILIKE $${pIdx} OR c.description ILIKE $${pIdx})`);
      params.push(`%${options.search}%`);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*) AS total FROM asset_categories c ${whereClause}`;
    const countRes = await query<{ total: string }>(countSql, params);
    const total = parseInt(countRes.rows[0]?.total || "0", 10);

    const dataSql = `
      SELECT 
        c.id,
        c.company_id,
        comp.name AS company_name,
        c.code,
        c.name,
        c.description,
        c.depreciation_method,
        c.depreciation_rate_percent,
        c.useful_life_months,
        c.parent_id,
        p.name AS parent_name,
        p.code AS parent_code,
        c.is_active,
        c.created_at,
        c.updated_at,
        COUNT(DISTINCT ch.id) AS children_count,
        COUNT(DISTINCT a.id) AS assets_count
      FROM asset_categories c
      LEFT JOIN companies comp ON comp.id = c.company_id
      LEFT JOIN asset_categories p ON p.id = c.parent_id
      LEFT JOIN asset_categories ch ON ch.parent_id = c.id
      LEFT JOIN assets a ON a.category_id = c.id
      ${whereClause}
      GROUP BY c.id, comp.name, p.name, p.code
      ORDER BY c.${sortField} ${sortOrder}
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `;

    const dataRes = await query<Record<string, unknown>>(dataSql, [...params, limit, offset]);

    const categories: CategoryWithStats[] = dataRes.rows.map((r) => ({
      id: r.id as string,
      company_id: r.company_id as string | null,
      company_name: r.company_name as string | null,
      code: r.code as string,
      name: r.name as string,
      description: r.description as string | null,
      depreciation_method: r.depreciation_method as string,
      depreciation_rate_percent: parseFloat((r.depreciation_rate_percent as string) || "10.00"),
      useful_life_months: parseInt((r.useful_life_months as string) || "60", 10),
      parent_id: r.parent_id as string | null,
      parent_name: r.parent_name as string | null,
      parent_code: r.parent_code as string | null,
      is_active: Boolean(r.is_active),
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      children_count: parseInt((r.children_count as string) || "0", 10),
      assets_count: parseInt((r.assets_count as string) || "0", 10),
    }));

    return { categories, total };
  }

  async findAllForTree(companyId?: string): Promise<CategoryWithStats[]> {
    const conditions: string[] = ["c.is_active = true"];
    const params: unknown[] = [];
    let pIdx = 1;

    if (companyId) {
      conditions.push(`(c.company_id = $${pIdx++} OR c.company_id IS NULL)`);
      params.push(companyId);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const dataSql = `
      SELECT 
        c.id,
        c.company_id,
        comp.name AS company_name,
        c.code,
        c.name,
        c.description,
        c.depreciation_method,
        c.depreciation_rate_percent,
        c.useful_life_months,
        c.parent_id,
        p.name AS parent_name,
        p.code AS parent_code,
        c.is_active,
        c.created_at,
        c.updated_at,
        COUNT(DISTINCT ch.id) AS children_count,
        COUNT(DISTINCT a.id) AS assets_count
      FROM asset_categories c
      LEFT JOIN companies comp ON comp.id = c.company_id
      LEFT JOIN asset_categories p ON p.id = c.parent_id
      LEFT JOIN asset_categories ch ON ch.parent_id = c.id
      LEFT JOIN assets a ON a.category_id = c.id
      ${whereClause}
      GROUP BY c.id, comp.name, p.name, p.code
      ORDER BY c.name ASC
    `;

    const dataRes = await query<Record<string, unknown>>(dataSql, params);

    return dataRes.rows.map((r) => ({
      id: r.id as string,
      company_id: r.company_id as string | null,
      company_name: r.company_name as string | null,
      code: r.code as string,
      name: r.name as string,
      description: r.description as string | null,
      depreciation_method: r.depreciation_method as string,
      depreciation_rate_percent: parseFloat((r.depreciation_rate_percent as string) || "10.00"),
      useful_life_months: parseInt((r.useful_life_months as string) || "60", 10),
      parent_id: r.parent_id as string | null,
      parent_name: r.parent_name as string | null,
      parent_code: r.parent_code as string | null,
      is_active: Boolean(r.is_active),
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      children_count: parseInt((r.children_count as string) || "0", 10),
      assets_count: parseInt((r.assets_count as string) || "0", 10),
    }));
  }

  async findById(id: string): Promise<CategoryWithStats | null> {
    const sql = `
      SELECT 
        c.id,
        c.company_id,
        comp.name AS company_name,
        c.code,
        c.name,
        c.description,
        c.depreciation_method,
        c.depreciation_rate_percent,
        c.useful_life_months,
        c.parent_id,
        p.name AS parent_name,
        p.code AS parent_code,
        c.is_active,
        c.created_at,
        c.updated_at,
        COUNT(DISTINCT ch.id) AS children_count,
        COUNT(DISTINCT a.id) AS assets_count
      FROM asset_categories c
      LEFT JOIN companies comp ON comp.id = c.company_id
      LEFT JOIN asset_categories p ON p.id = c.parent_id
      LEFT JOIN asset_categories ch ON ch.parent_id = c.id
      LEFT JOIN assets a ON a.category_id = c.id
      WHERE c.id = $1
      GROUP BY c.id, comp.name, p.name, p.code
    `;
    const res = await query<Record<string, unknown>>(sql, [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id as string,
      company_id: r.company_id as string | null,
      company_name: r.company_name as string | null,
      code: r.code as string,
      name: r.name as string,
      description: r.description as string | null,
      depreciation_method: r.depreciation_method as string,
      depreciation_rate_percent: parseFloat((r.depreciation_rate_percent as string) || "10.00"),
      useful_life_months: parseInt((r.useful_life_months as string) || "60", 10),
      parent_id: r.parent_id as string | null,
      parent_name: r.parent_name as string | null,
      parent_code: r.parent_code as string | null,
      is_active: Boolean(r.is_active),
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      children_count: parseInt((r.children_count as string) || "0", 10),
      assets_count: parseInt((r.assets_count as string) || "0", 10),
    };
  }

  async findByCode(code: string, companyId?: string | null): Promise<CategoryRow | null> {
    if (companyId) {
      const res = await query<CategoryRow>(
        "SELECT * FROM asset_categories WHERE (company_id = $1 OR company_id IS NULL) AND code = $2",
        [companyId, code]
      );
      return res.rows[0] || null;
    }
    const res = await query<CategoryRow>(
      "SELECT * FROM asset_categories WHERE company_id IS NULL AND code = $1",
      [code]
    );
    return res.rows[0] || null;
  }

  async create(data: {
    companyId?: string | null;
    code: string;
    name: string;
    description?: string | null;
    depreciationMethod?: string;
    depreciationRatePercent?: number;
    usefulLifeMonths?: number;
    parentId?: string | null;
  }): Promise<CategoryRow> {
    const res = await query<CategoryRow>(`
      INSERT INTO asset_categories (
        company_id, code, name, description, depreciation_method,
        depreciation_rate_percent, useful_life_months, parent_id, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING *
    `, [
      data.companyId || null,
      data.code,
      data.name,
      data.description || null,
      data.depreciationMethod || "STRAIGHT_LINE",
      data.depreciationRatePercent !== undefined ? data.depreciationRatePercent : 10.00,
      data.usefulLifeMonths !== undefined ? data.usefulLifeMonths : 60,
      data.parentId || null,
    ]);
    return res.rows[0];
  }

  async update(id: string, data: {
    name?: string;
    description?: string | null;
    depreciationMethod?: string;
    depreciationRatePercent?: number;
    usefulLifeMonths?: number;
    parentId?: string | null;
  }): Promise<CategoryRow> {
    const res = await query<CategoryRow>(`
      UPDATE asset_categories
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          depreciation_method = COALESCE($3, depreciation_method),
          depreciation_rate_percent = COALESCE($4, depreciation_rate_percent),
          useful_life_months = COALESCE($5, useful_life_months),
          parent_id = $6,
          updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `, [
      data.name || null,
      data.description !== undefined ? data.description : null,
      data.depreciationMethod || null,
      data.depreciationRatePercent !== undefined ? data.depreciationRatePercent : null,
      data.usefulLifeMonths !== undefined ? data.usefulLifeMonths : null,
      data.parentId !== undefined ? data.parentId : null,
      id
    ]);
    return res.rows[0];
  }

  async updateStatus(id: string, isActive: boolean): Promise<CategoryRow> {
    const res = await query<CategoryRow>(`
      UPDATE asset_categories
      SET is_active = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [isActive, id]);
    return res.rows[0];
  }
}

export const categoriesRepository = new CategoriesRepository();
