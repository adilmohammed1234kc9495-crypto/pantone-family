import { PoolClient, QueryResult } from "pg";
import { query } from "../../config/database";

export interface AssetTransferRow {
  id: string;
  transfer_code: string;
  asset_id: string;
  from_company_id: string;
  to_company_id: string;
  from_employee_id: string | null;
  to_employee_id: string | null;
  from_department_id: string | null;
  to_department_id: string | null;
  from_location_id: string | null;
  to_location_id: string | null;
  transfer_type: "EMPLOYEE_TO_EMPLOYEE" | "DEPT_TO_DEPT" | "LOCATION_TO_LOCATION" | "INTER_COMPANY";
  requested_by: string | null;
  approved_by: string | null;
  dispatched_by: string | null;
  received_by: string | null;
  transfer_date: string;
  dispatch_date: string | null;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  condition: string;
  condition_before: string;
  condition_after: string | null;
  reason: string;
  status:
    | "INITIATED"
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "DISPATCHED"
    | "HANDOVER_PENDING"
    | "COMPLETED"
    | "REJECTED"
    | "DISPUTED"
    | "CANCELLED";
  rejection_reason: string | null;
  dispute_reason: string | null;
  resolution_notes: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface InterCompanyTransferRow {
  id: string;
  transfer_id: string;
  from_company_id: string;
  to_company_id: string;
  sending_admin_id: string | null;
  receiving_admin_id: string | null;
  originating_book_value: number;
  transfer_fee: number;
  dispatch_date: string | null;
  receipt_date: string | null;
  status: "PENDING_RECEIPT" | "CONFIRMED" | "DISPUTED";
  acknowledgement_notes: string | null;
  dispute_reason: string | null;
  resolution_notes: string | null;
}

export interface HandoverRecordRow {
  id: string;
  asset_id: string;
  transfer_id: string | null;
  assignment_id: string | null;
  sender_id: string | null;
  receiver_id: string;
  handover_date: string;
  handover_time: string;
  location_id: string | null;
  condition: string;
  physical_condition: string;
  remarks: string | null;
  sender_signature_svg: string | null;
  receiver_signature_svg: string | null;
  signature_hash: string | null;
  digital_signature_token: string | null;
  verification_notes: string | null;
  acknowledged_at: string;
}

export interface TransferWithDetails extends AssetTransferRow {
  asset_tag: string;
  asset_name: string;
  asset_status: string;
  asset_current_value: number;
  from_company_name: string;
  from_company_code: string;
  to_company_name: string;
  to_company_code: string;
  from_employee_name: string | null;
  to_employee_name: string | null;
  from_department_name: string | null;
  to_department_name: string | null;
  from_location_name: string | null;
  to_location_name: string | null;
  requested_by_username: string | null;
  approved_by_username: string | null;
  dispatched_by_username: string | null;
  received_by_username: string | null;
  inter_company?: InterCompanyTransferRow | null;
  handovers?: HandoverRecordRow[];
}

export interface CreateTransferData {
  assetId: string;
  fromCompanyId: string;
  toCompanyId: string;
  fromEmployeeId?: string | null;
  toEmployeeId?: string | null;
  fromDepartmentId?: string | null;
  toDepartmentId?: string | null;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  transferType: "EMPLOYEE_TO_EMPLOYEE" | "DEPT_TO_DEPT" | "LOCATION_TO_LOCATION" | "INTER_COMPANY";
  requestedBy: string;
  conditionBefore?: string;
  reason: string;
  expectedDeliveryDate?: string | null;
  remarks?: string | null;
}

export interface ListTransfersOptions {
  companyId?: string | null;
  status?: string;
  transferType?: string;
  search?: string;
  assetId?: string;
  page?: number;
  limit?: number;
}

export class TransfersRepository {
  async generateTransferCode(client?: PoolClient): Promise<string> {
    const todaySql = `SELECT to_char(CURRENT_DATE, 'YYYYMMDD') as today;`;
    const todayRes = client ? await client.query(todaySql) : await query(todaySql);
    const dateStr = todayRes.rows[0].today;

    const seqSql = `SELECT nextval('transfer_seq') as seq;`;
    const seqRes = client ? await client.query(seqSql) : await query(seqSql);
    const seqNum = String(seqRes.rows[0].seq % 10000).padStart(4, "0");

    return `TRF-${dateStr}-${seqNum}`;
  }

