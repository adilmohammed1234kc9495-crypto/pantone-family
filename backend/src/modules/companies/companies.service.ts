import { companiesRepository, CompanyRow, CompanyWithStats, FindCompaniesOptions } from "./companies.repository";
import { NotFoundError, ConflictError } from "../../utils/errors";
import { query } from "../../config/database";

export class CompaniesService {
  async getAllCompanies(): Promise<CompanyRow[]> {
    return companiesRepository.findAll();
  }

  async getCompaniesWithStats(options: FindCompaniesOptions = {}): Promise<{ companies: CompanyWithStats[]; total: number }> {
    return companiesRepository.findWithStats(options);
  }

  async getCompanyById(id: string): Promise<CompanyRow> {
    const company = await companiesRepository.findById(id);
    if (!company) {
      throw new NotFoundError(`Company with ID '${id}' not found`);
    }
    return company;
  }

  async getCompanyDetailsWithStats(id: string): Promise<CompanyWithStats> {
    const company = await companiesRepository.findByIdWithStats(id);
    if (!company) {
      throw new NotFoundError(`Company with ID '${id}' not found`);
    }
    return company;
  }

  async createCompany(data: {
    code: string;
    name: string;
    taxId?: string;
    address?: string;
    phone?: string;
    email?: string;
  }, userId?: string): Promise<CompanyRow> {
    const existing = await companiesRepository.findByCode(data.code);
    if (existing) {
      throw new ConflictError(`Company code '${data.code}' is already registered`);
    }

    const created = await companiesRepository.create(data);

    // Audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, new_values_json)
      VALUES ($1, $2, 'COMPANY_CREATE', 'companies', $1, $3::jsonb)
    `, [created.id, userId || null, JSON.stringify(created)]);

    return created;
  }

  async updateCompany(id: string, data: {
    name?: string;
    taxId?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  }, userId?: string): Promise<CompanyRow> {
    const existing = await this.getCompanyById(id);

    const updated = await companiesRepository.update(id, data);
    if (!updated) {
      throw new NotFoundError(`Company with ID '${id}' not found`);
    }

    // Audit log with diff
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, old_values_json, new_values_json)
      VALUES ($1, $2, 'COMPANY_UPDATE', 'companies', $1, $3::jsonb, $4::jsonb)
    `, [
      id,
      userId || null,
      JSON.stringify(existing),
      JSON.stringify(updated)
    ]);

    return updated;
  }

  async setCompanyStatus(id: string, isActive: boolean, userId?: string): Promise<CompanyRow> {
    const company = await this.getCompanyById(id);
    const updated = await companiesRepository.updateStatus(id, isActive);
    if (!updated) {
      throw new NotFoundError(`Company with ID '${id}' not found`);
    }

    // Audit log
    await query(`
      INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, old_values_json, new_values_json)
      VALUES ($1, $2, 'COMPANY_STATUS_UPDATE', 'companies', $1, $3::jsonb, $4::jsonb)
    `, [
      id,
      userId || null,
      JSON.stringify({ is_active: company.is_active }),
      JSON.stringify({ is_active: isActive })
    ]);

    return updated;
  }

  async getCompanyActivity(id: string, limit = 20): Promise<Record<string, unknown>[]> {
    await this.getCompanyById(id); // Asserts existence
    return companiesRepository.getActivity(id, limit);
  }
}

export const companiesService = new CompaniesService();