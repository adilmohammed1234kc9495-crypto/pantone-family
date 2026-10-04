import { PoolClient, QueryResult } from "pg";
import { query } from "../../config/database";

export interface AssetRequestApprovalRow {
  id: string;
  request_id: string;
  approver_id: string | null;
  step_number: number;
  approval_level: number;
  approver_role: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED" | "CANCELLED";
  decision: "APPROVED" | "REJECTED" | "RETURNED_FOR_CORRECTION" | null;
  comments: string | null;
  remarks: string | null;
  decided_at: string | null;
  action_timestamp: string;
}

export interface ApprovalWithDetails extends AssetRequestApprovalRow {
  approver_username: string | null;
  request_number: string;
  requester_username: string | null;
  employee_first_name: string;
  employee_last_name: string;
  department_name: string | null;
  item_name: string | null;
  quantity: number;
  priority: string;
  justification: string;
  company_id: string;
  request_status: string;
  current_approval_level: number;
  department_id: string | null;
  requester_id: string | null;
}

export class ApprovalsRepository {
  async createStage(
    data: {
      requestId: string;
      stepNumber: number;
      approvalLevel: number;
      approverRole: string;
      status?: "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED" | "CANCELLED";
    },
    client: PoolClient
  ): Promise<AssetRequestApprovalRow> {
    const sql = `
      INSERT INTO asset_request_approvals (
        request_id, step_number, approval_level, approver_role, status, action_timestamp
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *;
    `;
    const params = [
      data.requestId,
      data.stepNumber,
      data.approvalLevel,
      data.approverRole,
      data.status || "PENDING",
    ];
    const res: QueryResult<AssetRequestApprovalRow> = await client.query(sql, params);
    return res.rows[0];
  }

  async findByRequestId(requestId: string, client?: PoolClient): Promise<ApprovalWithDetails[]> {
    const sql = `
      SELECT 
        a.*,
        u.username as approver_username,
        r.request_number,
        req_u.username as requester_username,
        e.first_name as employee_first_name,
        e.last_name as employee_last_name,
        d.name as department_name,
        r.item_name,
        r.quantity,
        r.priority,
        r.justification,
        r.company_id,
        r.status as request_status,
        r.current_approval_level,
        r.department_id,
        r.requester_id
      FROM asset_request_approvals a
      JOIN asset_requests r ON a.request_id = r.id
      LEFT JOIN employees e ON r.employee_id = e.id
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN users u ON a.approver_id = u.id
      LEFT JOIN users req_u ON r.requester_id = req_u.id
      WHERE a.request_id = $1
      ORDER BY a.approval_level ASC, a.step_number ASC;
    `;
    const res: QueryResult<ApprovalWithDetails> = client
      ? await client.query(sql, [requestId])
      : await query(sql, [requestId]);
    return res.rows;
  }

  async findByIdWithLock(id: string, client: PoolClient): Promise<ApprovalWithDetails | null> {
    const sql = `
      SELECT 
        a.*,
        u.username as approver_username,
        r.request_number,
        r.company_id,
        r.department_id,
        r.current_approval_level,
        r.status as request_status,
        r.requester_id,
        req_u.username as requester_username,
        e.first_name as employee_first_name,
        e.last_name as employee_last_name,
        d.name as department_name,
        r.item_name,
        r.quantity,
        r.priority,
        r.justification
      FROM asset_request_approvals a
      JOIN asset_requests r ON a.request_id = r.id
      LEFT JOIN employees e ON r.employee_id = e.id
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN users u ON a.approver_id = u.id
      LEFT JOIN users req_u ON r.requester_id = req_u.id
      WHERE a.id = $1
      FOR UPDATE OF a;
    `;
    const res: QueryResult<ApprovalWithDetails> = await client.query(sql, [id]);
    return res.rows[0] || null;
  }

  async updateDecision(
    id: string,
    data: {
      status: "APPROVED" | "REJECTED" | "SKIPPED" | "CANCELLED";
      decision: "APPROVED" | "REJECTED" | "RETURNED_FOR_CORRECTION";
      approverId: string;
      remarks?: string | null;
    },
    client: PoolClient
  ): Promise<AssetRequestApprovalRow> {
    const sql = `
      UPDATE asset_request_approvals 
      SET 
        status = $2,
        decision = $3,
        approver_id = $4,
        remarks = $5,
        comments = $5,
        decided_at = NOW(),
        action_timestamp = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const params = [
      id,
      data.status,
      data.decision,
      data.approverId,
      data.remarks || null,
    ];
    const res: QueryResult<AssetRequestApprovalRow> = await client.query(sql, params);
    return res.rows[0];
  }

  async cancelRemainingStages(requestId: string, fromLevel: number, client: PoolClient): Promise<void> {
    await client.query(`
      UPDATE asset_request_approvals 
      SET status = 'CANCELLED', action_timestamp = NOW()
      WHERE request_id = $1 AND approval_level > $2 AND status = 'PENDING';
    `, [requestId, fromLevel]);
  }

  async findPendingForRole(
    companyId?: string | null,
    roleCode?: string,
    departmentId?: string | null
  ): Promise<ApprovalWithDetails[]> {
    const conditions: string[] = [
      "a.status = 'PENDING'",
      "r.status = 'PENDING_APPROVAL'",
      "a.approval_level = r.current_approval_level"
    ];
    const params: unknown[] = [];
    let idx = 1;

    if (companyId) {
      conditions.push(`r.company_id = $${idx++}`);
      params.push(companyId);
    }
    if (roleCode) {
      conditions.push(`a.approver_role = $${idx++}`);
      params.push(roleCode);
    }
    if (departmentId) {
      conditions.push(`r.department_id = $${idx++}`);
      params.push(departmentId);
    }

    const sql = `
      SELECT 
        a.*,
        u.username as approver_username,
        r.request_number,
        req_u.username as requester_username,
        e.first_name as employee_first_name,
        e.last_name as employee_last_name,
        d.name as department_name,
        r.item_name,
        r.quantity,
        r.priority,
        r.justification,
        r.company_id,
        r.status as request_status,
        r.current_approval_level,
        r.department_id,
        r.requester_id
      FROM asset_request_approvals a
      JOIN asset_requests r ON a.request_id = r.id
      JOIN employees e ON r.employee_id = e.id
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN users u ON a.approver_id = u.id
      LEFT JOIN users req_u ON r.requester_id = req_u.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY r.created_at ASC;
    `;
    const res = await query<ApprovalWithDetails>(sql, params);
    return res.rows;
  }
}

export const approvalsRepository = new ApprovalsRepository();
