import { departmentsRepository, DepartmentRow, DepartmentWithStats, FindDepartmentsOptions } from "./departments.repository";
import { branchesRepository } from "../branches/branches.repository";
import { AuthUser } from "../../middleware/auth.middleware";
import { assertCompanyAccess } from "../../middleware/tenant.middleware";
import { NotFoundError, ConflictError, ValidationError } from "../../utils/errors";
import { query } from "../../config/database";

export class DepartmentsService {
  async getDepartments(user: AuthUser, options: FindDepartmentsOptions = {}): Promise<{ departments: DepartmentWithStats[]; total: number }> {
    const effectiveCompanyId = user.isCommonAdmin ? options.companyId : user.companyId || undefined;
    return departmentsRepository.findWithStats({
      ...options,
      companyId: effectiveCompanyId,
    });
  }

  async getDepartmentById(id: string, user: AuthUser): Promise<DepartmentWithStats> {
    const dept = await departmentsRepository.findById(id);
    if (!dept) {
      throw new NotFoundError(`Department with ID '${id}' not found`);
    }
    assertCompanyAccess(user, dept.company_id);
    return dept;
  }

  async createDepartment(data: {
    companyId?: string;
    branchId?: string | null;
    code: string;
    name: string;
    headEmployeeId?: string | null;
  }, user: AuthUser): Promise<DepartmentRow> {
    const targetCompanyId = user.isCommonAdmin ? (data.companyId || user.companyId) : user.companyId;
    if (!targetCompanyId) {
      throw new ConflictError("Company ID is required to create a department");
    }
    assertCompanyAccess(user, targetCompanyId);

    // Validate branch belongs to the same company
    if (data.branchId) {
      const branch = await branchesRepository.findById(data.branchId);
      if (!branch) {
        throw new NotFoundError(`Branch with ID '${data.branchId}' not found`);
      }
      if (branch.company_id !== targetCompanyId) {
        throw new ValidationError("Branch does not belong to the selected company");
      }
    }

    const existing = await departmentsRepository.findByCode(targetCompanyId, data.code);
    if (existing) {
      throw new ConflictError(`Department with code '${data.code}' already exists in this company`);
    }

    const created = await departmentsRepository.create({
      companyId: targetCompanyId,
      branchId: data.branchId || null,
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      headEmployeeId: data.headEmployeeId || null,
    });

    // Audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, new_values_json)
      VALUES ($1, $2, 'DEPARTMENT_CREATE', 'departments', $3, $4::jsonb)
    `, [targetCompanyId, user.id, created.id, JSON.stringify(created)]);

    return created;
  }

  async updateDepartment(id: string, data: {
    name?: string;
    branchId?: string | null;
    headEmployeeId?: string | null;
  }, user: AuthUser): Promise<DepartmentRow> {
    const dept = await this.getDepartmentById(id, user);

    if (data.branchId) {
      const branch = await branchesRepository.findById(data.branchId);
      if (!branch) {
        throw new NotFoundError(`Branch with ID '${data.branchId}' not found`);
      }
      if (branch.company_id !== dept.company_id) {
        throw new ValidationError("Branch does not belong to the selected company");
      }
    }

    const updated = await departmentsRepository.update(id, data);

    // Audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, old_values_json, new_values_json)
      VALUES ($1, $2, 'DEPARTMENT_UPDATE', 'departments', $3, $4::jsonb, $5::jsonb)
    `, [dept.company_id, user.id, id, JSON.stringify(dept), JSON.stringify(updated)]);

    return updated;
  }

  async updateStatus(id: string, isActive: boolean, user: AuthUser): Promise<DepartmentRow> {
    const dept = await this.getDepartmentById(id, user);

    const updated = await departmentsRepository.updateStatus(id, isActive);

    // Audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, old_values_json, new_values_json)
      VALUES ($1, $2, 'DEPARTMENT_STATUS_UPDATE', 'departments', $3, $4::jsonb, $5::jsonb)
    `, [
      dept.company_id,
      user.id,
      id,
      JSON.stringify({ is_active: dept.is_active }),
      JSON.stringify({ is_active: isActive }),
    ]);

    return updated;
  }
}

export const departmentsService = new DepartmentsService();
