import { usersRepository, UserItem, FindUsersOptions } from "./users.repository";
import { NotFoundError, ConflictError, BadRequestError, ForbiddenError } from "../../utils/errors";
import { hashPassword } from "../../utils/crypto";
import { query } from "../../config/database";
import { AuthUser } from "../../middleware/auth.middleware";

export class UsersService {
  async getUsers(options: FindUsersOptions = {}): Promise<{ users: UserItem[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const result = await usersRepository.findUsers({ ...options, page, limit });
    return {
      users: result.users,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit)
    };
  }

  async getUserById(id: string): Promise<UserItem> {
    const user = await usersRepository.findById(id);
    if (!user) {
      throw new NotFoundError(`User with ID '${id}' not found`);
    }
    return user;
  }

  async createUser(data: {
    username: string;
    email: string;
    password: string;
    roleId: string;
    companyId?: string | null;
    employeeId?: string | null;
  }, actor: AuthUser): Promise<UserItem> {
    // 1. Check duplicate username
    const existingUser = await usersRepository.findByUsername(data.username);
    if (existingUser) {
      throw new ConflictError(`Username '${data.username}' is already in use`);
    }

    // 2. Check duplicate email
    const existingEmail = await usersRepository.findByEmail(data.email);
    if (existingEmail) {
      throw new ConflictError(`Email '${data.email}' is already registered`);
    }

    // 3. Verify role exists
    const roleRes = await query<{ id: string; code: string; company_id: string | null }>(
      "SELECT id, code, company_id FROM roles WHERE id = $1",
      [data.roleId]
    );
    if (roleRes.rows.length === 0) {
      throw new BadRequestError("Invalid role ID specified");
    }
    const role = roleRes.rows[0];

    // 4. Tenancy & RBAC validation
    let targetCompanyId = data.companyId;

    if (!actor.isCommonAdmin) {
      // Company Admin can only create users in their own company
      if (targetCompanyId && targetCompanyId !== actor.companyId) {
        throw new ForbiddenError("Cannot create a user outside your own company");
      }
      targetCompanyId = actor.companyId;

      // Cannot assign COMMON_ADMIN role
      if (role.code === "COMMON_ADMIN" || role.company_id === null) {
        throw new ForbiddenError("Company administrators cannot assign global administrative roles");
      }
    }

    // Hash password securely (12 rounds)
    const passwordHash = await hashPassword(data.password);

    const created = await usersRepository.create({
      username: data.username,
      email: data.email,
      passwordHash,
      roleId: data.roleId,
      companyId: targetCompanyId,
      employeeId: data.employeeId || null
    });

    // Write audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, new_values_json)
      VALUES ($1, $2, 'USER_CREATE', 'users', $3, $4::jsonb)
    `, [
      targetCompanyId || null,
      actor.id,
      created.id,
      JSON.stringify({
        username: created.username,
        email: created.email,
        role: created.role_code,
        companyId: created.company_id
      })
    ]);

    return created;
  }

  async updateUser(id: string, data: {
    email?: string;
    roleId?: string;
    employeeId?: string | null;
    password?: string;
    isActive?: boolean;
  }, actor: AuthUser): Promise<UserItem> {
    const existing = await this.getUserById(id);

    if (!actor.isCommonAdmin && existing.company_id !== actor.companyId) {
      throw new ForbiddenError("Cannot update users belonging to another company");
    }

    let passwordHash: string | undefined;
    if (data.password) {
      passwordHash = await hashPassword(data.password);
    }

    if (data.roleId && !actor.isCommonAdmin) {
      const roleRes = await query<{ code: string }>("SELECT code FROM roles WHERE id = $1", [data.roleId]);
      if (roleRes.rows[0]?.code === "COMMON_ADMIN") {
        throw new ForbiddenError("Cannot assign global admin role");
      }
    }

    const updated = await usersRepository.update(id, {
      email: data.email,
      roleId: data.roleId,
      employeeId: data.employeeId,
      passwordHash,
      isActive: data.isActive
    });

    if (!updated) {
      throw new NotFoundError(`User '${id}' not found`);
    }

    // Write audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, old_values_json, new_values_json)
      VALUES ($1, $2, 'USER_UPDATE', 'users', $3, $4::jsonb, $5::jsonb)
    `, [
      updated.company_id,
      actor.id,
      id,
      JSON.stringify({ email: existing.email, role_id: existing.role_id, is_active: existing.is_active }),
      JSON.stringify({ email: updated.email, role_id: updated.role_id, is_active: updated.is_active })
    ]);

    return updated;
  }

  async setUserStatus(id: string, isActive: boolean, actor: AuthUser): Promise<UserItem> {
    const existing = await this.getUserById(id);

    if (!actor.isCommonAdmin && existing.company_id !== actor.companyId) {
      throw new ForbiddenError("Cannot modify status of users belonging to another company");
    }

    const updated = await usersRepository.updateStatus(id, isActive);
    if (!updated) {
      throw new NotFoundError(`User '${id}' not found`);
    }

    // Write audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, old_values_json, new_values_json)
      VALUES ($1, $2, 'USER_STATUS_UPDATE', 'users', $3, $4::jsonb, $5::jsonb)
    `, [
      updated.company_id,
      actor.id,
      id,
      JSON.stringify({ is_active: existing.is_active }),
      JSON.stringify({ is_active: isActive })
    ]);

    return updated;
  }
}

export const usersService = new UsersService();
