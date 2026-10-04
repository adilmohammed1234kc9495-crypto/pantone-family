"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  Boxes,
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Calendar,
  User,
  FileText,
  Layers,
  MapPin,
  TrendingDown,
  TrendingUp,
  ArrowUpDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

interface StockItemDetail {
  id: string;
  company_id: string;
  stock_code: string;
  item_name: string;
  category_id: string | null;
  location_id: string | null;
  unit: string;
  quantity_on_hand: number;
  minimum_quantity: number;
  reorder_level: number;
  maximum_quantity: number | null;
  unit_cost: number;
  total_valuation: number;
  stock_status: "HEALTHY" | "LOW_STOCK" | "OUT_OF_STOCK" | "OVERSTOCK";
  is_active: boolean;
  description: string | null;
  category_name?: string | null;
  location_name?: string | null;
  created_at: string;
}

interface StockMovementItem {
  id: string;
  stock_item_id: string;
  movement_type: string;
  quantity: number;
  unit_cost: number;
  balance_before: number;
  balance_after: number;
  from_location_id: string | null;
  to_location_id: string | null;
  performed_by: string;
  reference_type: string;
  reference_id: string | null;
  notes: string | null;
  performed_by_username?: string;
  created_at: string;
}

export default function StockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user, hasPermission } = useAuth();

  const [item, setItem] = useState<StockItemDetail | null>(null);
  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Movement Modal State
  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<
    "RECEIPT" | "ISSUE" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "RETURN" | "DAMAGE" | "SCRAP"
  >("RECEIPT");
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState("");
  const [submittingMovement, setSubmittingMovement] = useState(false);
  const [movementError, setMovementError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [itemRes, movsRes] = await Promise.all([
        apiClient<StockItemDetail>(`/stock/${id}`),
        apiClient<{ movements: StockMovementItem[]; total: number }>(`/stock/${id}/movements?limit=50`),
      ]);
      setItem(itemRes);
      setMovements(movsRes.movements || []);
    } catch (err: any) {
      setError(err.message || "Failed to load stock item details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchDetail();
    }
  }, [id, fetchDetail]);

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    setMovementError(null);
    setSubmittingMovement(true);

    try {
      await apiClient.post(`/stock/${id}/movements`, {
        movementType,
        quantity: Number(quantity),
        notes: notes.trim() || undefined,
      });

      setIsMovementOpen(false);
      setQuantity(1);
      setNotes("");
      fetchDetail();
    } catch (err: any) {
      setMovementError(err.message || "Failed to record movement");
    } finally {
      setSubmittingMovement(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/stock" className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 shadow-2xs">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="h-6 w-48 bg-slate-200 animate-pulse rounded" />
        </div>
        <TableSkeleton rows={8} />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="p-12 text-center bg-white border border-slate-200 rounded-xl shadow-subtle space-y-4 max-w-lg mx-auto">
        <AlertTriangle className="w-12 h-12 mx-auto text-rose-500" />
        <h2 className="text-lg font-bold text-slate-900">Error Loading Stock Item</h2>
        <p className="text-xs text-slate-500">{error || "Item not found"}</p>
        <Link
          href="/stock"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Stock Inventory
        </Link>
      </div>
    );
  }

  // Stock level percentage
  const maxCap = item.maximum_quantity || Math.max(item.quantity_on_hand * 1.5, item.reorder_level * 2, 100);
  const fillPct = Math.min(Math.round((item.quantity_on_hand / maxCap) * 100), 100);

  // Projected balance calculation for modal
  const isAddition = ["RECEIPT", "RETURN", "ADJUSTMENT_IN"].includes(movementType);
  const projectedBalance = isAddition
    ? item.quantity_on_hand + Number(quantity || 0)
    : item.quantity_on_hand - Number(quantity || 0);

  const getMovementBadge = (type: string) => {
    switch (type) {
      case "RECEIPT":
      case "ADJUSTMENT_IN":
        return <Badge variant="success">+{type}</Badge>;
      case "ISSUE":
      case "ADJUSTMENT_OUT":
        return <Badge variant="warning">-{type}</Badge>;
      case "RETURN":
        return <Badge variant="info">{type}</Badge>;
      case "DAMAGE":
      case "SCRAP":
        return <Badge variant="danger">{type}</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title={item.item_name}
        description={`Unit: ${item.unit} • Category: ${item.category_name || "General Spares"} • Location: ${item.location_name || "Main Warehouse"}`}
        icon={Boxes}
        badge={<Badge variant="neutral">{item.stock_code}</Badge>}
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Stock", href: "/stock" },
          { label: item.stock_code },
        ]}
        actions={
          (user?.isCommonAdmin || hasPermission("stock:manage")) ? (
            <Button
              variant="primary"
              size="sm"
              icon={ArrowUpDown}
              onClick={() => setIsMovementOpen(true)}
            >
              Record Movement / Adjustment
            </Button>
          ) : undefined
        }
      />

      {/* Overview & Stock Levels Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balance & Visual Gauge */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-white border border-slate-200/90 shadow-subtle space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Real-Time Stock Gauge
            </span>
            <span className="text-xs text-slate-500">
              Max Cap: {maxCap} {item.unit}
            </span>
          </div>

          <div className="flex items-baseline gap-4">
            <span className="text-4xl font-extrabold text-slate-900 tracking-tight font-mono">
              {item.quantity_on_hand}
            </span>
            <span className="text-sm text-slate-500 font-medium">{item.unit} on hand</span>

            <div className="ml-auto">
              {item.stock_status === "HEALTHY" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Healthy Level
                </span>
              )}
              {item.stock_status === "LOW_STOCK" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5" /> Reorder Triggered
                </span>
              )}
              {item.stock_status === "OUT_OF_STOCK" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-700">
                  <TrendingDown className="w-3.5 h-3.5" /> Depleted / Zero Stock
                </span>
              )}
              {item.stock_status === "OVERSTOCK" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 border border-sky-200 text-sky-700">
                  <TrendingUp className="w-3.5 h-3.5" /> Overstock
                </span>
              )}
            </div>
          </div>

          {/* Progress Bar Gauge */}
          <div className="space-y-1.5">
            <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden relative border border-slate-200/50">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  item.stock_status === "HEALTHY"
                    ? "bg-emerald-500"
                    : item.stock_status === "LOW_STOCK"
                    ? "bg-amber-500"
                    : item.stock_status === "OUT_OF_STOCK"
                    ? "bg-rose-500"
                    : "bg-sky-500"
                }`}
                style={{ width: `${Math.max(fillPct, 3)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>0</span>
              <span className="text-amber-700">Min: {item.minimum_quantity}</span>
              <span className="text-teal-700">Reorder: {item.reorder_level}</span>
              <span>Capacity: {maxCap}</span>
            </div>
          </div>

          {/* Sub Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs">
            <div>
              <span className="text-slate-400 block">Unit Cost</span>
              <span className="font-mono font-semibold text-slate-800">
                ${Number(item.unit_cost).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Total Valuation</span>
              <span className="font-mono font-semibold text-slate-900">
                ${Number(item.total_valuation).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Registered On</span>
              <span className="text-slate-800 font-mono">
                {new Date(item.created_at).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Status</span>
              <span className="text-slate-800 font-medium">
                {item.is_active ? "Active Catalog SKU" : "Archived / Inactive"}
              </span>
            </div>
          </div>
        </div>

        {/* Specifications & Notes Card */}
        <div className="p-6 rounded-xl bg-white border border-slate-200/90 shadow-subtle flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Item Details & Notes
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed">
              {item.description || "No additional technical specifications or vendor remarks recorded for this stock SKU."}
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-2 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Category</span>
              <span className="text-slate-800 font-medium">{item.category_name || "Uncategorized"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Location</span>
              <span className="text-slate-800 font-medium">{item.location_name || "Central Store"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Unit of Measure</span>
              <span className="text-slate-800 font-mono font-semibold uppercase">{item.unit}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Movements Ledger Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-600" />
            Stock Ledger Movements Audit Trail ({movements.length})
          </h2>
          <span className="text-xs text-slate-500">Immutable transaction log</span>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white overflow-hidden shadow-subtle">
          {movements.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No stock movements recorded yet. Record a receipt or issue above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Movement Type</th>
                    <th className="px-4 py-3 text-right">Quantity</th>
                    <th className="px-4 py-3 text-center">Balance Transition</th>
                    <th className="px-4 py-3">Reference / Reason</th>
                    <th className="px-4 py-3">Performed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {new Date(mov.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">{getMovementBadge(mov.movement_type)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {["RECEIPT", "RETURN", "ADJUSTMENT_IN"].includes(mov.movement_type) ? "+" : "-"}
                        {mov.quantity}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-600">
                        <span className="text-slate-500">{mov.balance_before}</span>
                        <span className="mx-2 text-slate-400">→</span>
                        <span className="font-semibold text-teal-600">{mov.balance_after}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="font-medium text-slate-900">
                          {mov.reference_type || "MANUAL_MOVEMENT"}
                        </div>
                        {mov.notes && (
                          <div className="text-[11px] text-slate-500 italic mt-0.5">
                            {`"${mov.notes}"`}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono">
                        {mov.performed_by_username || "System"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Record Movement Modal */}
      <Modal
        isOpen={isMovementOpen}
        onClose={() => setIsMovementOpen(false)}
        title={`Record Movement: ${item.stock_code}`}
      >
        <form onSubmit={handleRecordMovement} className="space-y-4 text-xs">
          {movementError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
              {movementError}
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Movement Type <span className="text-rose-500">*</span>
            </label>
            <select
              value={movementType}
              onChange={(e: any) => setMovementType(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
            >
              <option value="RECEIPT">RECEIPT (Add incoming vendor delivery)</option>
              <option value="ISSUE">ISSUE (Deduct issued items)</option>
              <option value="ADJUSTMENT_IN">ADJUSTMENT IN (Inventory count surplus)</option>
              <option value="ADJUSTMENT_OUT">ADJUSTMENT OUT (Inventory count deficit)</option>
              <option value="RETURN">RETURN (Items returned to stock)</option>
              <option value="DAMAGE">DAMAGE (Write-off damaged units)</option>
              <option value="SCRAP">SCRAP (Obsolete or scrap write-off)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Quantity <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 shadow-2xs focus:ring-teal-500/20 focus:border-teal-500 font-mono"
              />
            </div>

            {/* Projected Live Balance Preview */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-center">
              <span className="text-2xs uppercase font-semibold text-slate-500 tracking-wider">
                Simulated Balance
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-slate-400 line-through">
                  {item.quantity_on_hand}
                </span>
                <span className="text-slate-400">→</span>
                <span
                  className={`font-mono font-bold text-sm ${
                    projectedBalance < 0
                      ? "text-rose-600"
                      : projectedBalance <= item.minimum_quantity
                      ? "text-amber-600"
                      : "text-emerald-600"
                  }`}
                >
                  {projectedBalance} {item.unit}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Transaction Notes / Delivery Ref
            </label>
            <textarea
              rows={2}
              required={["ADJUSTMENT_IN", "ADJUSTMENT_OUT", "DAMAGE", "SCRAP"].includes(movementType)}
              placeholder="e.g. Physical inventory cycle count adjustment / Supplier invoice #..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none shadow-2xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsMovementOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={submittingMovement}
              disabled={projectedBalance < 0}
            >
              Confirm Movement
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
