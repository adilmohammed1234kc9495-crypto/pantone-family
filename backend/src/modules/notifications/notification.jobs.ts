import { query } from "../../config/database";
import { logger } from "../../config/logger";
import { notificationService } from "./notification.service";

export interface ScheduledJobResult {
  job: string;
  processed: number;
  alertsCreated: number;
  errors: number;
}

export class NotificationJobs {
  /**
   * Scans active asset assignments that have passed their expected return date.
   * Generates ASSET_RETURN_OVERDUE alerts with idempotency keys.
   */
  async checkOverdueReturns(): Promise<ScheduledJobResult> {
    const today = new Date().toISOString().split("T")[0];
    let alertsCreated = 0;
    let errors = 0;

    try {
      const sql = `
        SELECT 
          aa.id as assignment_id,
          aa.company_id,
          aa.asset_id,
          aa.employee_id,
          aa.return_due_date as expected_return_date,
          a.asset_tag,
          a.name as asset_name,
          e.first_name,
          e.last_name,
          e.employee_code
        FROM asset_assignments aa
        JOIN assets a ON aa.asset_id = a.id
        JOIN employees e ON aa.employee_id = e.id
        WHERE aa.status = 'ACTIVE' 
          AND aa.return_due_date IS NOT NULL
          AND aa.return_due_date < CURRENT_DATE
      `;

      const res = await query<{
        assignment_id: string;
        company_id: string;
        asset_id: string;
        employee_id: string;
        expected_return_date: string;
        asset_tag: string;
        asset_name: string;
        first_name: string;
        last_name: string;
        employee_code: string;
      }>(sql);

      for (const row of res.rows) {
        try {
          const empName = `${row.first_name} ${row.last_name}`.trim();
          const idempotencyKey = `RETURN_OVERDUE:${row.assignment_id}:${today}`;

          // Notify company asset managers
          const amCount = await notificationService.notifyRole(
            row.company_id,
            "ASSET_MANAGER",
            {
              notificationType: "ASSET_RETURN_OVERDUE",
              title: `Overdue Asset Return: ${row.asset_tag}`,
              message: `Asset '${row.asset_name}' (${row.asset_tag}) assigned to ${empName} was due on ${row.expected_return_date} and is overdue.`,
              severity: "CRITICAL",
              entityType: "asset_assignments",
              entityId: row.assignment_id,
              actionUrl: `/assets/${row.asset_id}`,
              idempotencyKey: `AM_${idempotencyKey}`,
              metadata: {
                assetId: row.asset_id,
                employeeId: row.employee_id,
                expectedReturnDate: row.expected_return_date
              }
            }
          );

          // Notify employee custodian
          const empCount = await notificationService.notifyEmployee(
            row.employee_id,
            {
              companyId: row.company_id,
              notificationType: "ASSET_RETURN_OVERDUE",
              title: `Action Required: Asset Return Overdue (${row.asset_tag})`,
              message: `Your assigned asset '${row.asset_name}' was scheduled to be returned by ${row.expected_return_date}. Please return it or contact Asset Management.`,
              severity: "CRITICAL",
              entityType: "asset_assignments",
              entityId: row.assignment_id,
              actionUrl: `/assets/${row.asset_id}`,
              idempotencyKey: `EMP_${idempotencyKey}`,
              metadata: {
                assetId: row.asset_id,
                expectedReturnDate: row.expected_return_date
              }
            }
          );

          if (amCount + empCount > 0) {
            alertsCreated += (amCount + empCount);
          }
        } catch (itemErr) {
          errors++;
          logger.error(`Error processing overdue return for assignment ${row.assignment_id}:`, itemErr);
        }
      }

      return {
        job: "checkOverdueReturns",
        processed: res.rows.length,
        alertsCreated,
        errors
      };
    } catch (err) {
      logger.error("checkOverdueReturns failed:", err);
      return {
        job: "checkOverdueReturns",
        processed: 0,
        alertsCreated: 0,
        errors: 1
      };
    }
  }

