import crypto from "crypto";
import { withTransaction } from "../../config/database";
import { 
  damageInspectionsRepository, 
  DamageInspectionWithDetails, 
  ListDamageInspectionsOptions 
} from "./damage-inspections.repository";
import { AuthUser } from "../../middleware/auth.middleware";
import { assertCompanyAccess } from "../../middleware/tenant.middleware";
import { NotFoundError, ValidationError, ForbiddenError } from "../../utils/errors";

export interface RecordDamageInspectionInput {
  assetId: string;
  returnId?: string | null;
  damageType: string;
  severity: "MINOR" | "MODERATE" | "MAJOR" | "CRITICAL";
  description: string;
  estimatedRepairCost?: number;
  recommendation: "REPAIR" | "REPLACE_PARTS" | "SCRAP_RECOMMENDED" | "INSURANCE_CLAIM";
}

export interface ResolveDamageDecisionInput {
  decision: "APPROVE_REPAIR" | "ESCALATE_DISPOSAL" | "RESOLVE" | "CLOSE";
  resolutionNotes?: string | null;
  restorationCondition?: string | null;
}

export class DamageInspectionsService {
  async recordInspection(input: RecordDamageInspectionInput, user: AuthUser): Promise<DamageInspectionWithDetails> {
    if (!input.assetId || !input.damageType || !input.severity || !input.description || !input.recommendation) {
      throw new ValidationError("Asset ID, damage type, severity, description, and recommendation are required");
    }

    if (user.roleCode === "AUDITOR") {
      throw new ForbiddenError("Auditors cannot record damage inspections");
    }

    return await withTransaction(async (client) => {
      // 1. Lock asset
      const assetRes = await client.query(`
        SELECT id, company_id, status, condition FROM assets WHERE id = $1 FOR UPDATE
      `, [input.assetId]);

      if (assetRes.rows.length === 0) {
        throw new NotFoundError(`Asset '${input.assetId}' not found`);
      }
      const asset = assetRes.rows[0];

      assertCompanyAccess(user, asset.company_id);

      // 2. Generate unique inspection code
      const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
      const inspectionCode = `DMG-${new Date().getFullYear()}-${rand}`;

      // 3. Create inspection record
      const inspection = await damageInspectionsRepository.create({
        inspectionCode,
        assetId: asset.id,
        returnId: input.returnId || null,
        companyId: asset.company_id,
        inspectorId: user.id,
        damageType: input.damageType,
        severity: input.severity,
        description: input.description,
        estimatedRepairCost: input.estimatedRepairCost || 0.00,
        recommendation: input.recommendation,
        status: "PENDING_DECISION"
      }, client);

      // 4. Update asset status to DAMAGED
      await client.query(`
        UPDATE assets
        SET status = 'DAMAGED', condition = 'DAMAGED'
        WHERE id = $1
      `, [asset.id]);

      // 5. Immutable History
      await client.query(`
        INSERT INTO asset_history (
          asset_id, company_id, event_type, from_state, to_state, entity_affected, performed_by, details_json
        ) VALUES ($1, $2, 'DAMAGE_INSPECTION_RECORDED', $3, 'DAMAGED', 'damage_inspections', $4, $5::jsonb)
      `, [
        asset.id,
        asset.company_id,
        asset.status,
        user.id,
        JSON.stringify({
          inspectionId: inspection.id,
          inspectionCode,
          severity: input.severity,
          estimatedRepairCost: input.estimatedRepairCost
        })
      ]);

      // 6. Audit Log
      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, new_values_json
        ) VALUES ($1, $2, 'DAMAGE_INSPECTION_CREATED', 'damage_inspections', $3, $4::jsonb)
      `, [
        asset.company_id,
        user.id,
        inspection.id,
        JSON.stringify(inspection)
      ]);

      const fullDetails = await damageInspectionsRepository.findById(inspection.id, client);
      return fullDetails!;
    });
  }

  async resolveDecision(id: string, input: ResolveDamageDecisionInput, user: AuthUser): Promise<DamageInspectionWithDetails> {
    if (!input.decision) {
      throw new ValidationError("Decision is required ('APPROVE_REPAIR', 'ESCALATE_DISPOSAL', 'RESOLVE', 'CLOSE')");
    }

    if (user.roleCode === "AUDITOR") {
      throw new ForbiddenError("Auditors cannot resolve damage decisions");
    }

    return await withTransaction(async (client) => {
      // 1. Lock inspection
      const inspRes = await client.query(`
        SELECT * FROM damage_inspections WHERE id = $1 FOR UPDATE
      `, [id]);

      if (inspRes.rows.length === 0) {
        throw new NotFoundError(`Damage inspection '${id}' not found`);
      }
      const inspection = inspRes.rows[0];

      assertCompanyAccess(user, inspection.company_id);

      // 2. Lock asset
      const assetRes = await client.query(`
        SELECT id, company_id, status FROM assets WHERE id = $1 FOR UPDATE
      `, [inspection.asset_id]);
      const asset = assetRes.rows[0];

      let targetInspectionStatus: "PENDING_DECISION" | "APPROVED_FOR_REPAIR" | "ESCALATED_DISPOSAL" | "RESOLVED" | "CLOSED" = "PENDING_DECISION";

      if (input.decision === "APPROVE_REPAIR") {
        targetInspectionStatus = "APPROVED_FOR_REPAIR";

        // Auto-generate Maintenance Work Order
        const woRand = crypto.randomBytes(3).toString("hex").toUpperCase();
        const woNumber = `WO-${new Date().getFullYear()}-${woRand}`;
        const maintCode = `MNT-${new Date().getFullYear()}-${woRand}`;
        const priority = inspection.severity === "CRITICAL" ? "CRITICAL" : (inspection.severity === "MAJOR" ? "HIGH" : "MEDIUM");

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
            estimated_cost,
            status,
            inspection_id,
            description
          ) VALUES ($1, $2, $3, $4, $5, $6, 'CORRECTIVE', $7, $8, 'OPEN', $9, $10)
        `, [
          maintCode,
          woNumber,
          asset.id,
          asset.company_id,
          `Repair approved from damage inspection ${inspection.inspection_code}`,
          user.id,
          priority,
          inspection.estimated_repair_cost,
          inspection.id,
          input.resolutionNotes || `Damage resolution approved for repair. Details: ${inspection.description}`
        ]);

        // Move asset to UNDER_MAINTENANCE
        await client.query(`
          UPDATE assets SET status = 'UNDER_MAINTENANCE' WHERE id = $1
        `, [asset.id]);

        await client.query(`
          INSERT INTO asset_history (
            asset_id, company_id, event_type, from_state, to_state, entity_affected, performed_by, details_json
          ) VALUES ($1, $2, 'DAMAGE_APPROVED_FOR_REPAIR', 'DAMAGED', 'UNDER_MAINTENANCE', 'damage_inspections', $3, $4::jsonb)
        `, [
          asset.id,
          asset.company_id,
          user.id,
          JSON.stringify({ inspectionId: id, workOrderNumber: woNumber })
        ]);

      } else if (input.decision === "ESCALATE_DISPOSAL") {
        targetInspectionStatus = "ESCALATED_DISPOSAL";

        await client.query(`
          INSERT INTO asset_history (
            asset_id, company_id, event_type, from_state, to_state, entity_affected, performed_by, details_json
          ) VALUES ($1, $2, 'DAMAGE_ESCALATED_DISPOSAL', 'DAMAGED', 'DAMAGED', 'damage_inspections', $3, $4::jsonb)
        `, [
          asset.id,
          asset.company_id,
          user.id,
          JSON.stringify({ inspectionId: id, notes: input.resolutionNotes })
        ]);

      } else if (input.decision === "RESOLVE") {
        targetInspectionStatus = "RESOLVED";

        // Restore asset to AVAILABLE if requested
        const targetCondition = input.restorationCondition || "FAIR";
        await client.query(`
          UPDATE assets SET status = 'AVAILABLE', condition = $2 WHERE id = $1
        `, [asset.id, targetCondition]);

        await client.query(`
          INSERT INTO asset_history (
            asset_id, company_id, event_type, from_state, to_state, entity_affected, performed_by, details_json
          ) VALUES ($1, $2, 'DAMAGE_RESOLVED', 'DAMAGED', 'AVAILABLE', 'damage_inspections', $3, $4::jsonb)
        `, [
          asset.id,
          asset.company_id,
          user.id,
          JSON.stringify({ inspectionId: id, notes: input.resolutionNotes, restoredCondition: targetCondition })
        ]);

      } else if (input.decision === "CLOSE") {
        targetInspectionStatus = "CLOSED";
      }

