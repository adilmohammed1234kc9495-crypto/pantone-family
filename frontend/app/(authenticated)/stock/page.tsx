"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  Boxes,
  Plus,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  Warehouse,
  ArrowUpDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

interface StockItem {
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
  category_name?: string | null;
  location_name?: string | null;
  created_at: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface LocationOption {
  id: string;
  name: string;
}

export default function StockListPage() {
  const { user, hasPermission } = useAuth();

  const [items, setItems] = useState<StockItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  // Categories & Locations for selects
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    stockCode: "",
    itemName: "",
    categoryId: "",
    locationId: "",
    unit: "PCS",
    quantityOnHand: 0,
    minimumQuantity: 10,
    reorderLevel: 20,
    maximumQuantity: 500,
    unitCost: 0,
    description: "",
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchStock = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: String(page),
        limit: "25",
      });
      if (search) params.append("search", search);
      if (selectedStatus) params.append("status", selectedStatus);
      if (selectedCategory) params.append("categoryId", selectedCategory);

      const res = await apiClient<{ items: StockItem[]; total: number }>(
        `/stock?${params.toString()}`
      );
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err.message || "Failed to load stock inventory");
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedStatus, selectedCategory]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  useEffect(() => {
    // Load categories & locations for filter & modal
    async function loadMasterData() {
      try {
        const [catsRes, locsRes] = await Promise.all([
          apiClient<any>("/categories").catch(() => []),
          apiClient<any>("/locations").catch(() => []),
        ]);
        setCategories(Array.isArray(catsRes) ? catsRes : catsRes.items || []);
        setLocations(Array.isArray(locsRes) ? locsRes : locsRes.items || []);
      } catch {
        // Soft fail
      }
    }
    loadMasterData();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSubmitting(true);

    try {
      await apiClient.post("/stock", {
        stockCode: formData.stockCode.trim(),
        itemName: formData.itemName.trim(),
        categoryId: formData.categoryId || undefined,
        locationId: formData.locationId || undefined,
        unit: formData.unit.trim().toUpperCase(),
        quantityOnHand: Number(formData.quantityOnHand),
        minimumQuantity: Number(formData.minimumQuantity),
        reorderLevel: Number(formData.reorderLevel),
        maximumQuantity: formData.maximumQuantity ? Number(formData.maximumQuantity) : undefined,
        unitCost: Number(formData.unitCost),
        description: formData.description.trim() || undefined,
      });

      setIsCreateOpen(false);
      setFormData({
        stockCode: "",
        itemName: "",
        categoryId: "",
        locationId: "",
        unit: "PCS",
        quantityOnHand: 0,
        minimumQuantity: 10,
        reorderLevel: 20,
        maximumQuantity: 500,
        unitCost: 0,
        description: "",
      });
      fetchStock();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create stock item");
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Metrics computation
  const totalValuation = items.reduce((acc, curr) => acc + Number(curr.total_valuation || 0), 0);
  const lowStockCount = items.filter((i) => i.stock_status === "LOW_STOCK" || i.stock_status === "OUT_OF_STOCK").length;
  const healthyCount = items.filter((i) => i.stock_status === "HEALTHY").length;

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "HEALTHY":
        return <Badge variant="success">HEALTHY</Badge>;
      case "LOW_STOCK":
        return <Badge variant="warning">LOW STOCK</Badge>;
      case "OUT_OF_STOCK":
        return <Badge variant="danger">OUT OF STOCK</Badge>;
      case "OVERSTOCK":
        return <Badge variant="info">OVERSTOCK</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Stock & Inventory Ledger"
        description="Real-time balance tracking, minimum reorder thresholds, and valuation ledger."
        icon={Boxes}
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Stock" },
        ]}
        actions={
          (user?.isCommonAdmin || hasPermission("stock:create")) ? (
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setIsCreateOpen(true)}
            >
              Register Stock Item
            </Button>
          ) : undefined
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Stock SKUs
            </span>
            <Warehouse className="w-4 h-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono">{total}</p>
          <p className="mt-1 text-xs text-slate-500">Tracked inventory lines</p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Inventory Valuation
            </span>
            <DollarSign className="w-4 h-4 text-teal-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-teal-700 font-mono">
            ${totalValuation.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-slate-500">Page items total book cost</p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Healthy Levels
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-700 font-mono">{healthyCount}</p>
          <p className="mt-1 text-xs text-slate-500">Above reorder threshold</p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Low / Out of Stock
            </span>
            <TrendingDown className="w-4 h-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-700 font-mono">{lowStockCount}</p>
          <p className="mt-1 text-xs text-slate-500">Action required</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search stock code or item name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 shadow-2xs focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="">All Statuses</option>
            <option value="HEALTHY">Healthy</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
            <option value="OVERSTOCK">Overstock</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 shadow-2xs focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-xl border border-slate-200/90 bg-white overflow-hidden shadow-subtle">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={6} />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-sm">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-80" />
            <p className="font-semibold">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={fetchStock}
            >
              Try Again
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={Boxes}
              title="No stock items found"
              description="Try adjusting your search criteria or register a new stock item."
              actionLabel="Register Stock Item"
              onAction={() => setIsCreateOpen(true)}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Stock Code</th>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">On Hand</th>
                  <th className="px-4 py-3 text-right">Min / Reorder</th>
                  <th className="px-4 py-3 text-right">Unit Cost</th>
                  <th className="px-4 py-3 text-right">Valuation</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-teal-600">
                      <Link href={`/stock/${item.id}`} className="hover:underline">
                        {item.stock_code}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{item.item_name}</div>
                      <div className="text-[11px] text-slate-500">Unit: {item.unit}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.category_name || "Uncategorized"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 font-mono tabular-nums">
                      {item.quantity_on_hand} <span className="text-[10px] text-slate-500 font-normal">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600 tabular-nums">
                      {item.minimum_quantity} / {item.reorder_level}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums">
                      ${Number(item.unit_cost).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      ${Number(item.total_valuation).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {renderStatusBadge(item.stock_status)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/stock/${item.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-slate-900 transition-colors shadow-2xs font-medium text-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ledger</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 25 && (
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Showing {(page - 1) * 25 + 1} to {Math.min(page * 25, total)} of {total} items
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-50 text-slate-700 shadow-2xs"
            >
              Previous
            </button>
            <button
              disabled={page * 25 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-50 text-slate-700 shadow-2xs"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Register Stock Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Register New Stock Item"
        maxWidth="xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {createError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
              {createError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Stock Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. STK-FAB-001"
                value={formData.stockCode}
                onChange={(e) => setFormData({ ...formData, stockCode: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 uppercase font-mono shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Item Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Industrial Sewing Thread"
                value={formData.itemName}
                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Category</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Location</label>
              <select
                value={formData.locationId}
                onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
              >
                <option value="">Select Location</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Unit of Measure <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="PCS, MTR, SPOOL"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 uppercase font-mono shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Initial Quantity</label>
              <input
                type="number"
                min="0"
                value={formData.quantityOnHand}
                onChange={(e) => setFormData({ ...formData, quantityOnHand: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Unit Cost ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.unitCost}
                onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Min Threshold</label>
              <input
                type="number"
                min="0"
                value={formData.minimumQuantity}
                onChange={(e) => setFormData({ ...formData, minimumQuantity: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Reorder Level</label>
              <input
                type="number"
                min="0"
                value={formData.reorderLevel}
                onChange={(e) => setFormData({ ...formData, reorderLevel: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Max Capacity</label>
              <input
                type="number"
                min="0"
                value={formData.maximumQuantity}
                onChange={(e) => setFormData({ ...formData, maximumQuantity: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Technical specs, supplier notes, or storage conditions..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none shadow-2xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={createSubmitting}
            >
              Register Item
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
