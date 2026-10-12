import { query } from "../../config/database";

export interface LocationRow {
  id: string;
  company_id: string;
  branch_id: string | null;
  code?: string | null;
  name?: string | null;
  building: string | null;
  floor: string | null;
  room_number: string | null;
  room?: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocationWithStats extends LocationRow {
  company_name: string;
  branch_name: string | null;
  branch_code: string | null;
  assets_count: number;
}

export interface FindLocationsOptions {
  companyId?: string;
  branchId?: string;
  building?: string;
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sortBy?: "building" | "floor" | "room_number" | "created_at";
  sortOrder?: "asc" | "desc";
}

export class LocationsRepository {
  async findWithStats(options: FindLocationsOptions = {}): Promise<{ locations: LocationWithStats[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;
    const sortField = options.sortBy || "building";
    const sortOrder = options.sortOrder === "desc" ? "DESC" : "ASC";

    const conditions: string[] = [];
    const params: unknown[] = [];
    let pIdx = 1;

    if (options.companyId) {
      conditions.push(`l.company_id = $${pIdx++}`);
      params.push(options.companyId);
    }

    if (options.branchId) {
      conditions.push(`l.branch_id = $${pIdx++}`);
      params.push(options.branchId);
    }

    if (options.building) {
      conditions.push(`l.building ILIKE $${pIdx++}`);
      params.push(`%${options.building}%`);
    }

    if (options.isActive !== undefined) {
      conditions.push(`l.is_active = $${pIdx++}`);
      params.push(options.isActive);
    }

    if (options.search) {
      conditions.push(`(l.code ILIKE $${pIdx} OR l.name ILIKE $${pIdx} OR l.building ILIKE $${pIdx} OR l.floor ILIKE $${pIdx} OR l.room_number ILIKE $${pIdx} OR l.description ILIKE $${pIdx})`);
      params.push(`%${options.search}%`);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*) AS total FROM locations l ${whereClause}`;
    const countRes = await query<{ total: string }>(countSql, params);
    const total = parseInt(countRes.rows[0]?.total || "0", 10);

    const dataSql = `
      SELECT 
        l.id,
        l.company_id,
        c.name AS company_name,
        l.branch_id,
        b.name AS branch_name,
        b.code AS branch_code,
        COALESCE(l.code, 'LOC-' || UPPER(SUBSTRING(l.id::text, 1, 6))) AS code,
        COALESCE(l.name, l.description, l.building) AS name,
        l.building,
        l.floor,
        l.room_number,
        l.description,
        l.is_active,
        l.created_at,
        l.updated_at,
        COUNT(DISTINCT a.id) AS assets_count
      FROM locations l
      JOIN companies c ON c.id = l.company_id
      LEFT JOIN branches b ON b.id = l.branch_id
      LEFT JOIN assets a ON a.location_id = l.id
      ${whereClause}
      GROUP BY l.id, c.name, b.name, b.code, l.code, l.name
      ORDER BY l.${sortField} ${sortOrder}
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `;

    const dataRes = await query<Record<string, unknown>>(dataSql, [...params, limit, offset]);

    const locations: LocationWithStats[] = dataRes.rows.map((r) => ({
      id: r.id as string,
      company_id: r.company_id as string,
      company_name: r.company_name as string,
      branch_id: r.branch_id as string | null,
      branch_name: r.branch_name as string | null,
      branch_code: r.branch_code as string | null,
      code: (r.code as string) || `LOC-${(r.id as string).slice(0, 6).toUpperCase()}`,
      name: (r.name as string) || (r.building as string) || "Location",
      building: (r.building as string) || null,
      floor: r.floor as string | null,
      room_number: r.room_number as string | null,
      room: (r.room_number as string) || null,
      description: r.description as string | null,
      is_active: Boolean(r.is_active),
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      assets_count: parseInt((r.assets_count as string) || "0", 10),
    }));

    return { locations, total };
  }

  async findById(id: string): Promise<LocationWithStats | null> {
    const sql = `
      SELECT 
        l.id,
        l.company_id,
        c.name AS company_name,
        l.branch_id,
        b.name AS branch_name,
        b.code AS branch_code,
        COALESCE(l.code, 'LOC-' || UPPER(SUBSTRING(l.id::text, 1, 6))) AS code,
        COALESCE(l.name, l.description, l.building) AS name,
        l.building,
        l.floor,
        l.room_number,
        l.description,
        l.is_active,
        l.created_at,
        l.updated_at,
        COUNT(DISTINCT a.id) AS assets_count
      FROM locations l
      JOIN companies c ON c.id = l.company_id
      LEFT JOIN branches b ON b.id = l.branch_id
      LEFT JOIN assets a ON a.location_id = l.id
      WHERE l.id = $1
      GROUP BY l.id, c.name, b.name, b.code, l.code, l.name
    `;
    const res = await query<Record<string, unknown>>(sql, [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id as string,
      company_id: r.company_id as string,
      company_name: r.company_name as string,
      branch_id: r.branch_id as string | null,
      branch_name: r.branch_name as string | null,
      branch_code: r.branch_code as string | null,
      code: (r.code as string) || `LOC-${(r.id as string).slice(0, 6).toUpperCase()}`,
      name: (r.name as string) || (r.building as string) || "Location",
      building: (r.building as string) || null,
      floor: r.floor as string | null,
      room_number: r.room_number as string | null,
      room: (r.room_number as string) || null,
      description: r.description as string | null,
      is_active: Boolean(r.is_active),
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      assets_count: parseInt((r.assets_count as string) || "0", 10),
    };
  }

  async create(data: {
    companyId: string;
    branchId?: string | null;
    code?: string | null;
    name?: string | null;
    building?: string | null;
    floor?: string | null;
    roomNumber?: string | null;
    description?: string | null;
  }): Promise<LocationRow> {
    const building = data.building?.trim() || data.name?.trim() || "Main Facility";
    const name = data.name?.trim() || data.building?.trim() || "Location";
    const code = data.code?.trim() || `LOC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const res = await query<LocationRow>(`
      INSERT INTO locations (company_id, branch_id, code, name, building, floor, room_number, description, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING *, room_number AS room
    `, [data.companyId, data.branchId || null, code, name, building, data.floor || null, data.roomNumber || null, data.description || null]);
    return res.rows[0];
  }

  async update(id: string, data: {
    branchId?: string | null;
    code?: string | null;
    name?: string | null;
    building?: string | null;
    floor?: string | null;
    roomNumber?: string | null;
    description?: string | null;
  }): Promise<LocationRow> {
    const res = await query<LocationRow>(`
      UPDATE locations
      SET code = COALESCE($1, code),
          name = COALESCE($2, name),
          building = COALESCE($3, building),
          branch_id = $4,
          floor = $5,
          room_number = $6,
          description = $7,
          updated_at = NOW()
      WHERE id = $8
      RETURNING *, room_number AS room
    `, [
      data.code || null,
      data.name || null,
      data.building || null,
      data.branchId !== undefined ? data.branchId : null,
      data.floor !== undefined ? data.floor : null,
      data.roomNumber !== undefined ? data.roomNumber : null,
      data.description !== undefined ? data.description : null,
      id
    ]);
    return res.rows[0];
  }

  async updateStatus(id: string, isActive: boolean): Promise<LocationRow> {
    const res = await query<LocationRow>(`
      UPDATE locations
      SET is_active = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [isActive, id]);
    return res.rows[0];
  }
}

export const locationsRepository = new LocationsRepository();
