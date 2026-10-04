import { withTransaction, query } from "../../config/database";
import { AuthUser } from "../../middleware/auth.middleware";
import { assertCompanyAccess } from "../../middleware/tenant.middleware";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../utils/errors";
import {
  stockRepository,
  StockItemWithDetails,
  StockMovementRow,
  StockMovementWithDetails,
  CreateStockItemData,
  UpdateStockItemData,
  ListStockOptions,
} from "./stock.repository";
import { notificationService } from "../notifications/notification.service";

export interface RecordMovementInput {
  movementType: "RECEIPT" | "ISSUE" | "RETURN" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "TRANSFER" | "DAMAGE" | "SCRAP";
  quantity: number;
  unitCost?: number;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
}

export class StockService {
  async createStockItem(input: CreateStockItemData, user: AuthUser): Promise<StockItemWithDetails> {
    const targetCompanyId = user.isCommonAdmin
      ? (input.companyId || user.companyId)
      : user.companyId!;

    if (!targetCompanyId) {
      throw new ValidationError("Company ID is required to register stock item");
    }

    assertCompanyAccess(user, targetCompanyId);

    if (!input.stockCode || !input.stockCode.trim()) {
      throw new ValidationError("Stock code is required");
    }
    if (!input.itemName || !input.itemName.trim()) {
      throw new ValidationError("Item name is required");
    }

    const existing = await stockRepository.findByStockCode(targetCompanyId, input.stockCode.trim());
    if (existing) {
      throw new ConflictError(`Stock code '${input.stockCode}' already exists in this company`);
    }

    const initialQuantity = input.quantityOnHand !== undefined ? input.quantityOnHand : 0;
    if (initialQuantity < 0) {
      throw new ValidationError("Quantity on hand cannot be negative");
    }

    return await withTransaction(async (client) => {
      const item = await stockRepository.create({
        ...input,
        companyId: targetCompanyId,
        stockCode: input.stockCode.trim().toUpperCase(),
        itemName: input.itemName.trim(),
        quantityOnHand: initialQuantity,
      }, client);

      // Record initial RECEIPT movement if initial quantity > 0
      if (initialQuantity > 0) {
        await stockRepository.recordMovement({
          companyId: targetCompanyId,
          stockItemId: item.id,
          movementType: "RECEIPT",
          quantity: initialQuantity,
          unitCost: item.unit_cost,
          balanceBefore: 0,
          balanceAfter: initialQuantity,
          toLocationId: item.location_id,
          performedBy: user.id,
          referenceType: "INITIAL_STOCK",
          notes: "Initial inventory setup receipt",
        }, client);
      }

      // Audit Log
      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, new_values_json
        ) VALUES ($1, $2, 'STOCK_CREATED', 'stock_items', $3, $4::jsonb);
      `, [
        targetCompanyId,
        user.id,
        item.id,
        JSON.stringify({
          stockCode: item.stock_code,
          itemName: item.item_name,
          quantityOnHand: item.quantity_on_hand,
          unitCost: item.unit_cost
        })
      ]);

      const fullItem = await stockRepository.findById(item.id, client);
      return fullItem!;
    });
  }

  async updateStockItem(id: string, input: UpdateStockItemData, user: AuthUser): Promise<StockItemWithDetails> {
    const existing = await stockRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Stock item '${id}' not found`);
    }

    assertCompanyAccess(user, existing.company_id);

    const updated = await stockRepository.update(id, input);

    await query(`
      INSERT INTO audit_logs (
        company_id, user_id, action, entity, entity_id, old_values_json, new_values_json
      ) VALUES ($1, $2, 'STOCK_UPDATED', 'stock_items', $3, $4::jsonb, $5::jsonb);
    `, [
      existing.company_id,
      user.id,
      id,
      JSON.stringify(existing),
      JSON.stringify(updated)
    ]);

