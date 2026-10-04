import {
  categoriesRepository,
  CategoryRow,
  CategoryWithStats,
  CategoryTreeNode,
  FindCategoriesOptions
} from "./categories.repository";
import { AuthUser } from "../../middleware/auth.middleware";
import { assertCompanyAccess } from "../../middleware/tenant.middleware";
import { NotFoundError, ConflictError, ValidationError } from "../../utils/errors";
import { query } from "../../config/database";

export class CategoriesService {
  async getCategories(user: AuthUser, options: FindCategoriesOptions = {}): Promise<{ categories: CategoryWithStats[]; total: number }> {
    const effectiveCompanyId = user.isCommonAdmin ? options.companyId : user.companyId || undefined;
    return categoriesRepository.findWithStats({
      ...options,
      companyId: effectiveCompanyId,
    });
  }

  async getCategoryTree(user: AuthUser, companyId?: string): Promise<CategoryTreeNode[]> {
    const effectiveCompanyId = user.isCommonAdmin ? companyId : user.companyId || undefined;
    const flatList = await categoriesRepository.findAllForTree(effectiveCompanyId);
    return this.buildTree(flatList);
  }

  private buildTree(items: CategoryWithStats[]): CategoryTreeNode[] {
    const map = new Map<string, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];

    for (const item of items) {
      map.set(item.id, { ...item, children: [] });
    }

    for (const item of items) {
      const node = map.get(item.id)!;
      if (item.parent_id && map.has(item.parent_id)) {
        map.get(item.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async getCategoryById(id: string, user: AuthUser): Promise<CategoryWithStats> {
    const category = await categoriesRepository.findById(id);
    if (!category) {
      throw new NotFoundError(`Asset Category with ID '${id}' not found`);
    }
    if (category.company_id) {
      assertCompanyAccess(user, category.company_id);
    }
    return category;
  }

  async createCategory(data: {
    companyId?: string | null;
    code: string;
    name: string;
    description?: string | null;
    depreciationMethod?: string;
    depreciationRatePercent?: number;
    usefulLifeMonths?: number;
    parentId?: string | null;
  }, user: AuthUser): Promise<CategoryRow> {
    // If user is not Common Admin, category is strictly company-scoped to user's company
    const targetCompanyId = user.isCommonAdmin ? (data.companyId || null) : user.companyId;

    if (data.parentId) {
      const parent = await categoriesRepository.findById(data.parentId);
      if (!parent) {
        throw new NotFoundError(`Parent Category with ID '${data.parentId}' not found`);
      }
      if (parent.company_id && targetCompanyId && parent.company_id !== targetCompanyId) {
        throw new ValidationError("Parent category belongs to another company");
      }
    }

    const existing = await categoriesRepository.findByCode(data.code, targetCompanyId);
    if (existing) {
      throw new ConflictError(`Category with code '${data.code}' already exists`);
    }

    if (data.depreciationMethod && data.depreciationMethod.toUpperCase() !== "STRAIGHT_LINE") {
      throw new ValidationError(`Unsupported depreciation method '${data.depreciationMethod}'. Only 'STRAIGHT_LINE' is supported.`);
    }

    if (data.usefulLifeMonths !== undefined && data.usefulLifeMonths <= 0) {
      throw new ValidationError("Useful life in months must be greater than 0");
    }

    const created = await categoriesRepository.create({
      companyId: targetCompanyId,
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      description: data.description,
      depreciationMethod: data.depreciationMethod || "STRAIGHT_LINE",
      depreciationRatePercent: data.depreciationRatePercent,
      usefulLifeMonths: data.usefulLifeMonths,
      parentId: data.parentId || null,
    });

    // Audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, new_values_json)
      VALUES ($1, $2, 'CATEGORY_CREATE', 'asset_categories', $3, $4::jsonb)
    `, [targetCompanyId, user.id, created.id, JSON.stringify(created)]);

    return created;
  }

  async updateCategory(id: string, data: {
    name?: string;
    description?: string | null;
    depreciationMethod?: string;
    depreciationRatePercent?: number;
    usefulLifeMonths?: number;
    parentId?: string | null;
  }, user: AuthUser): Promise<CategoryRow> {
    const existing = await this.getCategoryById(id, user);

    if (data.parentId !== undefined && data.parentId !== null) {
      if (data.parentId === id) {
        throw new ValidationError("A category cannot be its own parent");
      }

      const parent = await categoriesRepository.findById(data.parentId);
      if (!parent) {
        throw new NotFoundError(`Parent Category with ID '${data.parentId}' not found`);
      }

      if (parent.company_id && existing.company_id && parent.company_id !== existing.company_id) {
        throw new ValidationError("Parent category belongs to another company");
      }

      // Detect circular parent relationships by walking up ancestor tree
      let currentParentId: string | null = parent.parent_id;
      const visited = new Set<string>([id, data.parentId]);

      while (currentParentId) {
        if (currentParentId === id) {
          throw new ValidationError("Circular parent category relationship detected");
        }
        if (visited.has(currentParentId)) {
          break;
        }
        visited.add(currentParentId);
        const ancestor = await categoriesRepository.findById(currentParentId);
        currentParentId = ancestor?.parent_id || null;
      }
    }

    if (data.depreciationMethod && data.depreciationMethod.toUpperCase() !== "STRAIGHT_LINE") {
      throw new ValidationError(`Unsupported depreciation method '${data.depreciationMethod}'. Only 'STRAIGHT_LINE' is supported.`);
    }

    if (data.usefulLifeMonths !== undefined && data.usefulLifeMonths <= 0) {
      throw new ValidationError("Useful life in months must be greater than 0");
    }

    const updated = await categoriesRepository.update(id, data);

    // Audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, old_values_json, new_values_json)
      VALUES ($1, $2, 'CATEGORY_UPDATE', 'asset_categories', $3, $4::jsonb, $5::jsonb)
    `, [existing.company_id, user.id, id, JSON.stringify(existing), JSON.stringify(updated)]);

    return updated;
  }

  async updateStatus(id: string, isActive: boolean, user: AuthUser): Promise<CategoryRow> {
    const existing = await this.getCategoryById(id, user);

    const updated = await categoriesRepository.updateStatus(id, isActive);

    // Audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, old_values_json, new_values_json)
      VALUES ($1, $2, 'CATEGORY_STATUS_UPDATE', 'asset_categories', $3, $4::jsonb, $5::jsonb)
    `, [
      existing.company_id,
      user.id,
      id,
      JSON.stringify({ is_active: existing.is_active }),
      JSON.stringify({ is_active: isActive }),
    ]);

    return updated;
  }
}

export const categoriesService = new CategoriesService();
