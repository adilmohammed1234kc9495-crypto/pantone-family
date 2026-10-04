"use client";

import React, { useState } from "react";
import { FileSpreadsheet, FileText, RotateCcw, Search } from "lucide-react";
import { reportsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export interface FilterOption {
  value: string;
  label: string;
}

export interface ReportFilterConfig {
  showSearch?: boolean;
  searchPlaceholder?: string;
  showDateRange?: boolean;
  showCategory?: boolean;
  categories?: FilterOption[];
  showStatus?: boolean;
  statuses?: FilterOption[];
  showPriority?: boolean;
  priorities?: FilterOption[];
  showScanType?: boolean;
  scanTypes?: FilterOption[];
  showTransferType?: boolean;
  transferTypes?: FilterOption[];
  showDepreciationStatus?: boolean;
  depreciationStatuses?: FilterOption[];
  showLowStockOnly?: boolean;
  customFilters?: Array<{
    id: string;
    label: string;
    options: FilterOption[];
  }>;
}

interface ReportFiltersProps {
  reportType: string;
  config?: ReportFilterConfig;
  filters: Record<string, string>;
  onFilterChange: (newFilters: Record<string, string>) => void;
  totalRecords?: number;
  isLoading?: boolean;
}

export function ReportFilters({
  reportType,
  config = {},
  filters,
  onFilterChange,
  totalRecords,
  isLoading = false,
}: ReportFiltersProps) {
  const { user, hasPermission } = useAuth();
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingXlsx, setIsExportingXlsx] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const canExport = user?.isCommonAdmin || hasPermission("reports:export");

  const handleChange = (key: string, value: string) => {
    onFilterChange({ ...filters, [key]: value, page: "1" });
  };

  const handleReset = () => {
    onFilterChange({ page: "1", limit: "20" });
  };

  const handleExport = async (format: "csv" | "xlsx") => {
    try {
      setExportError(null);
      if (format === "csv") setIsExportingCsv(true);
      else setIsExportingXlsx(true);

      await reportsApi.downloadReport(reportType, format, filters);
    } catch (err: any) {
      setExportError(err?.message || `Failed to export ${format.toUpperCase()}`);
    } finally {
      setIsExportingCsv(false);
      setIsExportingXlsx(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-lg p-4 space-y-4 shadow-subtle">
      {/* Top row: search + action buttons */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {config.showSearch !== false && (
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={config.searchPlaceholder || "Search by code, tag, name..."}
              value={filters.search || ""}
              onChange={(e) => handleChange("search", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md pl-9 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-colors"
            />
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {totalRecords !== undefined && (
            <div className="px-2.5 py-1 bg-slate-50 rounded-md text-xs text-slate-600 border border-slate-200">
              Total: <span className="text-teal-700 font-semibold font-mono">{totalRecords.toLocaleString()}</span> records
            </div>
          )}

          <button
            type="button"
            onClick={handleReset}
            title="Reset filters"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-md text-xs font-medium border border-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset</span>
          </button>

          {canExport && (
            <>
              <button
                type="button"
                onClick={() => handleExport("csv")}
                disabled={isExportingCsv || isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>{isExportingCsv ? "Exporting..." : "Export CSV"}</span>
              </button>

              <button
                type="button"
                onClick={() => handleExport("xlsx")}
                disabled={isExportingXlsx || isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-xs font-medium shadow-subtle transition-colors disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-teal-100" />
                <span>{isExportingXlsx ? "Building Excel..." : "Export Excel"}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter controls row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
        {config.showStatus && config.statuses && (
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Status</label>
            <select
              value={filters.status || "ALL"}
              onChange={(e) => handleChange("status", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="ALL">All Statuses</option>
              {config.statuses.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {config.showPriority && config.priorities && (
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Priority</label>
            <select
              value={filters.priority || "ALL"}
              onChange={(e) => handleChange("priority", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="ALL">All Priorities</option>
              {config.priorities.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {config.showTransferType && config.transferTypes && (
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Transfer Type</label>
            <select
              value={filters.transferType || "ALL"}
              onChange={(e) => handleChange("transferType", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="ALL">All Transfer Types</option>
              {config.transferTypes.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {config.showScanType && config.scanTypes && (
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Scan Type</label>
            <select
              value={filters.scanType || "ALL"}
              onChange={(e) => handleChange("scanType", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="ALL">All Scan Types</option>
              {config.scanTypes.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {config.showDepreciationStatus && config.depreciationStatuses && (
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Depreciation State</label>
            <select
              value={filters.depreciationStatus || "ALL"}
              onChange={(e) => handleChange("depreciationStatus", e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="ALL">All Assets</option>
              {config.depreciationStatuses.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {config.showLowStockOnly && (
          <div className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              id="lowStockOnly"
              checked={filters.lowStockOnly === "true"}
              onChange={(e) => handleChange("lowStockOnly", e.target.checked ? "true" : "")}
              className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 bg-white border-slate-300"
            />
            <label htmlFor="lowStockOnly" className="text-xs text-amber-700 font-medium cursor-pointer">
              Low Stock Items Only
            </label>
          </div>
        )}

        {config.showDateRange && (
          <>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Date From</label>
              <input
                type="date"
                value={filters.dateFrom || ""}
                onChange={(e) => handleChange("dateFrom", e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Date To</label>
              <input
                type="date"
                value={filters.dateTo || ""}
                onChange={(e) => handleChange("dateTo", e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </>
        )}
      </div>

      {exportError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700">
          {exportError}
        </div>
      )}
    </div>
  );
}