    const fullItem = await stockRepository.findById(id);
    return fullItem!;
  }

  async updateStockStatus(id: string, isActive: boolean, user: AuthUser): Promise<StockItemWithDetails> {
    const existing = await stockRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Stock item '${id}' not found`);
    }

    assertCompanyAccess(user, existing.company_id);

    await stockRepository.updateStatus(id, isActive);

    const fullItem = await stockRepository.findById(id);
    return fullItem!;
  }

  async getStockItemById(id: string, user: AuthUser): Promise<StockItemWithDetails> {
    const item = await stockRepository.findById(id);
    if (!item) {
      throw new NotFoundError(`Stock item '${id}' not found`);
    }

    assertCompanyAccess(user, item.company_id);
    return item;
  }

  async listStockItems(options: ListStockOptions, user: AuthUser): Promise<{ items: StockItemWithDetails[]; total: number; page: number; limit: number; totalPages: number }> {
    const targetCompanyId = user.isCommonAdmin
      ? (options.companyId || null)
      : user.companyId!;

    return await stockRepository.list({
      ...options,
      companyId: targetCompanyId
    });
  }

  async recordMovement(
    stockItemId: string,
    input: RecordMovementInput,
    user: AuthUser
  ): Promise<StockMovementRow & { movement: StockMovementRow; stockItem: StockItemWithDetails | null }> {
    if (!input.movementType) {
      throw new ValidationError("Movement type is required");
    }
    if (!input.quantity || input.quantity <= 0) {
      throw new ValidationError("Movement quantity must be greater than zero");
    }

    return await withTransaction(async (client) => {
      // 1. Lock stock item row to guarantee strict concurrency protection
      const item = await stockRepository.findWithLock(stockItemId, client);
      if (!item) {
        throw new NotFoundError(`Stock item '${stockItemId}' not found`);
      }

      assertCompanyAccess(user, item.company_id);

      if (!item.is_active) {
        throw new BadRequestError(`Cannot record movement on inactive stock item '${item.stock_code}'`);
      }

      const balanceBefore = item.quantity_on_hand;
      let balanceAfter = balanceBefore;

      switch (input.movementType) {
        case "RECEIPT":
        case "RETURN":
        case "ADJUSTMENT_IN":
          balanceAfter = balanceBefore + input.quantity;
          break;

        case "ISSUE":
        case "ADJUSTMENT_OUT":
        case "DAMAGE":
        case "SCRAP":
          if (balanceBefore < input.quantity) {
            throw new BadRequestError(
              `Insufficient stock for item '${item.stock_code}': Available quantity is ${balanceBefore}, requested ${input.quantity}`
            );
          }
          balanceAfter = balanceBefore - input.quantity;
          break;

        case "TRANSFER":
          // Location rebalance within company stock; total on-hand remains constant
          balanceAfter = balanceBefore;
          break;

        default:
          throw new ValidationError(`Unsupported movement type '${input.movementType}'`);
      }

      // 2. Update stock quantity
      await stockRepository.updateQuantity(stockItemId, balanceAfter, client);

      // 3. Record movement record
      const movement = await stockRepository.recordMovement({
        companyId: item.company_id,
        stockItemId: item.id,
        movementType: input.movementType,
        quantity: input.quantity,
        unitCost: input.unitCost !== undefined ? input.unitCost : item.unit_cost,
        balanceBefore,
        balanceAfter,
        fromLocationId: input.fromLocationId || item.location_id,
        toLocationId: input.toLocationId || item.location_id,
        performedBy: user.id,
        referenceType: input.referenceType || "MANUAL_MOVEMENT",
        referenceId: input.referenceId || null,
        notes: input.notes || null,
      }, client);

      // 4. Audit Log
      const auditAction = input.movementType.startsWith("ADJUSTMENT") 
        ? "STOCK_ADJUSTED" 
        : "STOCK_MOVEMENT_CREATED";

      await client.query(`
        INSERT INTO audit_logs (
          company_id, user_id, action, entity, entity_id, new_values_json
        ) VALUES ($1, $2, $3, 'stock_movements', $4, $5::jsonb);
      `, [
        item.company_id,
        user.id,
        auditAction,
        movement.id,
        JSON.stringify({
          stockCode: item.stock_code,
          movementType: input.movementType,
          quantity: input.quantity,
          balanceBefore,
          balanceAfter,
          notes: input.notes
        })
      ]);

      // 5. Stock alert check (STOCK_OUT vs STOCK_LOW)
      if (balanceAfter <= 0) {
        await notificationService.notifyRole(
          item.company_id,
          "ASSET_MANAGER",
          {
            notificationType: "STOCK_OUT",
            title: `CRITICAL: Stock Out - ${item.stock_code}`,
            message: `Stock item '${item.item_name}' (${item.stock_code}) is completely depleted (0 ${item.unit}). Immediate replenishment required.`,
            severity: "CRITICAL",
            type: "ALERT",
            entityType: "stock_items",
            entityId: item.id,
            actionUrl: `/stock/${item.id}`,
            idempotencyKey: `STOCK_OUT:${item.id}:${new Date().toISOString().split("T")[0]}`
          },
          client
        );
      } else if (balanceAfter <= item.minimum_quantity || balanceAfter <= item.reorder_level) {
        await notificationService.notifyRole(
          item.company_id,
          "ASSET_MANAGER",
          {
            notificationType: "STOCK_LOW",
            title: `Low Stock Alert: ${item.stock_code}`,
            message: `Stock item '${item.item_name}' (${item.stock_code}) is down to ${balanceAfter} ${item.unit} (Min: ${item.minimum_quantity}, Reorder: ${item.reorder_level}).`,
            severity: "WARNING",
            type: "WARNING",
            entityType: "stock_items",
            entityId: item.id,
            actionUrl: `/stock/${item.id}`,
            idempotencyKey: `STOCK_LOW:${item.id}:${balanceAfter}`
          },
          client
        );
      }

      const updatedStockItem = await stockRepository.findById(stockItemId, client);
      return {
        ...movement,
        movement,
        stockItem: updatedStockItem,
      };
    });
  }

  async getMovements(stockItemId: string, options: { page?: number; limit?: number }, user: AuthUser): Promise<{ movements: StockMovementWithDetails[]; total: number }> {
    const item = await stockRepository.findById(stockItemId);
    if (!item) {
      throw new NotFoundError(`Stock item '${stockItemId}' not found`);
    }

    assertCompanyAccess(user, item.company_id);
    return await stockRepository.listMovements(stockItemId, options);
  }

  async getStockAlerts(companyId: string | null | undefined, user: AuthUser): Promise<StockItemWithDetails[]> {
    const targetCompanyId = user.isCommonAdmin
      ? (companyId || null)
      : user.companyId!;

    return await stockRepository.getAlerts(targetCompanyId);
  }
}

export const stockService = new StockService();