      // Update inspection status
      await damageInspectionsRepository.updateDecision(inspection.id, {
        status: targetInspectionStatus,
        resolutionNotes: input.resolutionNotes || null
      }, client);

      // Audit Log
      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, new_values_json
        ) VALUES ($1, $2, 'DAMAGE_INSPECTION_DECISION_RESOLVED', 'damage_inspections', $3, $4::jsonb)
      `, [
        asset.company_id,
        user.id,
        inspection.id,
        JSON.stringify({ decision: input.decision, status: targetInspectionStatus })
      ]);

      const fullDetails = await damageInspectionsRepository.findById(inspection.id, client);
      return fullDetails!;
    });
  }

  async getInspectionById(id: string, user: AuthUser): Promise<DamageInspectionWithDetails> {
    const inspection = await damageInspectionsRepository.findById(id);
    if (!inspection) {
      throw new NotFoundError(`Damage inspection '${id}' not found`);
    }

    assertCompanyAccess(user, inspection.company_id);
    return inspection;
  }

  async listInspections(options: ListDamageInspectionsOptions, user: AuthUser): Promise<{ inspections: DamageInspectionWithDetails[]; total: number }> {
    const filterOptions: ListDamageInspectionsOptions = { ...options };

    if (!user.isCommonAdmin) {
      filterOptions.companyId = user.companyId!;
    }

    return await damageInspectionsRepository.list(filterOptions);
  }
}

export const damageInspectionsService = new DamageInspectionsService();