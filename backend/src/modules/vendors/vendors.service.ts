import { vendorsRepository, VendorRow, VendorWithStats, FindVendorsOptions } from "./vendors.repository";
import { AuthUser } from "../../middleware/auth.middleware";
import { assertCompanyAccess } from "../../middleware/tenant.middleware";
import { NotFoundError, ConflictError } from "../../utils/errors";
import { query } from "../../config/database";

export class VendorsService {
  async getVendors(user: AuthUser, options: FindVendorsOptions = {}): Promise<{ vendors: VendorWithStats[]; total: number }> {
    const effectiveCompanyId = user.isCommonAdmin ? options.companyId : user.companyId || undefined;
    return vendorsRepository.findWithStats({
      ...options,
      companyId: effectiveCompanyId,
    });
  }

  async getVendorById(id: string, user: AuthUser): Promise<VendorWithStats> {
    const vendor = await vendorsRepository.findById(id);
    if (!vendor) {
      throw new NotFoundError(`Vendor with ID '${id}' not found`);
    }
    assertCompanyAccess(user, vendor.company_id);
    return vendor;
  }

  async createVendor(data: {
    companyId?: string;
    code: string;
    name: string;
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    taxNumber?: string | null;
    rating?: number;
  }, user: AuthUser): Promise<VendorRow> {
    const targetCompanyId = user.isCommonAdmin ? (data.companyId || user.companyId) : user.companyId;
    if (!targetCompanyId) {
      throw new ConflictError("Company ID is required to create a vendor");
    }
    assertCompanyAccess(user, targetCompanyId);

    const existing = await vendorsRepository.findByCode(targetCompanyId, data.code);
    if (existing) {
      throw new ConflictError(`Vendor with code '${data.code}' already exists in this company`);
    }

    const created = await vendorsRepository.create({
      companyId: targetCompanyId,
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      contactPerson: data.contactPerson,
      email: data.email,
      phone: data.phone,
      address: data.address,
      taxNumber: data.taxNumber,
      rating: data.rating,
    });

    // Audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, new_values_json)
      VALUES ($1, $2, 'VENDOR_CREATE', 'vendors', $3, $4::jsonb)
    `, [targetCompanyId, user.id, created.id, JSON.stringify(created)]);

    return created;
  }

  async updateVendor(id: string, data: {
    name?: string;
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    taxNumber?: string | null;
    rating?: number;
  }, user: AuthUser): Promise<VendorRow> {
    const vendor = await this.getVendorById(id, user);

    const updated = await vendorsRepository.update(id, data);

    // Audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, old_values_json, new_values_json)
      VALUES ($1, $2, 'VENDOR_UPDATE', 'vendors', $3, $4::jsonb, $5::jsonb)
    `, [vendor.company_id, user.id, id, JSON.stringify(vendor), JSON.stringify(updated)]);

    return updated;
  }

  async updateStatus(id: string, isActive: boolean, user: AuthUser): Promise<VendorRow> {
    const vendor = await this.getVendorById(id, user);

    const updated = await vendorsRepository.updateStatus(id, isActive);

    // Audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, old_values_json, new_values_json)
      VALUES ($1, $2, 'VENDOR_STATUS_UPDATE', 'vendors', $3, $4::jsonb, $5::jsonb)
    `, [
      vendor.company_id,
      user.id,
      id,
      JSON.stringify({ is_active: vendor.is_active }),
      JSON.stringify({ is_active: isActive }),
    ]);

    return updated;
  }
}

export const vendorsService = new VendorsService();
