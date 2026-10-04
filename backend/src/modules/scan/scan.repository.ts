import { query } from "../../config/database";

export interface ResolvedAssetRow {
  id: string;
  company_id: string;
  company_name: string;
  company_code: string;
  branch_id: string | null;
  branch_name: string | null;
  branch_code: string | null;
  department_id: string | null;
  department_name: string | null;
  department_code: string | null;
  location_id: string | null;
  location_building: string | null;
  location_floor: string | null;
  location_room: string | null;
  category_id: string;
  category_name: string;
  category_code: string;
  vendor_id: string | null;
  vendor_name: string | null;
  vendor_code: string | null;
  assigned_employee_id: string | null;
  employee_first_name: string | null;
  employee_last_name: string | null;
  employee_code: string | null;
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
  purchase_cost: string | number;
  current_value: string | number;
  invoice_number: string | null;
  status: string;
  condition: string;
  photo_url: string | null;
  notes: string | null;
  depreciation_method: string | null;
  depreciation_rate_percent: string | number | null;
  useful_life_months: number | null;
  accumulated_depreciation: string | number | null;
  created_at: string;
  updated_at: string;
}

export interface ScanEventRow {
  id: string;
  company_id: string | null;
  asset_id: string | null;
  scanned_by: string;
  scanned_by_name?: string;
  scanned_by_username?: string;
  scan_type: "QR" | "BARCODE" | "MANUAL";
  scan_value: string;
  source: "WEB_CAMERA" | "MANUAL_ENTRY" | "HARDWARE_SCANNER";
  is_success: boolean;
  failure_reason: string | null;
  metadata: Record<string, unknown>;
  scanned_at: string;
}

export interface ActiveTransferRow {
  id: string;
  transfer_code: string;
  transfer_type: string;
  status: string;
  from_company_id: string;
  to_company_id: string;
  dispatched_at: string | null;
}

export class ScanRepository {
  /**
   * Resolves an asset by token (canonical asset:UUID, raw UUID, asset tag, qr_code, or barcode)
   */
  async resolveAsset(rawToken: string): Promise<ResolvedAssetRow | null> {
    const token = rawToken.trim();
    if (!token) return null;

    // Check if canonical URI format e.g. "asset:UUID"
    let cleanToken = token;
    if (cleanToken.toLowerCase().startsWith("asset:")) {
      cleanToken = cleanToken.slice(6).trim();
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanToken);

    const baseSelect = `
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
        e.first_name AS employee_first_name,
        e.last_name AS employee_last_name,
        e.employee_code AS employee_code
      FROM assets a
      JOIN companies c ON c.id = a.company_id
      LEFT JOIN branches b ON b.id = a.branch_id
      LEFT JOIN departments d ON d.id = a.department_id
      LEFT JOIN locations l ON l.id = a.location_id
      JOIN asset_categories cat ON cat.id = a.category_id
      LEFT JOIN vendors v ON v.id = a.vendor_id
      LEFT JOIN employees e ON e.id = a.assigned_employee_id
    `;

    if (isUuid) {
      const res = await query<ResolvedAssetRow>(`${baseSelect} WHERE a.id = $1`, [cleanToken]);
      if (res.rows.length > 0) return res.rows[0];
    }

    // Try lookup by asset_tag, qr_code, or barcode
    const resByCodes = await query<ResolvedAssetRow>(
      `${baseSelect} WHERE a.asset_tag = $1 OR a.qr_code = $1 OR a.barcode = $1`,
      [token]
    );

    if (resByCodes.rows.length > 0) {
      return resByCodes.rows[0];
    }

    // Also try without BAR- or QR- prefix if user typed only the tag part
    if (token.startsWith("BAR-") || token.startsWith("QR-")) {
      const bare = token.slice(4);
      const resBare = await query<ResolvedAssetRow>(
        `${baseSelect} WHERE a.asset_tag = $1 OR a.qr_code = $1 OR a.barcode = $1`,
        [bare]
      );
      if (resBare.rows.length > 0) {
        return resBare.rows[0];
      }
    }

    return null;
  }