  /**
   * Scans stock items whose current quantity is at or below minimum threshold.
   * Generates STOCK_LOW or STOCK_OUT alerts with idempotency keys.
   */
  async checkLowStock(): Promise<ScheduledJobResult> {
    const today = new Date().toISOString().split("T")[0];
    let alertsCreated = 0;
    let errors = 0;

    try {
      const sql = `
        SELECT 
          id,
          company_id,
          stock_code,
          item_name,
          quantity_on_hand as current_stock,
          minimum_quantity as min_stock_level,
          reorder_level as reorder_quantity,
          unit as unit_of_measure
        FROM stock_items
        WHERE is_active = true 
          AND (quantity_on_hand <= minimum_quantity OR quantity_on_hand = 0)
      `;

      const res = await query<{
        id: string;
        company_id: string;
        stock_code: string;
        item_name: string;
        current_stock: number;
        min_stock_level: number;
        reorder_quantity: number;
        unit_of_measure: string;
      }>(sql);

      for (const row of res.rows) {
        try {
          const isOut = row.current_stock <= 0;
          const notificationType = isOut ? "STOCK_OUT" : "STOCK_LOW";
          const severity = isOut ? "CRITICAL" : "WARNING";
          const idempotencyKey = `STOCK_${isOut ? "OUT" : "LOW"}:${row.id}:${today}`;

          const title = isOut
            ? `CRITICAL: Stock Out - ${row.stock_code}`
            : `Low Stock Alert: ${row.stock_code}`;

          const message = isOut
            ? `Stock item '${row.item_name}' (${row.stock_code}) is completely depleted (0 ${row.unit_of_measure}). Immediate reorder required.`
            : `Stock item '${row.item_name}' (${row.stock_code}) has reached ${row.current_stock} ${row.unit_of_measure} (Min: ${row.min_stock_level}).`;

          const count = await notificationService.notifyRole(
            row.company_id,
            "ASSET_MANAGER",
            {
              notificationType,
              title,
              message,
              severity,
              entityType: "stock_items",
              entityId: row.id,
              actionUrl: `/stock/${row.id}`,
              idempotencyKey,
              metadata: {
                stockCode: row.stock_code,
                currentStock: row.current_stock,
                minStockLevel: row.min_stock_level
              }
            }
          );

          if (count > 0) {
            alertsCreated += count;
          }
        } catch (itemErr) {
          errors++;
          logger.error(`Error processing low stock for item ${row.id}:`, itemErr);
        }
      }

      return {
        job: "checkLowStock",
        processed: res.rows.length,
        alertsCreated,
        errors
      };
    } catch (err) {
      logger.error("checkLowStock failed:", err);
      return {
        job: "checkLowStock",
        processed: 0,
        alertsCreated: 0,
        errors: 1
      };
    }
  }

  /**
   * Scans requisitions pending approval for more than 48 hours.
   */
  async checkPendingApprovals(): Promise<ScheduledJobResult> {
    const today = new Date().toISOString().split("T")[0];
    let alertsCreated = 0;
    let errors = 0;

    try {
      const sql = `
        SELECT 
          ar.id,
          ar.company_id,
          COALESCE(ar.request_number, ar.request_code) as request_number,
          COALESCE(ar.item_name, ar.reason, 'Asset Requisition') as item_name,
          COALESCE(ar.current_approval_level, 1) as current_approval_level,
          ar.created_at,
          'ASSET_MANAGER' as approver_role
        FROM asset_requests ar
        WHERE ar.status IN ('PENDING', 'PENDING_APPROVAL', 'SUBMITTED')
          AND ar.created_at < NOW() - INTERVAL '48 hours'
      `;

      const res = await query<{
        id: string;
        company_id: string;
        request_number: string;
        item_name: string;
        current_approval_level: number;
        created_at: string;
        approver_role: string | null;
      }>(sql);

      for (const row of res.rows) {
        try {
          const targetRole = row.approver_role || "ASSET_MANAGER";
          const idempotencyKey = `PENDING_APPROVAL_OVERDUE:${row.id}:${today}`;

          const count = await notificationService.notifyRole(
            row.company_id,
            targetRole,
            {
              notificationType: "REQUISITION_APPROVAL_REQUIRED",
              title: `Pending Approval Reminder: ${row.request_number}`,
              message: `Requisition '${row.request_number}' (${row.item_name}) has been pending authorization at Level ${row.current_approval_level} for over 48 hours.`,
              severity: "WARNING",
              entityType: "asset_requests",
              entityId: row.id,
              actionUrl: `/requests/${row.id}`,
              idempotencyKey,
              metadata: {
                requestId: row.id,
                level: row.current_approval_level
              }
            }
          );

          if (count > 0) {
            alertsCreated += count;
          }
        } catch (itemErr) {
          errors++;
          logger.error(`Error processing pending approval for ${row.id}:`, itemErr);
        }
      }

      return {
        job: "checkPendingApprovals",
        processed: res.rows.length,
        alertsCreated,
        errors
      };
    } catch (err) {
      logger.error("checkPendingApprovals failed:", err);
      return {
        job: "checkPendingApprovals",
        processed: 0,
        alertsCreated: 0,
        errors: 1
      };
    }
  }
}

export const notificationJobs = new NotificationJobs();
