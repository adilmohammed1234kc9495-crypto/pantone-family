import { PoolClient, QueryResult } from "pg";
import { query } from "../../config/database";

export interface ApprovalWorkflowRow {
  id: string;
  company_id: string;
  name: string;
  request_type: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApprovalWorkflowStepRow {
  id: string;
  workflow_id: string;
  step_order: number;
  role_code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WorkflowWithSteps extends ApprovalWorkflowRow {
  steps: ApprovalWorkflowStepRow[];
  company_name?: string;
  company_code?: string;
}

export interface CreateWorkflowInput {
  companyId: string;
  name: string;
  requestType?: string;
  description?: string | null;
  steps: Array<{
    stepOrder?: number;
    stepNumber?: number;
    approvalLevel?: number;
    roleCode: string;
    description?: string | null;
    stepName?: string | null;
  }>;
}

export class ApprovalWorkflowsRepository {
  async createWorkflow(
    companyId: string,
    name: string,
    requestType: string,
    description: string | null,
    client: PoolClient
  ): Promise<ApprovalWorkflowRow> {
    const sql = `
      INSERT INTO approval_workflows (company_id, name, request_type, description, is_active)
      VALUES ($1, $2, $3, $4, true)
      RETURNING *;
    `;
    const res: QueryResult<ApprovalWorkflowRow> = await client.query(sql, [
      companyId,
      name,
      requestType,
      description,
    ]);
    return res.rows[0];
  }

  async addStep(
    workflowId: string,
    stepOrder: number,
    roleCode: string,
    description: string | null,
    client: PoolClient
  ): Promise<ApprovalWorkflowStepRow> {
    const sql = `
      INSERT INTO approval_workflow_steps (workflow_id, step_order, role_code, description, is_active)
      VALUES ($1, $2, $3, $4, true)
      RETURNING *;
    `;
    const res: QueryResult<ApprovalWorkflowStepRow> = await client.query(sql, [
      workflowId,
      stepOrder,
      roleCode,
      description,
    ]);
    return res.rows[0];
  }

  async findActiveByCompany(
    companyId: string,
    requestType: string = "ASSET_REQUEST",
    client?: PoolClient
  ): Promise<WorkflowWithSteps | null> {
    const sql = `
      SELECT w.*, c.name as company_name, c.code as company_code
      FROM approval_workflows w
      JOIN companies c ON w.company_id = c.id
      WHERE w.company_id = $1 AND w.request_type = $2 AND w.is_active = true
      LIMIT 1;
    `;
    const res: QueryResult<WorkflowWithSteps> = client
      ? await client.query(sql, [companyId, requestType])
      : await query(sql, [companyId, requestType]);

    if (res.rows.length === 0) return null;
    const workflow = res.rows[0];

    const stepsSql = `
      SELECT * FROM approval_workflow_steps
      WHERE workflow_id = $1 AND is_active = true
      ORDER BY step_order ASC;
    `;
    const stepsRes: QueryResult<ApprovalWorkflowStepRow> = client
      ? await client.query(stepsSql, [workflow.id])
      : await query(stepsSql, [workflow.id]);

    workflow.steps = stepsRes.rows;
    return workflow;
  }

  async findById(id: string, client?: PoolClient): Promise<WorkflowWithSteps | null> {
    const sql = `
      SELECT w.*, c.name as company_name, c.code as company_code
      FROM approval_workflows w
      JOIN companies c ON w.company_id = c.id
      WHERE w.id = $1;
    `;
    const res: QueryResult<WorkflowWithSteps> = client
      ? await client.query(sql, [id])
      : await query(sql, [id]);

    if (res.rows.length === 0) return null;
    const workflow = res.rows[0];

    const stepsSql = `
      SELECT * FROM approval_workflow_steps
      WHERE workflow_id = $1
      ORDER BY step_order ASC;
    `;
    const stepsRes: QueryResult<ApprovalWorkflowStepRow> = client
      ? await client.query(stepsSql, [id])
      : await query(stepsSql, [id]);

    workflow.steps = stepsRes.rows;
    return workflow;
  }

  async listByCompany(companyId?: string | null): Promise<WorkflowWithSteps[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (companyId) {
      conditions.push(`w.company_id = $1`);
      params.push(companyId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `
      SELECT w.*, c.name as company_name, c.code as company_code
      FROM approval_workflows w
      JOIN companies c ON w.company_id = c.id
      ${whereClause}
      ORDER BY w.created_at DESC;
    `;
    const res = await query<WorkflowWithSteps>(sql, params);

    for (const w of res.rows) {
      const stepsRes = await query<ApprovalWorkflowStepRow>(
        `SELECT * FROM approval_workflow_steps WHERE workflow_id = $1 ORDER BY step_order ASC;`,
        [w.id]
      );
      w.steps = stepsRes.rows;
    }

    return res.rows;
  }

  async updateWorkflow(
    id: string,
    data: { name?: string; description?: string | null; isActive?: boolean },
    client?: PoolClient
  ): Promise<void> {
    const fields: string[] = ["updated_at = NOW()"];
    const params: unknown[] = [id];
    let idx = 2;

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      params.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${idx++}`);
      params.push(data.description);
    }
    if (data.isActive !== undefined) {
      fields.push(`is_active = $${idx++}`);
      params.push(data.isActive);
    }

    const sql = `UPDATE approval_workflows SET ${fields.join(", ")} WHERE id = $1;`;
    if (client) {
      await client.query(sql, params);
    } else {
      await query(sql, params);
    }
  }

  async deleteSteps(workflowId: string, client: PoolClient): Promise<void> {
    await client.query(`DELETE FROM approval_workflow_steps WHERE workflow_id = $1;`, [workflowId]);
  }
}

export const approvalWorkflowsRepository = new ApprovalWorkflowsRepository();
