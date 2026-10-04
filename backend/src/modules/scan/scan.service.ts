import crypto from "crypto";
import { scanRepository, ResolvedAssetRow, ActiveTransferRow, ScanEventRow } from "./scan.repository";
import { qrService, QrService, QrGenerationResult, BarcodeGenerationResult, PrintableLabelResult } from "./qr.service";
import { AuthUser } from "../../middleware/auth.middleware";
import { assertCompanyAccess } from "../../middleware/tenant.middleware";
import { NotFoundError, ForbiddenError, ValidationError } from "../../utils/errors";
import { query } from "../../config/database";
import { notificationService } from "../notifications/notification.service";

async function logAuditEvent(companyId: string, userId: string, action: string, entityId: string | null, details: Record<string, unknown>): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity, entity_id, new_values_json) VALUES ($1, $2, $3, 'assets', $4, $5::jsonb)`,
      [companyId, userId, action, entityId, JSON.stringify(details)]
    );
  } catch {
    // Non-blocking audit failure
  }
}

export interface AllowedAction {
  action: string;
  label: string;
  description: string;
  route: string;
  method?: "GET" | "POST" | "PUT" | "PATCH";
  isPrimary?: boolean;
}

export interface ScanResolutionResponse {
  assetId: string;
  assetTag: string;
  name: string;
  category: string;
  categoryCode: string;
  serialNumber: string | null;
  modelNumber: string | null;
  company: {
    id: string;
    name: string;
    code: string;
  };
  branch: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  department: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  location: {
    id: string;
    building: string | null;
    floor: string | null;
    room: string | null;
  } | null;
  condition: string;
  status: string;
  custodian: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  valuation: {
    currentBookValue: number;
    purchaseCost: number;
  };
  maintenanceState: {
    isUnderMaintenance: boolean;
    activeWorkOrders: number;
  };
  transferState: {
    isInTransit: boolean;
    activeTransfer: {
      id: string;
      code: string;
      status: string;
      fromCompanyId: string;
      toCompanyId: string;
      dispatchedAt: string | null;
    } | null;
  };
  lastScan: {
    scannedAt: string;
    scannedBy: string | null;
    scanType: string;
  } | null;
  allowedActions: AllowedAction[];
  scannedAt: string;
}

export class ScanService {
  /**
   * Resolves a machine-readable token (QR or Barcode) to an existing asset
   * and calculates context-aware allowed actions.
   */
  async resolveToken(
    token: string,
    user: AuthUser,
    scanType: "QR" | "BARCODE" | "MANUAL" = "QR",
    source: "WEB_CAMERA" | "MANUAL_ENTRY" | "HARDWARE_SCANNER" = "WEB_CAMERA",
    tenant?: { companyId: string | null; isGlobal?: boolean }
  ): Promise<ScanResolutionResponse> {
    if (!token || !token.trim()) {
      throw new ValidationError("Scan token or code is required");
    }

    const trimmedToken = token.trim();
    const asset = await scanRepository.resolveAsset(trimmedToken);

    if (!asset) {
      // Record failed scan event
      if (user.companyId || user.isCommonAdmin) {
        await scanRepository.recordScanEvent({
          companyId: user.companyId || null,
          assetId: null,
          scannedBy: user.id,
          scanType,
          scanValue: trimmedToken.slice(0, 100),
          source,
          isSuccess: false,
          failureReason: "Asset not found"
        });

        if (user.companyId) {
          await logAuditEvent(
            user.companyId,
            user.id,
            "ASSET_SCAN_FAILED",
            null,
            { scanValue: trimmedToken.slice(0, 100), reason: "Asset not found", scanType, source }
          );
        }
      }

      throw new NotFoundError(`Asset not found for code '${trimmedToken}'`);
    }

    const activeTransfer = await scanRepository.getActiveTransfer(asset.id);

    // Strict Multi-Tenant Authorization Check
    const effectiveCompanyId = tenant?.companyId !== undefined ? tenant.companyId : user.companyId;

    let isAuthorized = false;
    if (user.isCommonAdmin) {
      if (!effectiveCompanyId) {
        // Global Common Admin
        isAuthorized = true;
      } else {
        // Scoped Common Admin (matches sending company OR receiving company of in-transit transfer)
        isAuthorized = (effectiveCompanyId === asset.company_id) ||
          (asset.status === "IN_TRANSIT" && activeTransfer?.to_company_id === effectiveCompanyId);
      }
    } else {
      // Company User (matches sending company OR receiving company of in-transit transfer)
      isAuthorized = (user.companyId === asset.company_id) ||
        (asset.status === "IN_TRANSIT" && activeTransfer?.to_company_id === user.companyId);
    }

    if (!isAuthorized) {
      // Record cross-company violation
      await scanRepository.recordScanEvent({
        companyId: user.companyId || null,
        assetId: asset.id,
        scannedBy: user.id,
        scanType,
        scanValue: trimmedToken.slice(0, 100),
        source,
        isSuccess: false,
        failureReason: "Cross-company unauthorized scan"
      });

      if (user.companyId) {
        await logAuditEvent(
          user.companyId,
          user.id,
          "ASSET_SCAN_FAILED",
          asset.id,
          {
            reason: "Cross-company unauthorized scan attempt",
            assetTag: asset.asset_tag,
            scanType,
            source
          }
        );
      }

      // Security notification to asset's owning company
      if (asset.company_id) {
        await notificationService.notifyCompanyAdmins(asset.company_id, {
          notificationType: "ASSET_SCAN_SECURITY_ALERT",
          title: `Security Alert: Unauthorized Scan on ${asset.asset_tag}`,
          message: `User '${user.username}' attempted an unauthorized cross-company scan on asset '${asset.name}' (${asset.asset_tag}).`,
          severity: "CRITICAL",
          entityType: "assets",
          entityId: asset.id,
          actionUrl: `/assets/${asset.id}`,
          idempotencyKey: `SCAN_ALERT:${asset.id}:${user.id}:${new Date().toISOString().split("T")[0]}`
        });
      }

      throw new ForbiddenError("Cross-company violation. You do not have permission to access assets from this company.");
    }

    // Load remaining operational states
    const [activeMaintenanceCount, recentScans] = await Promise.all([
      scanRepository.getActiveMaintenanceCount(asset.id),
      scanRepository.listAssetScans(asset.id, 1)
    ]);

    // Compute Context-Aware Allowed Actions
    const allowedActions = this.calculateAllowedActions(asset, user, activeTransfer);

    // Record successful physical scan
    await scanRepository.recordScanEvent({
      companyId: asset.company_id,
      assetId: asset.id,
      scannedBy: user.id,
      scanType,
      scanValue: trimmedToken.slice(0, 100),
      source,
      isSuccess: true,
      metadata: {
        status: asset.status,
        condition: asset.condition,
        assetTag: asset.asset_tag
      }
    });

    // Write audit event
    await logAuditEvent(
      asset.company_id,
      user.id,
      "ASSET_SCAN_SUCCESS",
      asset.id,
      {
        assetTag: asset.asset_tag,
        scanType,
        source,
        operationalStatus: asset.status
      }
    );

    const lastScan = recentScans[0]
      ? {
          scannedAt: recentScans[0].scanned_at,
          scannedBy: recentScans[0].scanned_by_name || recentScans[0].scanned_by_username || null,
          scanType: recentScans[0].scan_type
        }
      : null;

    return {
      assetId: asset.id,
      assetTag: asset.asset_tag,
      name: asset.name,
      category: asset.category_name,
      categoryCode: asset.category_code,
      serialNumber: asset.serial_number,
      modelNumber: asset.model_number,
      company: {
        id: asset.company_id,
        name: asset.company_name,
        code: asset.company_code
      },
      branch: asset.branch_id
        ? { id: asset.branch_id, name: asset.branch_name || "Branch", code: asset.branch_code }
        : null,
      department: asset.department_id
        ? { id: asset.department_id, name: asset.department_name || "Department", code: asset.department_code }
        : null,
      location: asset.location_id
        ? {
            id: asset.location_id,
            building: asset.location_building,
            floor: asset.location_floor,
            room: asset.location_room
          }
        : null,
      condition: asset.condition,
      status: asset.status,
      custodian: asset.assigned_employee_id
        ? {
            id: asset.assigned_employee_id,
            name: [asset.employee_first_name, asset.employee_last_name].filter(Boolean).join(" ") || "Employee",
            code: asset.employee_code
          }
        : null,
      valuation: {
        currentBookValue: parseFloat((asset.current_value as string) || "0"),
        purchaseCost: parseFloat((asset.purchase_cost as string) || "0")
      },
      maintenanceState: {
        isUnderMaintenance: asset.status === "UNDER_MAINTENANCE",
        activeWorkOrders: activeMaintenanceCount
      },
      transferState: {
        isInTransit: asset.status === "IN_TRANSIT",
        activeTransfer: activeTransfer
          ? {
              id: activeTransfer.id,
              code: activeTransfer.transfer_code,
              status: activeTransfer.status,
              fromCompanyId: activeTransfer.from_company_id,
              toCompanyId: activeTransfer.to_company_id,
              dispatchedAt: activeTransfer.dispatched_at
            }
          : null
      },
      lastScan,
      allowedActions,
      scannedAt: new Date().toISOString()
    };
  }

  /**
   * Calculates dynamic operational actions based on asset state and user permissions
   */
  private calculateAllowedActions(
    asset: ResolvedAssetRow,
    user: AuthUser,
    activeTransfer: ActiveTransferRow | null
  ): AllowedAction[] {
    const actions: AllowedAction[] = [];
    const perms = new Set(user.permissions || []);
    const isAuditor = user.roleCode === "AUDITOR";

    // View action is always authorized
    actions.push({
      action: "view",
      label: "View Asset Record",
      description: "Open the comprehensive asset profile and lifecycle history",
      route: `/assets/${asset.id}`,
      method: "GET"
    });

    if (isAuditor) {
      return actions; // Auditor is strictly read-only
    }

    const status = asset.status;

    // 1. AVAILABLE or IN_STOCK
    if (status === "AVAILABLE" || status === "IN_STOCK") {
      if (perms.has("assignments:assign") || perms.has("assignments:create") || user.isCommonAdmin) {
        actions.push({
          action: "assign",
          label: "Assign Custody",
          description: "Allocate this asset to an employee with physical handover protocol",
          route: `/assignments?assetId=${asset.id}`,
          isPrimary: true
        });
      }
      if ((user.roleCode !== "EMPLOYEE") && (perms.has("transfers:create") || user.isCommonAdmin)) {
        actions.push({
          action: "transfer",
          label: "Initiate Transfer",
          description: "Relocate or transfer asset custody to another department or company",
          route: `/transfers?assetId=${asset.id}`
        });
      }
      if (perms.has("maintenance:log") || perms.has("maintenance:manage") || perms.has("maintenance:create") || user.isCommonAdmin) {
        actions.push({
          action: "maintenance",
          label: "Schedule Maintenance",
          description: "Create a preventative or corrective maintenance work order",
          route: `/maintenance?assetId=${asset.id}`
        });
      }
    }

    // 2. ASSIGNED
    else if (status === "ASSIGNED") {
      actions.push({
        action: "custody",
        label: "View Custody Record",
        description: "Inspect active assignment, custodian acknowledgment, and handover verification",
        route: `/assets/${asset.id}?tab=custody`
      });

      if (perms.has("assignments:return") || perms.has("returns:create") || user.isCommonAdmin) {
        actions.push({
          action: "return",
          label: "Process Return",
          description: "Initiate return and condition check-in inspection",
          route: `/returns?assetId=${asset.id}`,
          isPrimary: true
        });
      }

      if ((user.roleCode !== "EMPLOYEE") && (perms.has("transfers:create") || user.isCommonAdmin)) {
        actions.push({
          action: "transfer",
          label: "Transfer Asset",
          description: "Transfer operational custody to a new employee or department",
          route: `/transfers?assetId=${asset.id}`
        });
      }
    }

    // 3. UNDER_MAINTENANCE
    else if (status === "UNDER_MAINTENANCE") {
      actions.push({
        action: "work_order",
        label: "View Active Work Order",
        description: "Inspect ongoing maintenance tasks, spare parts, and technician updates",
        route: `/maintenance?assetId=${asset.id}`,
        isPrimary: true
      });

      if (perms.has("maintenance:manage") || perms.has("maintenance:edit") || user.isCommonAdmin) {
        actions.push({
          action: "update_maintenance",
          label: "Update Work Order Status",
          description: "Record repairs, advance progress, or request completion inspection",
          route: `/maintenance?assetId=${asset.id}`
        });
      }
    }

    // 4. IN_TRANSIT
    else if (status === "IN_TRANSIT") {
      actions.push({
        action: "transfer_details",
        label: "View Transfer Logistics",
        description: "Inspect origin, dispatch manifest, and transit tracking",
        route: activeTransfer ? `/transfers/${activeTransfer.id}` : `/transfers?assetId=${asset.id}`
      });

      // Destination administrator receipt confirmation (Dual-Authorization Protocol)
      const isDestinationAdmin =
        user.isCommonAdmin ||
        (activeTransfer && activeTransfer.to_company_id === user.companyId);

      if (isDestinationAdmin && (perms.has("transfers:receive") || user.isCommonAdmin)) {
        actions.push({
          action: "confirm_receipt",
          label: "Confirm Physical Delivery & Accept Handover",
          description: "Dual-authorization receipt: re-homes asset and completes physical transfer",
          route: activeTransfer ? `/transfers/${activeTransfer.id}?action=receive` : `/transfers`,
          isPrimary: true
        });

        if (perms.has("transfers:dispute") || user.isCommonAdmin) {
          actions.push({
            action: "dispute",
            label: "Flag Discrepancy / Dispute Delivery",
            description: "Quarantine asset due to physical transit damage or specification mismatch",
            route: activeTransfer ? `/transfers/${activeTransfer.id}?action=dispute` : `/transfers`
          });
        }
      }
    }

    // 5. DAMAGED
    else if (status === "DAMAGED") {
      actions.push({
        action: "damage_inspection",
        label: "View Damage Inspection",
        description: "Inspect documented damage report, photos, and severity classification",
        route: `/damage-inspections?assetId=${asset.id}`,
        isPrimary: true
      });

      if (perms.has("maintenance:manage") || perms.has("maintenance:log") || perms.has("maintenance:create") || user.isCommonAdmin) {
        actions.push({
          action: "resolve_damage",
          label: "Create Repair Work Order",
          description: "Schedule corrective maintenance triage for damaged asset",
          route: `/maintenance?assetId=${asset.id}`
        });
      }
    }

    // 6. RETURNED
    else if (status === "RETURNED") {
      actions.push({
        action: "inspect_return",
        label: "Inspect Returned Asset",
        description: "Perform physical intake check-in and condition triage",
        route: `/returns?assetId=${asset.id}`,
        isPrimary: true
      });
    }

    // 7. DISPUTED
    else if (status === "DISPUTED") {
      actions.push({
        action: "dispute_details",
        label: "View Dispute Arbitration",
        description: "Inspect transfer dispute reason and management resolution status",
        route: activeTransfer ? `/transfers/${activeTransfer.id}` : `/transfers?assetId=${asset.id}`,
        isPrimary: true
      });

      if (user.isCommonAdmin || perms.has("transfers:dispute")) {
        actions.push({
          action: "resolve_dispute",
          label: "Resolve & Reconcile Dispute",
          description: "Execute executive arbitration or return to sending facility",
          route: activeTransfer ? `/transfers/${activeTransfer.id}` : `/transfers`
        });
      }
    }

    // 8. RETIRED or DISPOSED
    else if (status === "RETIRED" || status === "DISPOSED") {
      // Only view is allowed
    }

    return actions;
  }

  /**
   * Generates QR preview, SVG, and canonical payload for an asset
   */
  async getAssetQr(assetId: string, user: AuthUser): Promise<QrGenerationResult> {
    const asset = await scanRepository.resolveAsset(assetId);
    if (!asset) {
      throw new NotFoundError(`Asset with ID '${assetId}' not found`);
    }
    assertCompanyAccess(user, asset.company_id);

    const canonicalPayload = QrService.formatCanonicalPayload(asset.id);
    return qrService.generateQr(canonicalPayload);
  }

  /**
   * Regenerates visual QR code without changing asset identity
   */
  async regenerateQr(assetId: string, user: AuthUser): Promise<QrGenerationResult> {
    const asset = await scanRepository.resolveAsset(assetId);
    if (!asset) {
      throw new NotFoundError(`Asset with ID '${assetId}' not found`);
    }
    assertCompanyAccess(user, asset.company_id);

    const newSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
    const newQrCode = `QR-${asset.asset_tag}-${newSuffix}`;

    await scanRepository.updateQrCode(asset.id, newQrCode);

    await logAuditEvent(
      asset.company_id,
      user.id,
      "ASSET_QR_REGENERATED",
      asset.id,
      {
        assetTag: asset.asset_tag,
        previousQrCode: asset.qr_code,
        newQrCode
      }
    );

    const canonicalPayload = QrService.formatCanonicalPayload(asset.id);
    return qrService.generateQr(canonicalPayload);
  }

  /**
   * Generates Code 128 linear barcode for an asset
   */
  async getAssetBarcode(assetId: string, user: AuthUser): Promise<BarcodeGenerationResult> {
    const asset = await scanRepository.resolveAsset(assetId);
    if (!asset) {
      throw new NotFoundError(`Asset with ID '${assetId}' not found`);
    }
    assertCompanyAccess(user, asset.company_id);

    return qrService.generateBarcode(asset.asset_tag);
  }

  /**
   * Generates printable single asset label dataset
   */
  async printLabel(assetId: string, user: AuthUser): Promise<PrintableLabelResult> {
    const asset = await scanRepository.resolveAsset(assetId);
    if (!asset) {
      throw new NotFoundError(`Asset with ID '${assetId}' not found`);
    }
    assertCompanyAccess(user, asset.company_id);

    const label = await qrService.generatePrintableLabel({
      assetId: asset.id,
      assetTag: asset.asset_tag,
      barcode: asset.barcode,
      qrCode: asset.qr_code,
      name: asset.name,
      companyName: asset.company_name,
      companyCode: asset.company_code,
      categoryName: asset.category_name,
      categoryCode: asset.category_code,
      serialNumber: asset.serial_number,
      modelNumber: asset.model_number
    });

    await logAuditEvent(
      asset.company_id,
      user.id,
      "ASSET_LABEL_PRINTED",
      asset.id,
      {
        assetTag: asset.asset_tag,
        printedBy: user.username
      }
    );

    return label;
  }

  /**
   * Generates batch printable labels for multiple assets
   */
  async getBatchLabels(assetIds: string[], user: AuthUser): Promise<PrintableLabelResult[]> {
    if (!assetIds || assetIds.length === 0) {
      throw new ValidationError("At least one asset ID is required for batch label generation");
    }

    const cappedIds = assetIds.slice(0, 50); // Safe batch ceiling
    const labels: PrintableLabelResult[] = [];

    for (const id of cappedIds) {
      const asset = await scanRepository.resolveAsset(id);
      if (asset) {
        try {
          assertCompanyAccess(user, asset.company_id);
          const label = await qrService.generatePrintableLabel({
            assetId: asset.id,
            assetTag: asset.asset_tag,
            barcode: asset.barcode,
            qrCode: asset.qr_code,
            name: asset.name,
            companyName: asset.company_name,
            companyCode: asset.company_code,
            categoryName: asset.category_name,
            categoryCode: asset.category_code,
            serialNumber: asset.serial_number,
            modelNumber: asset.model_number
          });
          labels.push(label);
        } catch {
          // Skip assets that user cannot access
        }
      }
    }

    if (labels.length > 0 && user.companyId) {
      await logAuditEvent(
        user.companyId,
        user.id,
        "ASSET_LABEL_PRINTED",
        null,
        {
          batchCount: labels.length,
          assetTags: labels.map((l) => l.assetTag)
        }
      );
    }

    return labels;
  }

  /**
   * Lists physical scan events for an asset
   */
  async listAssetScans(assetId: string, user: AuthUser): Promise<ScanEventRow[]> {
    const asset = await scanRepository.resolveAsset(assetId);
    if (!asset) {
      throw new NotFoundError(`Asset with ID '${assetId}' not found`);
    }
    assertCompanyAccess(user, asset.company_id);

    return scanRepository.listAssetScans(assetId);
  }

  /**
   * Lists paginated scan events for authorized company
   */
  async listScans(
    user: AuthUser,
    options: {
      scanType?: string;
      source?: string;
      isSuccess?: boolean;
      page?: number;
      limit?: number;
    }
  ): Promise<{ scans: ScanEventRow[]; total: number }> {
    const companyId = user.isCommonAdmin ? undefined : user.companyId;
    return scanRepository.listScans({
      ...options,
      companyId
    });
  }
}

export const scanService = new ScanService();
