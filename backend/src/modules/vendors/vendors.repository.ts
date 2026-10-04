import { query } from "../../config/database";

export interface VendorRow {
  id: string;
  company_id: string;
  code: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_number: string | null;
  rating: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VendorWithStats extends VendorRow {
  company_name: string;
  assets_count: number;
}

export interface FindVendorsOptions {
  companyId?: string;
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sortBy?: "code" | "name" | "rating" | "created_at";
  sortOrder?: "asc" | "desc";
}

export class VendorsRepository {
  async findWithStats(options: FindVendorsOptions = {}): Promise<{ vendors: VendorWithStats[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;
    const sortField = options.sortBy || "name";
    const sortOrder = options.sortOrder === "desc" ? "DESC" : "ASC";

    const conditions: string[] = [];
    const params: unknown[] = [];
    let pIdx = 1;

    if (options.companyId) {
      conditions.push(`v.company_id = $${pIdx++}`);
      params.push(options.companyId);
    }

    if (options.isActive !== undefined) {
      conditions.push(`v.is_active = $${pIdx++}`);
      params.push(options.isActive);
    }

    if (options.search) {
      conditions.push(`(v.code ILIKE $${pIdx} OR v.name ILIKE $${pIdx} OR v.contact_person ILIKE $${pIdx} OR v.email ILIKE $${pIdx} OR v.tax_number ILIKE $${pIdx})`);
      params.push(`%${options.search}%`);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*) AS total FROM vendors v ${whereClause}`;
    const countRes = await query<{ total: string }>(countSql, params);
    const total = parseInt(countRes.rows[0]?.total || "0", 10);

    const dataSql = `
      SELECT 
        v.id,
        v.company_id,
        c.name AS company_name,
        v.code,
        v.name,
        v.contact_person,
        v.email,
        v.phone,
        v.address,
        v.tax_number,
        v.rating,
        v.is_active,
        v.created_at,
        v.updated_at,
        COUNT(DISTINCT a.id) AS assets_count
      FROM vendors v
      JOIN companies c ON c.id = v.company_id
      LEFT JOIN assets a ON a.vendor_id = v.id
      ${whereClause}
      GROUP BY v.id, c.name
      ORDER BY v.${sortField} ${sortOrder}
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `;

    const dataRes = await query<Record<string, unknown>>(dataSql, [...params, limit, offset]);

    const vendors: VendorWithStats[] = dataRes.rows.map((r) => ({
      id: r.id as string,
      company_id: r.company_id as string,
      company_name: r.company_name as string,
      code: r.code as string,
      name: r.name as string,
      contact_person: r.contact_person as string | null,
      email: r.email as string | null,
      phone: r.phone as string | null,
      address: r.address as string | null,
      tax_number: r.tax_number as string | null,
      rating: parseFloat((r.rating as string) || "5.00"),
      is_active: Boolean(r.is_active),
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      assets_count: parseInt((r.assets_count as string) || "0", 10),
    }));

    return { vendors, total };
  }

  async findById(id: string): Promise<VendorWithStats | null> {
    const sql = `
      SELECT 
        v.id,
        v.company_id,
        c.name AS company_name,
        v.code,
        v.name,
        v.contact_person,
        v.email,
        v.phone,
        v.address,
        v.tax_number,
        v.rating,
        v.is_active,
        v.created_at,
        v.updated_at,
        COUNT(DISTINCT a.id) AS assets_count
      FROM vendors v
      JOIN companies c ON c.id = v.company_id
      LEFT JOIN assets a ON a.vendor_id = v.id
      WHERE v.id = $1
      GROUP BY v.id, c.name
    `;
    const res = await query<Record<string, unknown>>(sql, [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id as string,
      company_id: r.company_id as string,
      company_name: r.company_name as string,
      code: r.code as string,
      name: r.name as string,
      contact_person: r.contact_person as string | null,
      email: r.email as string | null,
      phone: r.phone as string | null,
      address: r.address as string | null,
      tax_number: r.tax_number as string | null,
      rating: parseFloat((r.rating as string) || "5.00"),
      is_active: Boolean(r.is_active),
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      assets_count: parseInt((r.assets_count as string) || "0", 10),
    };
  }

  async findByCode(companyId: string, code: string): Promise<VendorRow | null> {
    const res = await query<VendorRow>(
      "SELECT * FROM vendors WHERE company_id = $1 AND code = $2",
      [companyId, code]
    );
    return res.rows[0] || null;
  }

  async create(data: {
    companyId: string;
    code: string;
    name: string;
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    taxNumber?: string | null;
    rating?: number;
  }): Promise<VendorRow> {
    const res = await query<VendorRow>(`
      INSERT INTO vendors (company_id, code, name, contact_person, email, phone, address, tax_number, rating, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING *
    `, [
      data.companyId,
      data.code,
      data.name,
      data.contactPerson || null,
      data.email || null,
      data.phone || null,
      data.address || null,
      data.taxNumber || null,
      data.rating !== undefined ? data.rating : 5.00,
    ]);
    return res.rows[0];
  }

  async update(id: string, data: {
    name?: string;
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    taxNumber?: string | null;
    rating?: number;
  }): Promise<VendorRow> {
    const res = await query<VendorRow>(`
      UPDATE vendors
      SET name = COALESCE($1, name),
          contact_person = COALESCE($2, contact_person),
          email = COALESCE($3, email),
          phone = COALESCE($4, phone),
          address = COALESCE($5, address),
          tax_number = COALESCE($6, tax_number),
          rating = COALESCE($7, rating),
          updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `, [
      data.name || null,
      data.contactPerson !== undefined ? data.contactPerson : null,
      data.email !== undefined ? data.email : null,
      data.phone !== undefined ? data.phone : null,
      data.address !== undefined ? data.address : null,
      data.taxNumber !== undefined ? data.taxNumber : null,
      data.rating !== undefined ? data.rating : null,
      id
    ]);
    return res.rows[0];
  }

  async updateStatus(id: string, isActive: boolean): Promise<VendorRow> {
    const res = await query<VendorRow>(`
      UPDATE vendors
      SET is_active = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [isActive, id]);
    return res.rows[0];
  }
}

export const vendorsRepository = new VendorsRepository();
