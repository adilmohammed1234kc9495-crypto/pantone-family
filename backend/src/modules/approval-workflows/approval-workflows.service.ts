import { withTransaction } from "../../config/database";
import { AuthUser } from "../../middleware/auth.middleware";
import { assertCompanyAccess } from "../../middleware/tenant.middleware";
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from "../../utils/errors";
import {
  approvalWorkflowsRepository,
  WorkflowWithSteps,
  CreateWorkflowInput,
} from "./approval-workflows.repository";

export class ApprovalWorkflowsService {
  async createWorkflow(input: CreateWorkflowInput, user: AuthUser): Promise<WorkflowWithSteps> {
    const targetCompanyId = user.isCommonAdmin
      ? (input.companyId || user.companyId)
      : user.companyId!;

    if (!targetCompanyId) {
      throw new ValidationError("Company ID is required to configure approval workflow");
    }

    assertCompanyAccess(user, targetCompanyId);

    if (!input.name || !input.name.trim()) {
      throw new ValidationError("Workflow name is required");
    }
    if (!input.steps || !Array.isArray(input.steps) || input.steps.length === 0) {
      throw new ValidationError("At least one approval step is required");
    }

    // Step order validation: sequence must start at 1 and have no gaps or duplicates
    const stepNumbers = input.steps.map((s, idx) => s.stepNumber !== undefined ? s.stepNumber : (s.stepOrder !== undefined ? s.stepOrder : idx + 1));
    const sorted = [...stepNumbers].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== i + 1) {
        throw new BadRequestError(`Workflow steps must be sequential without gaps or duplicate step numbers (Expected step ${i + 1}, found ${sorted[i]})`);
      }
    }

    const requestType = input.requestType || "ASSET_REQUEST";

    return await withTransaction(async (client) => {
      // Deactivate any existing active workflow for this company and request type
      await client.query(`
        UPDATE approval_workflows 
        SET is_active = false, updated_at = NOW() 
        WHERE company_id = $1 AND request_type = $2 AND is_active = true;
      `, [targetCompanyId, requestType]);

      // Create workflow
      const wf = await approvalWorkflowsRepository.createWorkflow(
        targetCompanyId,
        input.name.trim(),
        requestType,
        input.description || null,
        client
      );

      // Create ordered steps
      let stepOrder = 1;
      for (const step of input.steps) {
        if (!step.roleCode) {
          throw new ValidationError(`Role code is required for step ${stepOrder}`);
        }

        const actualStepOrder = step.stepNumber !== undefined ? step.stepNumber : (step.stepOrder !== undefined ? step.stepOrder : stepOrder);
        await approvalWorkflowsRepository.addStep(
          wf.id,
          actualStepOrder,
          step.roleCode.trim().toUpperCase(),
          step.description || step.stepName || null,
          client
        );
        stepOrder++;
      }

      // Audit Log
      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, new_values_json
        ) VALUES ($1, $2, 'APPROVAL_CONFIG_UPDATED', 'approval_workflows', $3, $4::jsonb);
      `, [
        targetCompanyId,
        user.id,
        wf.id,
        JSON.stringify({
          name: wf.name,
          requestType,
          stepCount: input.steps.length
        })
      ]);

      const fullWf = await approvalWorkflowsRepository.findById(wf.id, client);
      return fullWf!;
    });
  }

  async listWorkflows(companyId: string | null | undefined, user: AuthUser): Promise<WorkflowWithSteps[]> {
    const targetCompanyId = user.isCommonAdmin
      ? (companyId || null)
      : user.companyId!;

    return await approvalWorkflowsRepository.listByCompany(targetCompanyId);
  }

  async getWorkflowById(id: string, user: AuthUser): Promise<WorkflowWithSteps> {
    const wf = await approvalWorkflowsRepository.findById(id);
    if (!wf) {
      throw new NotFoundError(`Approval workflow '${id}' not found`);
    }

    assertCompanyAccess(user, wf.company_id);
    return wf;
  }

  async getActiveWorkflow(companyId: string, requestType: string = "ASSET_REQUEST"): Promise<WorkflowWithSteps> {
    let wf = await approvalWorkflowsRepository.findActiveByCompany(companyId, requestType);
    if (!wf) {
      // Fallback: create default 3-tier workflow if not found
      wf = await withTransaction(async (client) => {
        const newWf = await approvalWorkflowsRepository.createWorkflow(
          companyId,
          "Default 3-Tier Asset Approval",
          requestType,
          "Auto-generated default approval hierarchy",
          client
        );
        await approvalWorkflowsRepository.addStep(newWf.id, 1, "DEPT_MANAGER", "Department Head Authorization", client);
        await approvalWorkflowsRepository.addStep(newWf.id, 2, "ASSET_MANAGER", "Asset Custody Verification", client);
        await approvalWorkflowsRepository.addStep(newWf.id, 3, "COMPANY_ADMIN", "Executive Authorization", client);
        return (await approvalWorkflowsRepository.findById(newWf.id, client))!;
      });
    }
    return wf;
  }

  async updateWorkflow(
    id: string,
    input: { name?: string; description?: string | null; isActive?: boolean },
    user: AuthUser
  ): Promise<WorkflowWithSteps> {
    const existing = await approvalWorkflowsRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Approval workflow '${id}' not found`);
    }

    assertCompanyAccess(user, existing.company_id);

    await approvalWorkflowsRepository.updateWorkflow(id, input);
    const updated = await approvalWorkflowsRepository.findById(id);
    return updated!;
  }
}

export const approvalWorkflowsService = new ApprovalWorkflowsService();
