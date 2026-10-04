import { query } from "../../config/database";

export interface UserItem {
  id: string;
  company_id: string | null;
  company_code: string | null;
  company_name: string | null;
  username: string;
  email: string;
  role_id: string;
  role_code: string;
  role_name: string;
  employee_id: string | null;
  employee_code: string | null;
  employee_name: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FindUsersOptions {
  companyId?: string | null;
  roleId?: string;
  status?: "all" | "active" | "inactive";
  search?: string;
  page?: number;
  limit?: number;
}

export class UsersRepository {
  async findUsers(options: FindUsersOptions = {}): Promise<{ users: UserItem[]; total: number }> {
    const {
      companyId,
      roleId,
      status = "all",
      search,
      page = 1,
      limit = 10
    } = options;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (companyId !== undefined) {
      if (companyId === null) {
        conditions.push(`u.company_id IS NULL`);
      } else {
        conditions.push(`u.company_id = $${paramIndex++}`);
        params.push(companyId);
      }
    }

    if (roleId) {
      conditions.push(`u.role_id = $${paramIndex++}`);
      params.push(roleId);
    }

    if (status === "active") {
      conditions.push(`u.is_active = true`);
    } else if (status === "inactive") {
      conditions.push(`u.is_active = false`);
    }

    if (search && search.trim()) {
      conditions.push(`(u.username ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR e.first_name ILIKE $${paramIndex} OR e.last_name ILIKE $${paramIndex})`);
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `
      SELECT COUNT(*)::int as count
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      ${whereClause}
    `;
    const countRes = await query<{ count: number }>(countSql, params);
    const total = countRes.rows[0]?.count || 0;

    const offset = Math.max(0, (page - 1) * limit);
    params.push(limit, offset);

    const listSql = `
      SELECT 
        u.id,
        u.company_id,
        c.code as company_code,
        c.name as company_name,
        u.username,
        u.email,
        u.role_id,
        r.code as role_code,
        r.name as role_name,
        u.employee_id,
        e.employee_code,
        CASE 
          WHEN e.id IS NOT NULL THEN (e.first_name || ' ' || e.last_name)
          ELSE NULL 
        END as employee_name,
        u.is_active,
        u.last_login_at,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN employees e ON u.employee_id = e.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const listRes = await query<UserItem>(listSql, params);
    return {
      users: listRes.rows,
      total
    };
  }

  async findById(id: string): Promise<UserItem | null> {
    const res = await query<UserItem>(`
      SELECT 
        u.id,
        u.company_id,
        c.code as company_code,
        c.name as company_name,
        u.username,
        u.email,
        u.role_id,
        r.code as role_code,
        r.name as role_name,
        u.employee_id,
        e.employee_code,
        CASE 
          WHEN e.id IS NOT NULL THEN (e.first_name || ' ' || e.last_name)
          ELSE NULL 
        END as employee_name,
        u.is_active,
        u.last_login_at,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE u.id = $1
    `, [id]);
    return res.rows[0] || null;
  }

  async findByUsername(username: string): Promise<{ id: string; username: string } | null> {
    const res = await query<{ id: string; username: string }>(
      "SELECT id, username FROM users WHERE username = $1",
      [username]
    );
    return res.rows[0] || null;
  }

  async findByEmail(email: string): Promise<{ id: string; email: string } | null> {
    const res = await query<{ id: string; email: string }>(
      "SELECT id, email FROM users WHERE email = $1",
      [email]
    );
    return res.rows[0] || null;
  }

  async create(data: {
    username: string;
    email: string;
    passwordHash: string;
    roleId: string;
    companyId?: string | null;
    employeeId?: string | null;
  }): Promise<UserItem> {
    const res = await query<{ id: string }>(`
      INSERT INTO users (username, email, password_hash, role_id, company_id, employee_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING id
    `, [
      data.username,
      data.email,
      data.passwordHash,
      data.roleId,
      data.companyId || null,
      data.employeeId || null
    ]);

    const createdId = res.rows[0].id;
    return (await this.findById(createdId))!;
  }

  async update(id: string, data: {
    email?: string;
    roleId?: string;
    employeeId?: string | null;
    passwordHash?: string;
    isActive?: boolean;
  }): Promise<UserItem | null> {
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (data.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      params.push(data.email);
    }
    if (data.roleId !== undefined) {
      updates.push(`role_id = $${paramIndex++}`);
      params.push(data.roleId);
    }
    if (data.employeeId !== undefined) {
      updates.push(`employee_id = $${paramIndex++}`);
      params.push(data.employeeId);
    }
    if (data.passwordHash !== undefined) {
      updates.push(`password_hash = $${paramIndex++}`);
      params.push(data.passwordHash);
    }
    if (data.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(data.isActive);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    params.push(id);
    const sql = `
      UPDATE users 
      SET ${updates.join(", ")}, updated_at = NOW() 
      WHERE id = $${paramIndex}
    `;
    await query(sql, params);
    return this.findById(id);
  }

  async updateStatus(id: string, isActive: boolean): Promise<UserItem | null> {
    await query(`
      UPDATE users 
      SET is_active = $1, updated_at = NOW() 
      WHERE id = $2
    `, [isActive, id]);
    return this.findById(id);
  }
}

export const usersRepository = new UsersRepository();
