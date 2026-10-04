import crypto from "crypto";
import { withTransaction } from "../../config/database";
import { 
  returnsRepository, 
  ReturnWithDetails, 
  ListReturnsOptions 
} from "./returns.repository";
import { assignmentsRepository } from "../assignments/assignments.repository";
import { AuthUser } from "../../middleware/auth.middleware";
import { 
  assertCompanyAccess, 
  assertOwnershipAccess 
} from "../../middleware/tenant.middleware";
import { NotFoundError, ConflictError, ValidationError, ForbiddenError, BadRequestError } from "../../utils/errors";
import { notificationService } from "../notifications/notification.service";

export interface InitiateReturnInput {
  assetId: string;
  condition: string;
  returnReason?: string | null;
  damageDescription?: string | null;
  damagePhotoUrl?: string | null;
  remarks?: string | null;
}

export interface InspectReturnInput {
  inspectionStatus: "PASSED" | "MAINTENANCE_REQUIRED" | "DAMAGE_REVIEW";
  condition?: string;
  functionalStatus?: string | null;
  missingAccessories?: string | null;
  missingComponents?: string | null;
  inspectionNotes?: string | null;
  // Specific for MAINTENANCE_REQUIRED
  maintenanceProblem?: string;
  // Specific for DAMAGE_REVIEW
  damageType?: string;
  damageSeverity?: "MINOR" | "MODERATE" | "MAJOR" | "CRITICAL";
  damageDescription?: string;
  repairRecommendation?: "REPAIR" | "REPLACE_PARTS" | "SCRAP_RECOMMENDED" | "INSURANCE_CLAIM";
}