  async create(data: CreateTransferData, client: PoolClient): Promise<AssetTransferRow> {
    const transferCode = await this.generateTransferCode(client);

    const sql = `
      INSERT INTO asset_transfers (
        transfer_code, asset_id, from_company_id, to_company_id,
        from_employee_id, to_employee_id, from_department_id, to_department_id,
        from_location_id, to_location_id, transfer_type, requested_by,
        condition, condition_before, reason, expected_delivery_date, remarks,
        status, transfer_date
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        'INITIATED', NOW()
      )
      RETURNING *;
    `;

    const params = [
      transferCode,
      data.assetId,
      data.fromCompanyId,
      data.toCompanyId,
      data.fromEmployeeId || null,
      data.toEmployeeId || null,
      data.fromDepartmentId || null,
      data.toDepartmentId || null,
      data.fromLocationId || null,
      data.toLocationId || null,
      data.transferType,
      data.requestedBy,
      data.conditionBefore || "GOOD",
      data.conditionBefore || "GOOD",
      data.reason,
      data.expectedDeliveryDate || null,
      data.remarks || null,
    ];

    const res: QueryResult<AssetTransferRow> = await client.query(sql, params);
    return res.rows[0];
  }

  async createInterCompany(
    data: {
      transferId: string;
      fromCompanyId: string;
      toCompanyId: string;
      sendingAdminId: string;
      originatingBookValue: number;
      transferFee?: number;
    },
    client: PoolClient
  ): Promise<InterCompanyTransferRow> {
    const sql = `
      INSERT INTO inter_company_transfers (
        transfer_id, from_company_id, to_company_id, sending_admin_id,
        originating_book_value, transfer_fee, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'INITIATED')
      RETURNING *;
    `;
    const params = [
      data.transferId,
      data.fromCompanyId,
      data.toCompanyId,
      data.sendingAdminId,
      data.originatingBookValue,
      data.transferFee || 0.00,
    ];
    const res: QueryResult<InterCompanyTransferRow> = await client.query(sql, params);
    return res.rows[0];
  }

  async createHandover(
    data: {
      assetId: string;
      transferId: string;
      senderId?: string | null;
      receiverId: string;
      condition: string;
      physicalCondition?: string;
      remarks?: string | null;
      signatureHash?: string | null;
      digitalSignatureToken?: string | null;
      verificationNotes?: string | null;
      locationId?: string | null;
    },
    client: PoolClient
  ): Promise<HandoverRecordRow> {
    const sql = `
      INSERT INTO handover_records (
        asset_id, transfer_id, sender_id, receiver_id, condition,
        physical_condition, remarks, signature_hash, digital_signature_token,
        verification_notes, location_id, handover_date, handover_time, acknowledged_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, CURRENT_DATE, CURRENT_TIME, NOW()
      )
      RETURNING *;
    `;
    const params = [
      data.assetId,
      data.transferId,
      data.senderId || null,
      data.receiverId,
      data.condition,
      data.physicalCondition || data.condition,
      data.remarks || null,
      data.signatureHash || null,
      data.digitalSignatureToken || null,
      data.verificationNotes || null,
      data.locationId || null,
    ];
    const res: QueryResult<HandoverRecordRow> = await client.query(sql, params);
    return res.rows[0];
  }

