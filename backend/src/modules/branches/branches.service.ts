import { branchesRepository, BranchRow, BranchWithStats, FindBranchesOptions } from "./branches.repository";
import { AuthUser } from "../../middleware/auth.middleware";
import { assertCompanyAccess } from "../../middleware/tenant.middleware";
import { NotFoundError, ConflictError } from "../../utils/errors";
import { query } from "../../config/database";

export class BranchesService {
  async getBranches(user: AuthUser, options: FindBranchesOptions = {}): Promise<{ branches: BranchWithStats[]; total: number }> {
    const effectiveCompanyId = user.isCommonAdmin ? options.companyId : user.companyId || undefined;
    return branchesRepository.findWithStats({
      ...options,
      companyId: effectiveCompanyId,
    });
  }

  async getBranchById(id: string, user: AuthUser): Promise<BranchWithStats> {
    const branch = await branchesRepository.findById(id);
    if (!branch) {
      throw new NotFoundError(`Branch with ID '${id}' not found`);
    }
    assertCompanyAccess(user, branch.company_id);
    return branch;
  }

  async createBranch(data: {
    companyId?: string;
    code: string;
    name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
  }, user: AuthUser): Promise<BranchRow> {
    const targetCompanyId = user.isCommonAdmin ? (data.companyId || user.companyId) : user.companyId;
    if (!targetCompanyId) {
      throw new ConflictError("Company ID is required to create a branch");
    }
    assertCompanyAccess(user, targetCompanyId);

    const existing = await branchesRepository.findByCode(targetCompanyId, data.code);
    if (existing) {
      throw new ConflictError(`Branch with code '${data.code}' already exists in this company`);
    }

    const created = await branchesRepository.create({
      companyId: targetCompanyId,
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      address: data.address,
      city: data.city,
      state: data.state,
    });

    // Audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, new_values_json)
      VALUES ($1, $2, 'BRANCH_CREATE', 'branches', $3, $4::jsonb)
    `, [targetCompanyId, user.id, created.id, JSON.stringify(created)]);

    return created;
  }

  async updateBranch(id: string, data: {
    name?: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
  }, user: AuthUser): Promise<BranchRow> {
    const branch = await this.getBranchById(id, user);

    const updated = await branchesRepository.update(id, data);

    // Audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, old_values_json, new_values_json)
      VALUES ($1, $2, 'BRANCH_UPDATE', 'branches', $3, $4::jsonb, $5::jsonb)
    `, [branch.company_id, user.id, id, JSON.stringify(branch), JSON.stringify(updated)]);

    return updated;
  }

  async updateStatus(id: string, isActive: boolean, user: AuthUser): Promise<BranchRow> {
    const branch = await this.getBranchById(id, user);

    const updated = await branchesRepository.updateStatus(id, isActive);

    // Audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, old_values_json, new_values_json)
      VALUES ($1, $2, 'BRANCH_STATUS_UPDATE', 'branches', $3, $4::jsonb, $5::jsonb)
    `, [
      branch.company_id,
      user.id,
      id,
      JSON.stringify({ is_active: branch.is_active }),
      JSON.stringify({ is_active: isActive }),
    ]);

    return updated;
  }
}

export const branchesService = new BranchesService();