export class ReturnsService {
  async initiateReturn(input: InitiateReturnInput, user: AuthUser): Promise<ReturnWithDetails> {
    if (!input.assetId) {
      throw new ValidationError("Asset ID is required to initiate return");
    }

    return await withTransaction(async (client) => {
      // 1. Lock asset
      const assetRes = await client.query(`
        SELECT id, company_id, department_id, location_id, status, assigned_employee_id, condition
        FROM assets
        WHERE id = $1
        FOR UPDATE
      `, [input.assetId]);

      if (assetRes.rows.length === 0) {
        throw new NotFoundError(`Asset '${input.assetId}' not found`);
      }
      const asset = assetRes.rows[0];

      // 2. Validate company & ownership
      assertCompanyAccess(user, asset.company_id);
      if (asset.assigned_employee_id) {
        assertOwnershipAccess(user, asset.assigned_employee_id);
      }

      // 3. Status Check: Must be currently ASSIGNED
      if (asset.status !== "ASSIGNED") {
        throw new BadRequestError(`Cannot return asset: current status is '${asset.status}', expected 'ASSIGNED'`);
      }

      // 4. Find active assignment if any
      const activeAssignment = await assignmentsRepository.findActiveByAssetId(asset.id, client);
      if (activeAssignment) {
        await assignmentsRepository.updateStatus(activeAssignment.id, "RETURNED", client);
      }

      // 5. Generate unique return code
      const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
      const returnCode = `RET-${new Date().getFullYear()}-${rand}`;

      // 6. Create Return record
      const returnedBy = activeAssignment?.employee_id || asset.assigned_employee_id || user.employeeId;
      if (!returnedBy) {
        throw new ValidationError("No associated custodian employee found for this asset return");
      }

      const returnRecord = await returnsRepository.create({
        returnCode,
        assetId: asset.id,
        assignmentId: activeAssignment?.id || null,
        companyId: asset.company_id,
        returnedBy,
        receivedBy: user.id,
        condition: input.condition || asset.condition || "GOOD",
        damageDescription: input.damageDescription || null,
        damagePhotoUrl: input.damagePhotoUrl || null,
        destinationStatus: "IN_STOCK",
        remarks: input.remarks || null,
        returnReason: input.returnReason || null
      }, client);

      // 7. Update Asset status to RETURNED
      await client.query(`
        UPDATE assets
        SET status = 'RETURNED', condition = $2
        WHERE id = $1
      `, [asset.id, input.condition || asset.condition]);

      // 8. Immutable Asset History Ledger
      await client.query(`
        INSERT INTO asset_history (
          asset_id, company_id, event_type, from_state, to_state, entity_affected, performed_by, details_json
        ) VALUES ($1, $2, 'ASSET_RETURNED', 'ASSIGNED', 'RETURNED', 'asset_returns', $3, $4::jsonb)
      `, [
        asset.id,
        asset.company_id,
        user.id,
        JSON.stringify({
          returnId: returnRecord.id,
          returnCode,
          returnedBy,
          condition: input.condition,
          remarks: input.remarks || null
        })
      ]);

      // 9. Audit Log
      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, new_values_json
        ) VALUES ($1, $2, 'ASSET_RETURN_INITIATED', 'asset_returns', $3, $4::jsonb)
      `, [
        asset.company_id,
        user.id,
        returnRecord.id,
        JSON.stringify(returnRecord)
      ]);

      // 10. Notifications
      await notificationService.notifyRole(
        asset.company_id,
        "ASSET_MANAGER",
        {
          notificationType: "ASSET_RETURNED",
          title: `Asset Returned: ${asset.asset_tag}`,
          message: `Asset '${asset.name}' (${asset.asset_tag}) was returned in condition '${input.condition}'.`,
          severity: "INFO",
          entityType: "asset_returns",
          entityId: returnRecord.id,
          actionUrl: `/returns`,
          idempotencyKey: `RETURN:${returnRecord.id}`
        },
        client
      );

      if (returnedBy) {
        await notificationService.notifyEmployee(
          returnedBy,
          {
            companyId: asset.company_id,
            notificationType: "ASSET_RETURNED",
            title: `Asset Return Confirmation: ${asset.asset_tag}`,
            message: `Asset '${asset.name}' (${asset.asset_tag}) return has been successfully processed.`,
            severity: "INFO",
            entityType: "asset_returns",
            entityId: returnRecord.id,
            actionUrl: `/returns`,
            idempotencyKey: `RETURN_EMP:${returnRecord.id}`
          },
          client
        );
      }

      if (input.condition === "DAMAGED") {
        await notificationService.notifyRole(
          asset.company_id,
          "ASSET_MANAGER",
          {
            notificationType: "DAMAGE_INSPECTION_REQUIRED",
            title: `Damage Inspection Required: ${asset.asset_tag}`,
            message: `Asset '${asset.name}' (${asset.asset_tag}) was returned with damage and requires formal inspection.`,
            severity: "WARNING",
            entityType: "asset_returns",
            entityId: returnRecord.id,
            actionUrl: `/damage-inspections`,
            idempotencyKey: `DAMAGE:${returnRecord.id}`
          },
          client
        );
      }

      const fullDetails = await returnsRepository.findById(returnRecord.id, client);
      return fullDetails!;
    });
  }

  async inspectReturn(returnId: string, input: InspectReturnInput, user: AuthUser): Promise<ReturnWithDetails> {
    if (!input.inspectionStatus) {
      throw new ValidationError("Inspection status is required ('PASSED', 'MAINTENANCE_REQUIRED', 'DAMAGE_REVIEW')");
    }

    if (user.roleCode === "AUDITOR") {
      throw new ForbiddenError("Auditors cannot perform return inspections");
    }

    return await withTransaction(async (client) => {
      // 1. Lock return record
      const returnRes = await client.query(`
        SELECT * FROM asset_returns WHERE id = $1 FOR UPDATE
      `, [returnId]);

      if (returnRes.rows.length === 0) {
        throw new NotFoundError(`Return record '${returnId}' not found`);
      }
      const returnRecord = returnRes.rows[0];

      // 2. Validate tenant access
      assertCompanyAccess(user, returnRecord.company_id);

      if (returnRecord.inspection_status !== "PENDING_INSPECTION") {
        throw new ConflictError("This return has already undergone inspection");
      }

      // 3. Lock asset
      const assetRes = await client.query(`
        SELECT id, company_id, status, condition FROM assets WHERE id = $1 FOR UPDATE
      `, [returnRecord.asset_id]);
      const asset = assetRes.rows[0];

      let targetDestinationStatus = "IN_STOCK";
      let targetAssetStatus = "AVAILABLE";
      let eventType = "RETURN_INSPECTION_PASSED";

      if (input.inspectionStatus === "PASSED") {
        targetDestinationStatus = "IN_STOCK";
        targetAssetStatus = "AVAILABLE";
        eventType = "RETURN_INSPECTION_PASSED";

        await client.query(`
          UPDATE assets
          SET 
            status = 'AVAILABLE',
            assigned_employee_id = NULL,
            condition = COALESCE($2, condition)
          WHERE id = $1
        `, [asset.id, input.condition || returnRecord.condition]);

      } else if (input.inspectionStatus === "MAINTENANCE_REQUIRED") {
        targetDestinationStatus = "UNDER_MAINTENANCE";
        targetAssetStatus = "UNDER_MAINTENANCE";
        eventType = "RETURN_INSPECTION_MAINTENANCE";

        await client.query(`
          UPDATE assets
          SET 
            status = 'UNDER_MAINTENANCE',
            assigned_employee_id = NULL,
            condition = COALESCE($2, condition)
          WHERE id = $1
        `, [asset.id, input.condition || "FAIR"]);

        // Auto-generate Open Work Order
        const woRand = crypto.randomBytes(3).toString("hex").toUpperCase();
        const woNumber = `WO-${new Date().getFullYear()}-${woRand}`;
        const maintCode = `MNT-${new Date().getFullYear()}-${woRand}`;

        await client.query(`
          INSERT INTO maintenance_records (
            maintenance_code,
            work_order_number,
            asset_id,
            company_id,
            problem,
            reported_by,
            maintenance_type,
            priority,
            status,
            description
          ) VALUES ($1, $2, $3, $4, $5, $6, 'CORRECTIVE', 'MEDIUM', 'OPEN', $7)
        `, [
          maintCode,
          woNumber,
          asset.id,
          asset.company_id,
          input.maintenanceProblem || "Maintenance required following return inspection",
          user.id,
          input.inspectionNotes || "Automated work order triggered by return inspection"
        ]);

      } else if (input.inspectionStatus === "DAMAGE_REVIEW") {
        targetDestinationStatus = "DAMAGED";
        targetAssetStatus = "DAMAGED";
        eventType = "RETURN_INSPECTION_DAMAGED";

        await client.query(`
          UPDATE assets
          SET 
            status = 'DAMAGED',
            assigned_employee_id = NULL,
            condition = COALESCE($2, condition)
          WHERE id = $1
        `, [asset.id, input.condition || "DAMAGED"]);

        // Auto-generate Damage Inspection Record
        const dmgRand = crypto.randomBytes(3).toString("hex").toUpperCase();
        const dmgCode = `DMG-${new Date().getFullYear()}-${dmgRand}`;

        await client.query(`
          INSERT INTO damage_inspections (
            inspection_code,
            asset_id,
            return_id,
            company_id,
            inspector_id,
            damage_type,
            severity,
            description,
            recommendation,
            status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING_DECISION')
        `, [
          dmgCode,
          asset.id,
          returnRecord.id,
          asset.company_id,
          user.id,
          input.damageType || "PHYSICAL_IMPACT",
          input.damageSeverity || "MODERATE",
          input.damageDescription || input.inspectionNotes || "Damage detected during return inspection",
          input.repairRecommendation || "REPAIR"
        ]);
      }

      // 4. Update Return Record
      await returnsRepository.updateInspection(returnRecord.id, {
        inspectionStatus: input.inspectionStatus,
        inspectedBy: user.id,
        condition: input.condition || returnRecord.condition,
        functionalStatus: input.functionalStatus,
        missingAccessories: input.missingAccessories,
        missingComponents: input.missingComponents,
        inspectionNotes: input.inspectionNotes,
        destinationStatus: targetDestinationStatus
      }, client);

      // 5. Immutable History
      await client.query(`
        INSERT INTO asset_history (
          asset_id, company_id, event_type, from_state, to_state, entity_affected, performed_by, details_json
        ) VALUES ($1, $2, $3, 'RETURNED', $4, 'asset_returns', $5, $6::jsonb)
      `, [
        asset.id,
        asset.company_id,
        eventType,
        targetAssetStatus,
        user.id,
        JSON.stringify({
          returnId: returnRecord.id,
          inspectionStatus: input.inspectionStatus,
          notes: input.inspectionNotes
        })
      ]);

      // 6. Audit Log
      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, new_values_json
        ) VALUES ($1, $2, 'ASSET_RETURN_INSPECTED', 'asset_returns', $3, $4::jsonb)
      `, [
        asset.company_id,
        user.id,
        returnRecord.id,
        JSON.stringify({
          returnId: returnRecord.id,
          inspectionStatus: input.inspectionStatus,
          destinationStatus: targetDestinationStatus
        })
      ]);

      const fullDetails = await returnsRepository.findById(returnRecord.id, client);
      return fullDetails!;
    });
  }

  async getReturnById(id: string, user: AuthUser): Promise<ReturnWithDetails> {
    const returnRecord = await returnsRepository.findById(id);
    if (!returnRecord) {
      throw new NotFoundError(`Return '${id}' not found`);
    }

    assertCompanyAccess(user, returnRecord.company_id);
    assertOwnershipAccess(user, returnRecord.returned_by);

    return returnRecord;
  }

  async listReturns(options: ListReturnsOptions, user: AuthUser): Promise<{ returns: ReturnWithDetails[]; total: number }> {
    const filterOptions: ListReturnsOptions = { ...options };

    if (!user.isCommonAdmin) {
      filterOptions.companyId = user.companyId!;
      if (user.roleCode === "EMPLOYEE") {
        if (!user.employeeId) {
          return { returns: [], total: 0 };
        }
        filterOptions.returnedBy = user.employeeId;
      }
    }

    return await returnsRepository.list(filterOptions);
  }
}

export const returnsService = new ReturnsService();