  /**
   * Records a physical scan event in asset_scans
   */
  async recordScanEvent(data: {
    companyId: string | null;
    assetId: string | null;
    scannedBy: string;
    scanType: "QR" | "BARCODE" | "MANUAL";
    scanValue: string;
    source: "WEB_CAMERA" | "MANUAL_ENTRY" | "HARDWARE_SCANNER";
    isSuccess: boolean;
    failureReason?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<ScanEventRow> {
    const res = await query<ScanEventRow>(
      `
      INSERT INTO asset_scans (
        company_id, asset_id, scanned_by, scan_type, scan_value, source,
        is_success, failure_reason, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
      [
        data.companyId,
        data.assetId,
        data.scannedBy,
        data.scanType,
        data.scanValue,
        data.source,
        data.isSuccess,
        data.failureReason || null,
        JSON.stringify(data.metadata || {})
      ]
    );

    return res.rows[0];
  }

  /**
   * Retrieves scan history for a specific asset
   */
  async listAssetScans(assetId: string, limit = 20): Promise<ScanEventRow[]> {
    const res = await query<ScanEventRow>(
      `
      SELECT 
        s.*,
        u.username AS scanned_by_username,
        CONCAT_WS(' ', e.first_name, e.last_name) AS scanned_by_name
      FROM asset_scans s
      LEFT JOIN users u ON u.id = s.scanned_by
      LEFT JOIN employees e ON e.id = u.employee_id
      WHERE s.asset_id = $1
      ORDER BY s.scanned_at DESC
      LIMIT $2
    `,
      [assetId, limit]
    );

    return res.rows;
  }

  /**
   * Retrieves paginated scan history for a company
   */
  async listScans(options: {
    companyId?: string | null;
    scanType?: string;
    source?: string;
    isSuccess?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ scans: ScanEventRow[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let pIdx = 1;

    if (options.companyId) {
      conditions.push(`s.company_id = $${pIdx++}`);
      params.push(options.companyId);
    }
    if (options.scanType) {
      conditions.push(`s.scan_type = $${pIdx++}`);
      params.push(options.scanType);
    }
    if (options.source) {
      conditions.push(`s.source = $${pIdx++}`);
      params.push(options.source);
    }
    if (options.isSuccess !== undefined) {
      conditions.push(`s.is_success = $${pIdx++}`);
      params.push(options.isSuccess);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*) FROM asset_scans s ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const dataRes = await query<ScanEventRow>(
      `
      SELECT 
        s.*,
        u.username AS scanned_by_username,
        CONCAT_WS(' ', e.first_name, e.last_name) AS scanned_by_name,
        a.asset_tag,
        a.name AS asset_name
      FROM asset_scans s
      LEFT JOIN users u ON u.id = s.scanned_by
      LEFT JOIN employees e ON e.id = u.employee_id
      LEFT JOIN assets a ON a.id = s.asset_id
      ${whereClause}
      ORDER BY s.scanned_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `,
      [...params, limit, offset]
    );

    return { scans: dataRes.rows, total };
  }

  /**
   * Regenerates visual QR code without changing asset identity
   */
  async updateQrCode(assetId: string, newQrCode: string): Promise<void> {
    await query("UPDATE assets SET qr_code = $1, updated_at = NOW() WHERE id = $2", [
      newQrCode,
      assetId
    ]);
  }

  /**
   * Retrieves active transfer for asset if any
   */
  async getActiveTransfer(assetId: string): Promise<ActiveTransferRow | null> {
    const res = await query<ActiveTransferRow>(
      `
      SELECT id, transfer_code, transfer_type, status, from_company_id, to_company_id, dispatch_date AS dispatched_at
      FROM asset_transfers
      WHERE asset_id = $1 AND status IN ('INITIATED', 'PENDING_APPROVAL', 'APPROVED', 'DISPATCHED', 'HANDOVER_PENDING', 'DISPUTED')
      ORDER BY created_at DESC
      LIMIT 1
    `,
      [assetId]
    );

    return res.rows[0] || null;
  }

  /**
   * Checks if asset has active maintenance work orders
   */
  async getActiveMaintenanceCount(assetId: string): Promise<number> {
    const res = await query<{ count: string }>(
      `
      SELECT COUNT(*) 
      FROM maintenance_records 
      WHERE asset_id = $1 AND status IN ('REPORTED', 'APPROVED', 'IN_PROGRESS', 'SCHEDULED', 'PENDING_PARTS', 'AWAITING_INSPECTION')
    `,
      [assetId]
    );

    return parseInt(res.rows[0]?.count || "0", 10);
  }
}

export const scanRepository = new ScanRepository();