  async findById(id: string, client?: PoolClient): Promise<TransferWithDetails | null> {
    const sql = `
      SELECT 
        t.*,
        a.asset_tag,
        a.name as asset_name,
        a.status as asset_status,
        a.current_value as asset_current_value,
        c_from.name as from_company_name,
        c_from.code as from_company_code,
        c_to.name as to_company_name,
        c_to.code as to_company_code,
        CONCAT(e_from.first_name, ' ', e_from.last_name) as from_employee_name,
        CONCAT(e_to.first_name, ' ', e_to.last_name) as to_employee_name,
        d_from.name as from_department_name,
        d_to.name as to_department_name,
        CONCAT_WS(' - ', l_from.building, l_from.floor, l_from.room_number) as from_location_name,
        CONCAT_WS(' - ', l_to.building, l_to.floor, l_to.room_number) as to_location_name,
        u_req.username as requested_by_username,
        u_app.username as approved_by_username,
        u_disp.username as dispatched_by_username,
        u_rec.username as received_by_username
      FROM asset_transfers t
      JOIN assets a ON t.asset_id = a.id
      JOIN companies c_from ON t.from_company_id = c_from.id
      JOIN companies c_to ON t.to_company_id = c_to.id
      LEFT JOIN employees e_from ON t.from_employee_id = e_from.id
      LEFT JOIN employees e_to ON t.to_employee_id = e_to.id
      LEFT JOIN departments d_from ON t.from_department_id = d_from.id
      LEFT JOIN departments d_to ON t.to_department_id = d_to.id
      LEFT JOIN locations l_from ON t.from_location_id = l_from.id
      LEFT JOIN locations l_to ON t.to_location_id = l_to.id
      LEFT JOIN users u_req ON t.requested_by = u_req.id
      LEFT JOIN users u_app ON t.approved_by = u_app.id
      LEFT JOIN users u_disp ON t.dispatched_by = u_disp.id
      LEFT JOIN users u_rec ON t.received_by = u_rec.id
      WHERE t.id = $1;
    `;
    const res: QueryResult<TransferWithDetails> = client
      ? await client.query(sql, [id])
      : await query(sql, [id]);

    if (res.rows.length === 0) return null;
    const transfer = res.rows[0];

    // Load inter-company record if applicable
    if (transfer.transfer_type === "INTER_COMPANY") {
      const icSql = `SELECT * FROM inter_company_transfers WHERE transfer_id = $1;`;
      const icRes = client ? await client.query(icSql, [id]) : await query(icSql, [id]);
      transfer.inter_company = icRes.rows[0] || null;
    }

    // Load handovers
    const hoSql = `SELECT * FROM handover_records WHERE transfer_id = $1 ORDER BY acknowledged_at ASC;`;
    const hoRes = client ? await client.query(hoSql, [id]) : await query(hoSql, [id]);
    transfer.handovers = hoRes.rows;

    return transfer;
  }

  async findByIdWithLock(id: string, client: PoolClient): Promise<TransferWithDetails | null> {
    const lockSql = `SELECT id FROM asset_transfers WHERE id = $1 FOR UPDATE;`;
    const lockRes = await client.query(lockSql, [id]);
    if (lockRes.rows.length === 0) return null;
    return await this.findById(id, client);
  }

