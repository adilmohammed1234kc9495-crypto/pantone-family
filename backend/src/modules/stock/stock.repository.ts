import { PoolClient, QueryResult } from "pg";
import { query } from "../../config/database";

export interface StockItemRow {
  id: string;
  company_id: string;
  asset_id: string | null;
  branch_id: string | null;
  location_id: string | null;
  stock_code: string;
  item_name: string;
  category_id: string | null;
  description: string | null;
  unit: string;
  quantity_on_hand: number;
  minimum_quantity: number;
  reorder_level: number;
  maximum_quantity: number | null;
  unit_cost: number;
  vendor_id: string | null;
  is_active: boolean;
  batch_number: string | null;
  status: string;
  received_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockItemWithDetails extends StockItemRow {
  category_name: string | null;
  category_code: string | null;
  vendor_name: string | null;
  vendor_code: string | null;
  location_name: string | null;
  branch_name: string | null;
  total_valuation: number;
  stock_status: "HEALTHY" | "LOW_STOCK" | "OUT_OF_STOCK" | "OVERSTOCK";
}

export interface StockMovementRow {
  id: string;
  company_id: string;
  stock_item_id: string;
  asset_id: string | null;
  movement_type: "RECEIPT" | "ISSUE" | "RETURN" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "TRANSFER" | "DAMAGE" | "SCRAP";
  from_location_id: string | null;
  to_location_id: string | null;
  quantity: number;
  unit_cost: number;
  balance_before: number;
  balance_after: number;
  performed_by: string | null;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  timestamp: string;
  created_at: string;
}

export interface StockMovementWithDetails extends StockMovementRow {
  performed_by_username: string | null;
  from_location_name: string | null;
  to_location_name: string | null;
}

export interface CreateStockItemData {
  companyId: string;
  stockCode: string;
  itemName: string;
  categoryId?: string | null;
  branchId?: string | null;
  locationId?: string | null;
  description?: string | null;
  unit?: string;
  quantityOnHand?: number;
  minimumQuantity?: number;
  reorderLevel?: number;
  maximumQuantity?: number | null;
  unitCost?: number;
  vendorId?: string | null;
  batchNumber?: string | null;
  notes?: string | null;
}

export interface UpdateStockItemData {
  itemName?: string;
  categoryId?: string | null;
  branchId?: string | null;
  locationId?: string | null;
  description?: string | null;
  unit?: string;
  minimumQuantity?: number;
  reorderLevel?: number;
  maximumQuantity?: number | null;
  unitCost?: number;
  vendorId?: string | null;
  notes?: string | null;
}

export interface CreateStockMovementData {
  companyId: string;
  stockItemId: string;
  movementType: "RECEIPT" | "ISSUE" | "RETURN" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "TRANSFER" | "DAMAGE" | "SCRAP";
  quantity: number;
  unitCost?: number;
  balanceBefore: number;
  balanceAfter: number;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  performedBy?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
}

export interface ListStockOptions {
  companyId?: string | null;
  search?: string;
  categoryId?: string;
  locationId?: string;
  status?: string; // HEALTHY, LOW_STOCK, OUT_OF_STOCK, OVERSTOCK
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export class StockRepository {
  async create(data: CreateStockItemData, client?: PoolClient): Promise<StockItemRow> {
    const sql = `
      INSERT INTO stock_items (
        company_id, stock_code, item_name, category_id, branch_id, location_id,
        description, unit, quantity_on_hand, minimum_quantity, reorder_level,
        maximum_quantity, unit_cost, vendor_id, batch_number, notes, is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, true
      ) RETURNING *;
    `;
    const params = [
      data.companyId,
      data.stockCode,
      data.itemName,
      data.categoryId || null,
      data.branchId || null,
      data.locationId || null,
      data.description || null,
      data.unit || "PIECE",
      data.quantityOnHand || 0,
      data.minimumQuantity || 0,
      data.reorderLevel || 0,
      data.maximumQuantity || null,
      data.unitCost || 0.00,
      data.vendorId || null,
      data.batchNumber || null,
      data.notes || null,
    ];

    const res: QueryResult<StockItemRow> = client
      ? await client.query(sql, params)
      : await query(sql, params);
    return res.rows[0];
  }

  async update(id: string, data: UpdateStockItemData, client?: PoolClient): Promise<StockItemRow | null> {
    const fields: string[] = [];
    const params: unknown[] = [id];
    let idx = 2;

    if (data.itemName !== undefined) {
      fields.push(`item_name = $${idx++}`);
      params.push(data.itemName);
    }
    if (data.categoryId !== undefined) {
      fields.push(`category_id = $${idx++}`);
      params.push(data.categoryId);
    }
    if (data.branchId !== undefined) {
      fields.push(`branch_id = $${idx++}`);
      params.push(data.branchId);
    }
    if (data.locationId !== undefined) {
      fields.push(`location_id = $${idx++}`);
      params.push(data.locationId);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${idx++}`);
      params.push(data.description);
    }
    if (data.unit !== undefined) {
      fields.push(`unit = $${idx++}`);
      params.push(data.unit);
    }
    if (data.minimumQuantity !== undefined) {
      fields.push(`minimum_quantity = $${idx++}`);
      params.push(data.minimumQuantity);
    }
    if (data.reorderLevel !== undefined) {
      fields.push(`reorder_level = $${idx++}`);
      params.push(data.reorderLevel);
    }
    if (data.maximumQuantity !== undefined) {
      fields.push(`maximum_quantity = $${idx++}`);
      params.push(data.maximumQuantity);
    }
    if (data.unitCost !== undefined) {
      fields.push(`unit_cost = $${idx++}`);
      params.push(data.unitCost);
    }
    if (data.vendorId !== undefined) {
      fields.push(`vendor_id = $${idx++}`);
      params.push(data.vendorId);
    }
    if (data.notes !== undefined) {
      fields.push(`notes = $${idx++}`);
      params.push(data.notes);
    }

    if (fields.length === 0) return this.findById(id, client);

    fields.push("updated_at = NOW()");
    const sql = `UPDATE stock_items SET ${fields.join(", ")} WHERE id = $1 RETURNING *;`;
    const res: QueryResult<StockItemRow> = client
      ? await client.query(sql, params)
      : await query(sql, params);
    return res.rows[0] || null;
  }

  async updateStatus(id: string, isActive: boolean, client?: PoolClient): Promise<StockItemRow | null> {
    const sql = `UPDATE stock_items SET is_active = $2, updated_at = NOW() WHERE id = $1 RETURNING *;`;
    const res: QueryResult<StockItemRow> = client
      ? await client.query(sql, [id, isActive])
      : await query(sql, [id, isActive]);
    return res.rows[0] || null;
  }

  async findById(id: string, client?: PoolClient): Promise<StockItemWithDetails | null> {
    const sql = `
      SELECT 
        s.*,
        c.name as category_name,
        c.code as category_code,
        v.name as vendor_name,
        v.code as vendor_code,
        loc.room_number as location_name,
        b.name as branch_name,
        (s.quantity_on_hand * s.unit_cost) as total_valuation,
        CASE 
          WHEN s.quantity_on_hand <= 0 THEN 'OUT_OF_STOCK'
          WHEN s.quantity_on_hand <= s.minimum_quantity OR s.quantity_on_hand <= s.reorder_level THEN 'LOW_STOCK'
          WHEN s.maximum_quantity IS NOT NULL AND s.quantity_on_hand > s.maximum_quantity THEN 'OVERSTOCK'
          ELSE 'HEALTHY'
        END as stock_status
      FROM stock_items s
      LEFT JOIN asset_categories c ON s.category_id = c.id
      LEFT JOIN vendors v ON s.vendor_id = v.id
      LEFT JOIN locations loc ON s.location_id = loc.id
      LEFT JOIN branches b ON s.branch_id = b.id
      WHERE s.id = $1;
    `;
    const res: QueryResult<StockItemWithDetails> = client
      ? await client.query(sql, [id])
      : await query(sql, [id]);
    return res.rows[0] || null;
  }

  async findWithLock(id: string, client: PoolClient): Promise<StockItemRow | null> {
    const sql = `SELECT * FROM stock_items WHERE id = $1 FOR UPDATE;`;
    const res: QueryResult<StockItemRow> = await client.query(sql, [id]);
    return res.rows[0] || null;
  }

  async updateQuantity(id: string, newQuantity: number, client: PoolClient): Promise<StockItemRow> {
    const sql = `
      UPDATE stock_items 
      SET quantity_on_hand = $2, updated_at = NOW() 
      WHERE id = $1 
      RETURNING *;
    `;
    const res: QueryResult<StockItemRow> = await client.query(sql, [id, newQuantity]);
    return res.rows[0];
  }

  async findByStockCode(companyId: string, stockCode: string, client?: PoolClient): Promise<StockItemRow | null> {
    const sql = `SELECT * FROM stock_items WHERE company_id = $1 AND stock_code = $2;`;
    const res: QueryResult<StockItemRow> = client
      ? await client.query(sql, [companyId, stockCode])
      : await query(sql, [companyId, stockCode]);
    return res.rows[0] || null;
  }

  async list(options: ListStockOptions): Promise<{ items: StockItemWithDetails[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (options.companyId) {
      conditions.push(`s.company_id = $${idx++}`);
      params.push(options.companyId);
    }
    if (options.categoryId) {
      conditions.push(`s.category_id = $${idx++}`);
      params.push(options.categoryId);
    }
    if (options.locationId) {
      conditions.push(`s.location_id = $${idx++}`);
      params.push(options.locationId);
    }
    if (options.isActive !== undefined) {
      conditions.push(`s.is_active = $${idx++}`);
      params.push(options.isActive);
    }
    if (options.search && options.search.trim()) {
      conditions.push(`(s.stock_code ILIKE $${idx} OR s.item_name ILIKE $${idx} OR s.description ILIKE $${idx})`);
      params.push(`%${options.search.trim()}%`);
      idx++;
    }

    if (options.status) {
      const s = options.status.toUpperCase();
      if (s === "OUT_OF_STOCK") {
        conditions.push("s.quantity_on_hand <= 0");
      } else if (s === "LOW_STOCK") {
        conditions.push("(s.quantity_on_hand > 0 AND (s.quantity_on_hand <= s.minimum_quantity OR s.quantity_on_hand <= s.reorder_level))");
      } else if (s === "OVERSTOCK") {
        conditions.push("(s.maximum_quantity IS NOT NULL AND s.quantity_on_hand > s.maximum_quantity)");
      } else if (s === "HEALTHY") {
        conditions.push("(s.quantity_on_hand > s.minimum_quantity AND s.quantity_on_hand > s.reorder_level AND (s.maximum_quantity IS NULL OR s.quantity_on_hand <= s.maximum_quantity))");
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*)::int as total FROM stock_items s ${whereClause};`;
    const countRes = await query<{ total: number }>(countSql, params);
    const total = countRes.rows[0]?.total || 0;

    const listSql = `
      SELECT 
        s.*,
        c.name as category_name,
        c.code as category_code,
        v.name as vendor_name,
        v.code as vendor_code,
        loc.room_number as location_name,
        b.name as branch_name,
        (s.quantity_on_hand * s.unit_cost) as total_valuation,
        CASE 
          WHEN s.quantity_on_hand <= 0 THEN 'OUT_OF_STOCK'
          WHEN s.quantity_on_hand <= s.minimum_quantity OR s.quantity_on_hand <= s.reorder_level THEN 'LOW_STOCK'
          WHEN s.maximum_quantity IS NOT NULL AND s.quantity_on_hand > s.maximum_quantity THEN 'OVERSTOCK'
          ELSE 'HEALTHY'
        END as stock_status
      FROM stock_items s
      LEFT JOIN asset_categories c ON s.category_id = c.id
      LEFT JOIN vendors v ON s.vendor_id = v.id
      LEFT JOIN locations loc ON s.location_id = loc.id
      LEFT JOIN branches b ON s.branch_id = b.id
      ${whereClause}
      ORDER BY s.item_name ASC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    params.push(limit, offset);

    const listRes = await query<StockItemWithDetails>(listSql, params);

    return {
      items: listRes.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    };
  }

  async recordMovement(data: CreateStockMovementData, client: PoolClient): Promise<StockMovementRow> {
    const sql = `
      INSERT INTO stock_movements (
        company_id, stock_item_id, movement_type, quantity, unit_cost,
        balance_before, balance_after, from_location_id, to_location_id,
        performed_by, reference_type, reference_id, notes, timestamp
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13, NOW()
      ) RETURNING *;
    `;
    const params = [
      data.companyId,
      data.stockItemId,
      data.movementType,
      data.quantity,
      data.unitCost || 0.00,
      data.balanceBefore,
      data.balanceAfter,
      data.fromLocationId || null,
      data.toLocationId || null,
      data.performedBy || null,
      data.referenceType || null,
      data.referenceId || null,
      data.notes || null,
    ];

    const res: QueryResult<StockMovementRow> = await client.query(sql, params);
    return res.rows[0];
  }

  async listMovements(stockItemId: string, options: { page?: number; limit?: number }): Promise<{ movements: StockMovementWithDetails[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    const countRes = await query<{ total: number }>(
      `SELECT COUNT(*)::int as total FROM stock_movements WHERE stock_item_id = $1`,
      [stockItemId]
    );
    const total = countRes.rows[0]?.total || 0;

    const sql = `
      SELECT 
        m.*,
        u.username as performed_by_username,
        floc.room_number as from_location_name,
        tloc.room_number as to_location_name
      FROM stock_movements m
      LEFT JOIN users u ON m.performed_by = u.id
      LEFT JOIN locations floc ON m.from_location_id = floc.id
      LEFT JOIN locations tloc ON m.to_location_id = tloc.id
      WHERE m.stock_item_id = $1
      ORDER BY m.timestamp DESC
      LIMIT $2 OFFSET $3;
    `;
    const res = await query<StockMovementWithDetails>(sql, [stockItemId, limit, offset]);

    return {
      movements: res.rows,
      total
    };
  }

  async getAlerts(companyId?: string | null): Promise<StockItemWithDetails[]> {
    const conditions: string[] = ["s.is_active = true"];
    const params: unknown[] = [];
    let idx = 1;

    if (companyId) {
      conditions.push(`s.company_id = $${idx++}`);
      params.push(companyId);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const sql = `
      SELECT 
        s.*,
        c.name as category_name,
        c.code as category_code,
        v.name as vendor_name,
        v.code as vendor_code,
        loc.room_number as location_name,
        b.name as branch_name,
        (s.quantity_on_hand * s.unit_cost) as total_valuation,
        CASE 
          WHEN s.quantity_on_hand <= 0 THEN 'OUT_OF_STOCK'
          WHEN s.quantity_on_hand <= s.minimum_quantity OR s.quantity_on_hand <= s.reorder_level THEN 'LOW_STOCK'
          WHEN s.maximum_quantity IS NOT NULL AND s.quantity_on_hand > s.maximum_quantity THEN 'OVERSTOCK'
          ELSE 'HEALTHY'
        END as stock_status
      FROM stock_items s
      LEFT JOIN asset_categories c ON s.category_id = c.id
      LEFT JOIN vendors v ON s.vendor_id = v.id
      LEFT JOIN locations loc ON s.location_id = loc.id
      LEFT JOIN branches b ON s.branch_id = b.id
      ${whereClause}
      AND (
        s.quantity_on_hand <= 0 
        OR s.quantity_on_hand <= s.minimum_quantity 
        OR s.quantity_on_hand <= s.reorder_level
        OR (s.maximum_quantity IS NOT NULL AND s.quantity_on_hand > s.maximum_quantity)
      )
      ORDER BY s.quantity_on_hand ASC;
    `;

    const res = await query<StockItemWithDetails>(sql, params);
    return res.rows;
  }
}

export const stockRepository = new StockRepository();
