import { query } from "../../config/database";
import { AuthUser } from "../../middleware/auth.middleware";
import { assertCompanyAccess } from "../../middleware/tenant.middleware";
import { NotFoundError } from "../../utils/errors";

export interface AssetRow {
  id: string;
  company_id: string;
  branch_id: string | null;
  department_id: string | null;
  location_id: string | null;
  assigned_employee_id: string | null;
  category_id: string;
  vendor_id: string | null;
  asset_tag: string;
  barcode: string;
  qr_code: string;
  name: string;
  subcategory: string | null;
  description: string | null;
  serial_number: string | null;
  model_number: string | null;
  manufacturer: string | null;
  purchase_date: string | null;
  purchase_cost: number;
  current_value: number;
  invoice_number: string | null;
  warranty_start: string | null;
  warranty_end: string | null;
  status: string;
  condition: string;
  photo_url: string | null;
  notes: string | null;
  depreciation_method: string | null;
  depreciation_rate_percent: number | null;
  useful_life_months: number | null;
  depreciation_start_date: string | null;
  accumulated_depreciation: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetWithDetails extends AssetRow {
  company_name: string;
  company_code: string;
  branch_name: string | null;
  branch_code: string | null;
  department_name: string | null;
  department_code: string | null;
  location_building: string | null;
  location_floor: string | null;
  location_room: string | null;
  category_name: string;
  category_code: string;
  vendor_name: string | null;
  vendor_code: string | null;
  documents_count: number;
  photos_count: number;
}

export interface FindAssetsOptions {
  companyId?: string;
  branchId?: string;
  departmentId?: string;
  locationId?: string;
  categoryId?: string;
  vendorId?: string;
  status?: string;
  condition?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: "name" | "asset_tag" | "purchase_cost" | "current_value" | "purchase_date" | "created_at";
  sortOrder?: "asc" | "desc";
}

export interface DocumentRow {
  id: string;
  asset_id: string;
  title: string;
  document_type: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface PhotoRow {
  id: string;
  asset_id: string;
  photo_type: string;
  file_path: string;
  caption: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

export class AssetsRepository {
  async findById(id: string, user: AuthUser): Promise<AssetRow | null> {
    if (user.isCommonAdmin) {
      const res = await query<AssetRow>("SELECT * FROM assets WHERE id = $1", [id]);
      return res.rows[0] || null;
    }

    // Strict IDOR Protection: Always enforce company_id in SQL query
    const res = await query<AssetRow>(
      "SELECT * FROM assets WHERE id = $1 AND company_id = $2",
      [id, user.companyId]
    );

    if (res.rows.length === 0) {
      const existsInOther = await query("SELECT company_id FROM assets WHERE id = $1", [id]);
      if (existsInOther.rows.length > 0) {
        assertCompanyAccess(user, existsInOther.rows[0].company_id);
      }
      return null;
    }

    return res.rows[0];
  }

  async findByIdDetailed(id: string, user: AuthUser): Promise<AssetWithDetails | null> {
    const asset = await this.findById(id, user);
    if (!asset) return null;

    const sql = `
      SELECT 
        a.*,
        c.name AS company_name,
        c.code AS company_code,
        b.name AS branch_name,
        b.code AS branch_code,
        d.name AS department_name,
        d.code AS department_code,
        l.building AS location_building,
        l.floor AS location_floor,
        l.room_number AS location_room,
        cat.name AS category_name,
        cat.code AS category_code,
        v.name AS vendor_name,
        v.code AS vendor_code,
        COUNT(DISTINCT doc.id) AS documents_count,
        COUNT(DISTINCT ph.id) AS photos_count
      FROM assets a
      JOIN companies c ON c.id = a.company_id
      LEFT JOIN branches b ON b.id = a.branch_id
      LEFT JOIN departments d ON d.id = a.department_id
      LEFT JOIN locations l ON l.id = a.location_id
      JOIN asset_categories cat ON cat.id = a.category_id
      LEFT JOIN vendors v ON v.id = a.vendor_id
      LEFT JOIN asset_documents doc ON doc.asset_id = a.id
      LEFT JOIN asset_photos ph ON ph.asset_id = a.id
      WHERE a.id = $1
      GROUP BY a.id, c.name, c.code, b.name, b.code, d.name, d.code, l.building, l.floor, l.room_number, cat.name, cat.code, v.name, v.code
    `;

    const res = await query<Record<string, unknown>>(sql, [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    return {
      ...(r as unknown as AssetRow),
      company_name: r.company_name as string,
      company_code: r.company_code as string,
      branch_name: r.branch_name as string | null,
      branch_code: r.branch_code as string | null,
      department_name: r.department_name as string | null,
      department_code: r.department_code as string | null,
      location_building: r.location_building as string | null,
      location_floor: r.location_floor as string | null,
      location_room: r.location_room as string | null,
      category_name: r.category_name as string,
      category_code: r.category_code as string,
      vendor_name: r.vendor_name as string | null,
      vendor_code: r.vendor_code as string | null,
      purchase_cost: parseFloat((r.purchase_cost as string) || "0"),
      current_value: parseFloat((r.current_value as string) || "0"),
      depreciation_rate_percent: r.depreciation_rate_percent ? parseFloat(r.depreciation_rate_percent as string) : null,
      useful_life_months: r.useful_life_months ? parseInt(r.useful_life_months as string, 10) : null,
      accumulated_depreciation: parseFloat((r.accumulated_depreciation as string) || "0"),
      documents_count: parseInt((r.documents_count as string) || "0", 10),
      photos_count: parseInt((r.photos_count as string) || "0", 10),
    };
  }

  async findWithFilters(user: AuthUser, options: FindAssetsOptions = {}): Promise<{ assets: AssetWithDetails[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;
    const sortField = options.sortBy || "created_at";
    const sortOrder = options.sortOrder === "asc" ? "ASC" : "DESC";

    const conditions: string[] = [];
    const params: unknown[] = [];
    let pIdx = 1;

    // Enforce company scoping
    const effectiveCompanyId = user.isCommonAdmin ? options.companyId : user.companyId;
    if (effectiveCompanyId) {
      conditions.push(`a.company_id = $${pIdx++}`);
      params.push(effectiveCompanyId);
    }

    if (options.branchId) {
      conditions.push(`a.branch_id = $${pIdx++}`);
      params.push(options.branchId);
    }

    if (options.departmentId) {
      conditions.push(`a.department_id = $${pIdx++}`);
      params.push(options.departmentId);
    }

    if (options.locationId) {
      conditions.push(`a.location_id = $${pIdx++}`);
      params.push(options.locationId);
    }

    if (options.categoryId) {
      conditions.push(`a.category_id = $${pIdx++}`);
      params.push(options.categoryId);
    }

    if (options.vendorId) {
      conditions.push(`a.vendor_id = $${pIdx++}`);
      params.push(options.vendorId);
    }

    if (options.status) {
      conditions.push(`a.status = $${pIdx++}`);
      params.push(options.status);
    }

    if (options.condition) {
      conditions.push(`a.condition = $${pIdx++}`);
      params.push(options.condition);
    }

    if (options.search) {
      conditions.push(`(
        a.asset_tag ILIKE $${pIdx} OR 
        a.name ILIKE $${pIdx} OR 
        a.barcode ILIKE $${pIdx} OR 
        a.serial_number ILIKE $${pIdx} OR 
        a.model_number ILIKE $${pIdx} OR 
        a.manufacturer ILIKE $${pIdx}
      )`);
      params.push(`%${options.search}%`);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*) AS total FROM assets a ${whereClause}`;
    const countRes = await query<{ total: string }>(countSql, params);
    const total = parseInt(countRes.rows[0]?.total || "0", 10);

    const dataSql = `
      SELECT 
        a.*,
        c.name AS company_name,
        c.code AS company_code,
        b.name AS branch_name,
        b.code AS branch_code,
        d.name AS department_name,
        d.code AS department_code,
        l.building AS location_building,
        l.floor AS location_floor,
        l.room_number AS location_room,
        cat.name AS category_name,
        cat.code AS category_code,
        v.name AS vendor_name,
        v.code AS vendor_code,
        COUNT(DISTINCT doc.id) AS documents_count,
        COUNT(DISTINCT ph.id) AS photos_count
      FROM assets a
      JOIN companies c ON c.id = a.company_id
      LEFT JOIN branches b ON b.id = a.branch_id
      LEFT JOIN departments d ON d.id = a.department_id
      LEFT JOIN locations l ON l.id = a.location_id
      JOIN asset_categories cat ON cat.id = a.category_id
      LEFT JOIN vendors v ON v.id = a.vendor_id
      LEFT JOIN asset_documents doc ON doc.asset_id = a.id
      LEFT JOIN asset_photos ph ON ph.asset_id = a.id
      ${whereClause}
      GROUP BY a.id, c.name, c.code, b.name, b.code, d.name, d.code, l.building, l.floor, l.room_number, cat.name, cat.code, v.name, v.code
      ORDER BY a.${sortField} ${sortOrder}
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `;

    const dataRes = await query<Record<string, unknown>>(dataSql, [...params, limit, offset]);

    const assets: AssetWithDetails[] = dataRes.rows.map((r) => ({
      ...(r as unknown as AssetRow),
      company_name: r.company_name as string,
      company_code: r.company_code as string,
      branch_name: r.branch_name as string | null,
      branch_code: r.branch_code as string | null,
      department_name: r.department_name as string | null,
      department_code: r.department_code as string | null,
      location_building: r.location_building as string | null,
      location_floor: r.location_floor as string | null,
      location_room: r.location_room as string | null,
      category_name: r.category_name as string,
      category_code: r.category_code as string,
      vendor_name: r.vendor_name as string | null,
      vendor_code: r.vendor_code as string | null,
      purchase_cost: parseFloat((r.purchase_cost as string) || "0"),
      current_value: parseFloat((r.current_value as string) || "0"),
      depreciation_rate_percent: r.depreciation_rate_percent ? parseFloat(r.depreciation_rate_percent as string) : null,
      useful_life_months: r.useful_life_months ? parseInt(r.useful_life_months as string, 10) : null,
      accumulated_depreciation: parseFloat((r.accumulated_depreciation as string) || "0"),
      documents_count: parseInt((r.documents_count as string) || "0", 10),
      photos_count: parseInt((r.photos_count as string) || "0", 10),
    }));

    return { assets, total };
  }

  async findByTag(assetTag: string): Promise<AssetRow | null> {
    const res = await query<AssetRow>("SELECT * FROM assets WHERE asset_tag = $1", [assetTag]);
    return res.rows[0] || null;
  }

  async create(data: {
    companyId: string;
    branchId?: string | null;
    departmentId?: string | null;
    locationId?: string | null;
    categoryId: string;
    vendorId?: string | null;
    assetTag: string;
    barcode: string;
    qrCode: string;
    name: string;
    subcategory?: string | null;
    description?: string | null;
    serialNumber?: string | null;
    modelNumber?: string | null;
    manufacturer?: string | null;
    purchaseDate?: string | null;
    purchaseCost: number;
    currentValue: number;
    invoiceNumber?: string | null;
    warrantyStart?: string | null;
    warrantyEnd?: string | null;
    status?: string;
    condition?: string;
    photoUrl?: string | null;
    notes?: string | null;
    depreciationMethod?: string | null;
    depreciationRatePercent?: number | null;
    usefulLifeMonths?: number | null;
    depreciationStartDate?: string | null;
    accumulatedDepreciation?: number;
    createdBy?: string;
  }, user: AuthUser): Promise<AssetRow> {
    assertCompanyAccess(user, data.companyId);

    const res = await query<AssetRow>(`
      INSERT INTO assets (
        company_id, branch_id, department_id, location_id, category_id, vendor_id,
        asset_tag, barcode, qr_code, name, subcategory, description,
        serial_number, model_number, manufacturer, purchase_date,
        purchase_cost, current_value, invoice_number, warranty_start, warranty_end,
        status, condition, photo_url, notes,
        depreciation_method, depreciation_rate_percent, useful_life_months,
        depreciation_start_date, accumulated_depreciation, created_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20, $21,
        $22, $23, $24, $25,
        $26, $27, $28,
        $29, $30, $31
      )
      RETURNING *
    `, [
      data.companyId,
      data.branchId || null,
      data.departmentId || null,
      data.locationId || null,
      data.categoryId,
      data.vendorId || null,
      data.assetTag,
      data.barcode,
      data.qrCode,
      data.name,
      data.subcategory || null,
      data.description || null,
      data.serialNumber || null,
      data.modelNumber || null,
      data.manufacturer || null,
      data.purchaseDate || null,
      data.purchaseCost,
      data.currentValue,
      data.invoiceNumber || null,
      data.warrantyStart || null,
      data.warrantyEnd || null,
      data.status || "AVAILABLE",
      data.condition || "NEW",
      data.photoUrl || null,
      data.notes || null,
      data.depreciationMethod || "STRAIGHT_LINE",
      data.depreciationRatePercent || null,
      data.usefulLifeMonths || null,
      data.depreciationStartDate || null,
      data.accumulatedDepreciation || 0.00,
      user.id
    ]);

    return res.rows[0];
  }

  async update(id: string, data: Partial<AssetRow> & {
    branchId?: string | null;
    departmentId?: string | null;
    locationId?: string | null;
    vendorId?: string | null;
    serialNumber?: string | null;
    modelNumber?: string | null;
    manufacturer?: string | null;
    purchaseDate?: string | null;
    invoiceNumber?: string | null;
    warrantyStart?: string | null;
    warrantyEnd?: string | null;
    notes?: string | null;
    depreciationMethod?: string | null;
    depreciationRatePercent?: number | null;
    usefulLifeMonths?: number | null;
    depreciationStartDate?: string | null;
    accumulatedDepreciation?: number | null;
  }, user: AuthUser): Promise<AssetRow> {
    const existing = await this.findById(id, user);
    if (!existing) {
      throw new NotFoundError(`Asset with ID '${id}' not found`);
    }

    assertCompanyAccess(user, existing.company_id);

    const res = await query<AssetRow>(`
      UPDATE assets
      SET name = COALESCE($1, name),
          current_value = COALESCE($2, current_value),
          branch_id = COALESCE($3, branch_id),
          department_id = COALESCE($4, department_id),
          location_id = COALESCE($5, location_id),
          vendor_id = COALESCE($6, vendor_id),
          serial_number = COALESCE($7, serial_number),
          model_number = COALESCE($8, model_number),
          manufacturer = COALESCE($9, manufacturer),
          condition = COALESCE($10, condition),
          notes = COALESCE($11, notes),
          description = COALESCE($12, description),
          updated_at = NOW()
      WHERE id = $13 AND (company_id = $14 OR $15 = true)
      RETURNING *
    `, [
      data.name || null,
      data.current_value !== undefined ? data.current_value : null,
      data.branchId !== undefined ? data.branchId : null,
      data.departmentId !== undefined ? data.departmentId : null,
      data.locationId !== undefined ? data.locationId : null,
      data.vendorId !== undefined ? data.vendorId : null,
      data.serialNumber !== undefined ? data.serialNumber : null,
      data.modelNumber !== undefined ? data.modelNumber : null,
      data.manufacturer !== undefined ? data.manufacturer : null,
      data.condition || null,
      data.notes !== undefined ? data.notes : null,
      data.description !== undefined ? data.description : null,
      id,
      user.companyId,
      user.isCommonAdmin
    ]);

    return res.rows[0];
  }

  async delete(id: string, user: AuthUser): Promise<boolean> {
    const existing = await this.findById(id, user);
    if (!existing) {
      throw new NotFoundError(`Asset with ID '${id}' not found`);
    }

    assertCompanyAccess(user, existing.company_id);

    const res = await query(
      "DELETE FROM assets WHERE id = $1 AND (company_id = $2 OR $3 = true)",
      [id, user.companyId, user.isCommonAdmin]
    );

    return (res.rowCount ?? 0) > 0;
  }

  // --- Asset Documents ---
  async findDocumentsByAssetId(assetId: string): Promise<DocumentRow[]> {
    const res = await query<DocumentRow>(
      "SELECT * FROM asset_documents WHERE asset_id = $1 ORDER BY uploaded_at DESC",
      [assetId]
    );
    return res.rows;
  }

  async createDocument(data: {
    assetId: string;
    title: string;
    documentType: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    uploadedBy: string;
  }): Promise<DocumentRow> {
    const res = await query<DocumentRow>(`
      INSERT INTO asset_documents (asset_id, title, document_type, file_path, file_size, mime_type, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [data.assetId, data.title, data.documentType, data.filePath, data.fileSize, data.mimeType, data.uploadedBy]);
    return res.rows[0];
  }

  // --- Asset Photos ---
  async findPhotosByAssetId(assetId: string): Promise<PhotoRow[]> {
    const res = await query<PhotoRow>(
      "SELECT * FROM asset_photos WHERE asset_id = $1 ORDER BY uploaded_at DESC",
      [assetId]
    );
    return res.rows;
  }

  async createPhoto(data: {
    assetId: string;
    photoType: string;
    filePath: string;
    caption?: string | null;
    uploadedBy: string;
  }): Promise<PhotoRow> {
    const res = await query<PhotoRow>(`
      INSERT INTO asset_photos (asset_id, photo_type, file_path, caption, uploaded_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [data.assetId, data.photoType, data.filePath, data.caption || null, data.uploadedBy]);
    return res.rows[0];
  }
}

export const assetsRepository = new AssetsRepository();