  async list(options: ListTransfersOptions): Promise<{ transfers: TransferWithDetails[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (options.companyId) {
      // Must match either originating or receiving company
      conditions.push(`(t.from_company_id = $${idx} OR t.to_company_id = $${idx})`);
      params.push(options.companyId);
      idx++;
    }

    if (options.status) {
      conditions.push(`t.status = $${idx++}`);
      params.push(options.status);
    }

    if (options.transferType) {
      conditions.push(`t.transfer_type = $${idx++}`);
      params.push(options.transferType);
    }

    if (options.assetId) {
      conditions.push(`t.asset_id = $${idx++}`);
      params.push(options.assetId);
    }

    if (options.search) {
      conditions.push(`(
        t.transfer_code ILIKE $${idx} OR
        a.asset_tag ILIKE $${idx} OR
        a.name ILIKE $${idx} OR
        t.reason ILIKE $${idx}
      )`);
      params.push(`%${options.search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const countSql = `
      SELECT COUNT(*) as total 
      FROM asset_transfers t
      JOIN assets a ON t.asset_id = a.id
      ${whereClause};
    `;
    const countRes = await query<{ total: string }>(countSql, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    const dataSql = `
      SELECT 
        t.*,
        a.asset_tag,
        a.name as asset_name,
        a.status as asset_status,
        a.current_value as asset_current_value,
        c_from.name as from_company_name,
        c_from.code as from_company_code,
        c_to.name as to_company_name,
        c_to.code as to_company_code,
        CONCAT(e_from.first_name, ' ', e_from.last_name) as from_employee_name,
        CONCAT(e_to.first_name, ' ', e_to.last_name) as to_employee_name,
        d_from.name as from_department_name,
        d_to.name as to_department_name,
        CONCAT_WS(' - ', l_from.building, l_from.floor, l_from.room_number) as from_location_name,
        CONCAT_WS(' - ', l_to.building, l_to.floor, l_to.room_number) as to_location_name,
        u_req.username as requested_by_username,
        u_app.username as approved_by_username,
        u_disp.username as dispatched_by_username,
        u_rec.username as received_by_username
      FROM asset_transfers t
      JOIN assets a ON t.asset_id = a.id
      JOIN companies c_from ON t.from_company_id = c_from.id
      JOIN companies c_to ON t.to_company_id = c_to.id
      LEFT JOIN employees e_from ON t.from_employee_id = e_from.id
      LEFT JOIN employees e_to ON t.to_employee_id = e_to.id
      LEFT JOIN departments d_from ON t.from_department_id = d_from.id
      LEFT JOIN departments d_to ON t.to_department_id = d_to.id
      LEFT JOIN locations l_from ON t.from_location_id = l_from.id
      LEFT JOIN locations l_to ON t.to_location_id = l_to.id
      LEFT JOIN users u_req ON t.requested_by = u_req.id
      LEFT JOIN users u_app ON t.approved_by = u_app.id
      LEFT JOIN users u_disp ON t.dispatched_by = u_disp.id
      LEFT JOIN users u_rec ON t.received_by = u_rec.id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;

    const dataRes = await query<TransferWithDetails>(dataSql, [...params, limit, offset]);
    return {
      transfers: dataRes.rows,
      total,
    };
  }

  async listByAssetId(assetId: string): Promise<TransferWithDetails[]> {
    const res = await this.list({ assetId, limit: 100 });
    return res.transfers;
  }

  async updateStatus(
    id: string,
    status: AssetTransferRow["status"],
    fields: Partial<AssetTransferRow>,
    client: PoolClient
  ): Promise<void> {
    const updates: string[] = ["status = $2", "updated_at = NOW()"];
    const params: unknown[] = [id, status];
    let idx = 3;

    if (fields.approved_by !== undefined) {
      updates.push(`approved_by = $${idx++}`);
      params.push(fields.approved_by);
    }
    if (fields.dispatched_by !== undefined) {
      updates.push(`dispatched_by = $${idx++}`);
      params.push(fields.dispatched_by);
    }
    if (fields.received_by !== undefined) {
      updates.push(`received_by = $${idx++}`);
      params.push(fields.received_by);
    }
    if (fields.dispatch_date !== undefined) {
      updates.push(`dispatch_date = $${idx++}`);
      params.push(fields.dispatch_date);
    }
    if (fields.actual_delivery_date !== undefined) {
      updates.push(`actual_delivery_date = $${idx++}`);
      params.push(fields.actual_delivery_date);
    }
    if (fields.condition_after !== undefined) {
      updates.push(`condition_after = $${idx++}`);
      params.push(fields.condition_after);
    }
    if (fields.rejection_reason !== undefined) {
      updates.push(`rejection_reason = $${idx++}`);
      params.push(fields.rejection_reason);
    }
    if (fields.dispute_reason !== undefined) {
      updates.push(`dispute_reason = $${idx++}`);
      params.push(fields.dispute_reason);
    }
    if (fields.resolution_notes !== undefined) {
      updates.push(`resolution_notes = $${idx++}`);
      params.push(fields.resolution_notes);
    }
    if (fields.remarks !== undefined) {
      updates.push(`remarks = $${idx++}`);
      params.push(fields.remarks);
    }

    const sql = `UPDATE asset_transfers SET ${updates.join(", ")} WHERE id = $1;`;
    await client.query(sql, params);
  }

  async updateInterCompany(
    transferId: string,
    fields: Partial<InterCompanyTransferRow>,
    client: PoolClient
  ): Promise<void> {
    const updates: string[] = [];
    const params: unknown[] = [transferId];
    let idx = 2;

    if (fields.status !== undefined) {
      updates.push(`status = $${idx++}`);
      params.push(fields.status);
    }
    if (fields.receiving_admin_id !== undefined) {
      updates.push(`receiving_admin_id = $${idx++}`);
      params.push(fields.receiving_admin_id);
    }
    if (fields.receipt_date !== undefined) {
      updates.push(`receipt_date = $${idx++}`);
      params.push(fields.receipt_date);
    }
    if (fields.dispatch_date !== undefined) {
      updates.push(`dispatch_date = $${idx++}`);
      params.push(fields.dispatch_date);
    }
    if (fields.acknowledgement_notes !== undefined) {
      updates.push(`acknowledgement_notes = $${idx++}`);
      params.push(fields.acknowledgement_notes);
    }
    if (fields.dispute_reason !== undefined) {
      updates.push(`dispute_reason = $${idx++}`);
      params.push(fields.dispute_reason);
    }
    if (fields.resolution_notes !== undefined) {
      updates.push(`resolution_notes = $${idx++}`);
      params.push(fields.resolution_notes);
    }

    if (updates.length === 0) return;
    const sql = `UPDATE inter_company_transfers SET ${updates.join(", ")} WHERE transfer_id = $1;`;
    await client.query(sql, params);
  }
}

export const transfersRepository = new TransfersRepository();
