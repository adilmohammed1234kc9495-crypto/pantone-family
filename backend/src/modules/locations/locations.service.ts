import { locationsRepository, LocationRow, LocationWithStats, FindLocationsOptions } from "./locations.repository";
import { branchesRepository } from "../branches/branches.repository";
import { AuthUser } from "../../middleware/auth.middleware";
import { assertCompanyAccess } from "../../middleware/tenant.middleware";
import { NotFoundError, ConflictError, ValidationError } from "../../utils/errors";
import { query } from "../../config/database";

export class LocationsService {
  async getLocations(user: AuthUser, options: FindLocationsOptions = {}): Promise<{ locations: LocationWithStats[]; total: number }> {
    const effectiveCompanyId = user.isCommonAdmin ? options.companyId : user.companyId || undefined;
    return locationsRepository.findWithStats({
      ...options,
      companyId: effectiveCompanyId,
    });
  }

  async getLocationById(id: string, user: AuthUser): Promise<LocationWithStats> {
    const loc = await locationsRepository.findById(id);
    if (!loc) {
      throw new NotFoundError(`Location with ID '${id}' not found`);
    }
    assertCompanyAccess(user, loc.company_id);
    return loc;
  }

  async createLocation(data: {
    companyId?: string;
    branchId?: string | null;
    building: string;
    floor?: string | null;
    roomNumber?: string | null;
    description?: string | null;
  }, user: AuthUser): Promise<LocationRow> {
    const targetCompanyId = user.isCommonAdmin ? (data.companyId || user.companyId) : user.companyId;
    if (!targetCompanyId) {
      throw new ConflictError("Company ID is required to create a location");
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

    const created = await locationsRepository.create({
      companyId: targetCompanyId,
      branchId: data.branchId || null,
      building: data.building.trim(),
      floor: data.floor || null,
      roomNumber: data.roomNumber || null,
      description: data.description || null,
    });

    // Audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, new_values_json)
      VALUES ($1, $2, 'LOCATION_CREATE', 'locations', $3, $4::jsonb)
    `, [targetCompanyId, user.id, created.id, JSON.stringify(created)]);

    return created;
  }

  async updateLocation(id: string, data: {
    branchId?: string | null;
    building?: string;
    floor?: string | null;
    roomNumber?: string | null;
    description?: string | null;
  }, user: AuthUser): Promise<LocationRow> {
    const loc = await this.getLocationById(id, user);

    if (data.branchId) {
      const branch = await branchesRepository.findById(data.branchId);
      if (!branch) {
        throw new NotFoundError(`Branch with ID '${data.branchId}' not found`);
      }
      if (branch.company_id !== loc.company_id) {
        throw new ValidationError("Branch does not belong to the selected company");
      }
    }

    const updated = await locationsRepository.update(id, data);

    // Audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, old_values_json, new_values_json)
      VALUES ($1, $2, 'LOCATION_UPDATE', 'locations', $3, $4::jsonb, $5::jsonb)
    `, [loc.company_id, user.id, id, JSON.stringify(loc), JSON.stringify(updated)]);

    return updated;
  }

  async updateStatus(id: string, isActive: boolean, user: AuthUser): Promise<LocationRow> {
    const loc = await this.getLocationById(id, user);

    const updated = await locationsRepository.updateStatus(id, isActive);

    // Audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, old_values_json, new_values_json)
      VALUES ($1, $2, 'LOCATION_STATUS_UPDATE', 'locations', $3, $4::jsonb, $5::jsonb)
    `, [
      loc.company_id,
      user.id,
      id,
      JSON.stringify({ is_active: loc.is_active }),
      JSON.stringify({ is_active: isActive }),
    ]);

    return updated;
  }
}

export const locationsService = new LocationsService();
