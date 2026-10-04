import { withTransaction } from "../../config/database";
import { 
  assignmentsRepository, 
  AssignmentWithDetails, 
  ListAssignmentsOptions 
} from "./assignments.repository";
import { AuthUser } from "../../middleware/auth.middleware";
import { 
  assertCompanyAccess, 
  assertDepartmentAccess, 
  assertOwnershipAccess 
} from "../../middleware/tenant.middleware";
import { NotFoundError, ConflictError, ValidationError, BadRequestError } from "../../utils/errors";
import { notificationService } from "../notifications/notification.service";

export interface AssignAssetInput {
  assetId: string;
  employeeId: string;
  departmentId?: string | null;
  locationId?: string | null;
  conditionAtAssignment?: string;
  returnDueDate?: string | null;
  remarks?: string | null;
}

export interface ConfirmHandoverInput {
  condition: string;
  remarks?: string | null;
  signatureRef?: string | null;
}

export class AssignmentsService {
  async assignAsset(input: AssignAssetInput, user: AuthUser): Promise<AssignmentWithDetails> {
    if (!input.assetId || !input.employeeId) {
      throw new ValidationError("Asset ID and Employee ID are required for custody assignment");
    }

    return await withTransaction(async (client) => {
      // 1. Lock the asset row to prevent concurrent assignment attempts
      const assetRes = await client.query(`
        SELECT id, company_id, branch_id, department_id, location_id, status, assigned_employee_id, condition
        FROM assets
        WHERE id = $1
        FOR UPDATE
      `, [input.assetId]);

      if (assetRes.rows.length === 0) {
        throw new NotFoundError(`Asset '${input.assetId}' not found`);
      }
      const asset = assetRes.rows[0];

      // 2. Validate tenant and department boundaries
      assertCompanyAccess(user, asset.company_id);
      if (asset.department_id) {
        assertDepartmentAccess(user, asset.department_id);
      }

      // 3. Status Check: Must be AVAILABLE or IN_STOCK
      if (asset.status !== "AVAILABLE" && asset.status !== "IN_STOCK") {
        throw new ConflictError(
          `Asset '${input.assetId}' cannot be assigned because its current status is '${asset.status}'`
        );
      }

      // 4. Verify no existing ACTIVE custody assignment exists
      const existingAssignment = await assignmentsRepository.findActiveByAssetId(asset.id, client);
      if (existingAssignment) {
        throw new ConflictError(`Asset '${input.assetId}' already has an active custody assignment`);
      }

      // 5. Verify Employee exists, is active, and belongs to same company
      const empRes = await client.query(`
        SELECT id, company_id, department_id, employee_code, first_name, last_name, status
        FROM employees
        WHERE id = $1
      `, [input.employeeId]);

      if (empRes.rows.length === 0 || empRes.rows[0].status !== "ACTIVE") {
        throw new NotFoundError(`Target employee '${input.employeeId}' does not exist or is inactive`);
      }
      const employee = empRes.rows[0];

      if (employee.company_id !== asset.company_id) {
        throw new BadRequestError("Cross-company assignment prohibited: Employee belongs to a different company");
      }

      // Resolve department & location
      const targetDeptId = input.departmentId || employee.department_id || asset.department_id;
      const targetLocId = input.locationId || asset.location_id;

      // 6. Create Assignment Record
      const assignment = await assignmentsRepository.create({
        assetId: asset.id,
        companyId: asset.company_id,
        employeeId: employee.id,
        departmentId: targetDeptId,
        locationId: targetLocId,
        assignedBy: user.id,
        conditionAtAssignment: input.conditionAtAssignment || asset.condition || "GOOD",
        returnDueDate: input.returnDueDate || null,
        remarks: input.remarks || null
      }, client);

      // 7. Update Asset record
      await client.query(`
        UPDATE assets
        SET 
          status = 'ASSIGNED',
          assigned_employee_id = $2,
          department_id = $3,
          location_id = $4
        WHERE id = $1
      `, [asset.id, employee.id, targetDeptId, targetLocId]);

      // 8. Immutable Asset History Ledger
      await client.query(`
        INSERT INTO asset_history (
          asset_id, company_id, event_type, from_state, to_state, entity_affected, performed_by, details_json
        ) VALUES ($1, $2, 'CUSTODY_ASSIGNED', $3, 'ASSIGNED', 'asset_assignments', $4, $5::jsonb)
      `, [
        asset.id,
        asset.company_id,
        asset.status,
        user.id,
        JSON.stringify({
          assignmentId: assignment.id,
          employeeId: employee.id,
          employeeCode: employee.employee_code,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          assignedBy: user.username
        })
      ]);

      // 9. Audit Log
      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, new_values_json
        ) VALUES ($1, $2, 'ASSET_ASSIGNMENT_CREATED', 'asset_assignments', $3, $4::jsonb)
      `, [
        asset.company_id,
        user.id,
        assignment.id,
        JSON.stringify({
          assignmentId: assignment.id,
          assetId: asset.id,
          employeeId: employee.id
        })
      ]);

      // 10. Notification for assigned employee
      await notificationService.notifyEmployee(
        employee.id,
        {
          companyId: asset.company_id,
          notificationType: "ASSET_ASSIGNED",
          title: `Asset Assigned: ${asset.asset_tag}`,
          message: `Asset '${asset.name}' (${asset.asset_tag}) has been assigned to you in condition '${input.conditionAtAssignment || asset.condition || "GOOD"}'.`,
          severity: "INFO",
          entityType: "asset_assignments",
          entityId: assignment.id,
          actionUrl: `/assets/${asset.id}`,
          idempotencyKey: `ASSIGN:${assignment.id}`
        },
        client
      );

      const fullDetails = await assignmentsRepository.findById(assignment.id, client);
      return fullDetails!;
    });
  }

  async confirmHandover(assignmentId: string, input: ConfirmHandoverInput, user: AuthUser): Promise<AssignmentWithDetails> {
    if (!input.condition) {
      throw new ValidationError("Condition is required to confirm physical asset handover");
    }

    return await withTransaction(async (client) => {
      // 1. Lock assignment
      const assignRes = await client.query(`
        SELECT * FROM asset_assignments WHERE id = $1 FOR UPDATE
      `, [assignmentId]);

      if (assignRes.rows.length === 0) {
        throw new NotFoundError(`Assignment '${assignmentId}' not found`);
      }
      const assignment = assignRes.rows[0];

      // 2. Validate company and department boundaries
      assertCompanyAccess(user, assignment.company_id);
      if (assignment.department_id) {
        assertDepartmentAccess(user, assignment.department_id);
      }

      if (assignment.status !== "ACTIVE") {
        throw new ValidationError(`Cannot confirm handover on inactive assignment with status '${assignment.status}'`);
      }

      if (assignment.is_handed_over) {
        throw new ConflictError("Physical handover has already been confirmed for this assignment");
      }

      // 3. Update assignment handover
      const updated = await assignmentsRepository.updateHandover(assignment.id, {
        condition: input.condition,
        remarks: input.remarks || null,
        signatureRef: input.signatureRef || null,
        handedOverBy: user.id
      }, client);

      // 4. Update asset condition if changed
      await client.query(`
        UPDATE assets
        SET condition = $2
        WHERE id = $1
      `, [assignment.asset_id, input.condition]);

      // 5. Asset History
      await client.query(`
        INSERT INTO asset_history (
          asset_id, company_id, event_type, from_state, to_state, entity_affected, performed_by, details_json
        ) VALUES ($1, $2, 'CUSTODY_HANDOVER', 'ASSIGNED', 'ASSIGNED', 'asset_assignments', $3, $4::jsonb)
      `, [
        assignment.asset_id,
        assignment.company_id,
        user.id,
        JSON.stringify({
          assignmentId: assignment.id,
          handedOverBy: user.username,
          handoverCondition: input.condition,
          remarks: input.remarks || null
        })
      ]);

      // 6. Audit Log
      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, new_values_json
        ) VALUES ($1, $2, 'ASSET_HANDOVER_CONFIRMED', 'asset_assignments', $3, $4::jsonb)
      `, [
        assignment.company_id,
        user.id,
        assignment.id,
        JSON.stringify(updated)
      ]);

      const fullDetails = await assignmentsRepository.findById(assignment.id, client);
      return fullDetails!;
    });
  }

  async getAssignmentById(id: string, user: AuthUser): Promise<AssignmentWithDetails> {
    const assignment = await assignmentsRepository.findById(id);
    if (!assignment) {
      throw new NotFoundError(`Assignment '${id}' not found`);
    }

    assertCompanyAccess(user, assignment.company_id);
    if (assignment.department_id) {
      assertDepartmentAccess(user, assignment.department_id);
    }
    assertOwnershipAccess(user, assignment.employee_id);

    return assignment;
  }

  async listAssignments(options: ListAssignmentsOptions, user: AuthUser): Promise<{ assignments: AssignmentWithDetails[]; total: number }> {
    const filterOptions: ListAssignmentsOptions = { ...options };

    if (!user.isCommonAdmin) {
      filterOptions.companyId = user.companyId!;
      if (user.roleCode === "EMPLOYEE") {
        if (!user.employeeId) {
          return { assignments: [], total: 0 };
        }
        filterOptions.employeeId = user.employeeId;
      } else if (user.roleCode === "DEPT_MANAGER" && user.departmentId) {
        filterOptions.departmentId = user.departmentId;
      }
    }

    return await assignmentsRepository.list(filterOptions);
  }
}

export const assignmentsService = new AssignmentsService();