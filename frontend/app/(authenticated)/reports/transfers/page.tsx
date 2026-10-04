"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { reportsApi } from "@/lib/api";
import { ReportFilters, ReportFilterConfig } from "@/components/reports/report-filters";
import { ArrowLeftRight, ArrowLeft, AlertCircle, ShieldAlert, CheckCircle2, Clock } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

export default function TransfersReportPage() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({
    page: "1",
    limit: "20",
  });

  const filterConfig: ReportFilterConfig = {
    searchPlaceholder: "Search transfer code, tag, asset...",
    showTransferType: true,
    transferTypes: [
      { value: "INTER_COMPANY", label: "Inter-Company" },
      { value: "DEPT_TO_DEPT", label: "Department to Department" },
      { value: "LOCATION_TO_LOCATION", label: "Location to Location" },
      { value: "EMPLOYEE_TO_EMPLOYEE", label: "Employee to Employee" },
    ],
    showStatus: true,
    statuses: [
      { value: "INITIATED", label: "Initiated" },
      { value: "PENDING_APPROVAL", label: "Pending Approval" },
      { value: "APPROVED", label: "Approved" },
      { value: "DISPATCHED", label: "Dispatched / In Transit" },
      { value: "COMPLETED", label: "Completed" },
      { value: "DISPUTED", label: "Disputed" },
      { value: "REJECTED", label: "Rejected" },
    ],
    showDateRange: true,
  };

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await reportsApi.getTransfers(filters);
      setData(res.items || []);
      setTotal(res.total || 0);
      setSummary(res.summary || null);
    } catch (err: any) {
      setError(err?.message || "Failed to load transfers report");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const currentPage = Number(filters.page || 1);
  const limit = Number(filters.limit || 20);
  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Asset Transfers & Movements Report"
        description="Historical ledger of internal and inter-company asset movements, routing, and dual-authorization handovers."
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Reports", href: "/reports" },
          { label: "Transfers & Movements" },
        ]}
      />

      {/* Summary KPI Strip */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Transfers</span>
            <span className="text-xl font-bold font-mono text-slate-900 mt-0.5 block">{summary.totalTransfers ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Completed</span>
            <span className="text-xl font-bold font-mono text-emerald-700 mt-0.5 block">{summary.completedCount ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">In Transit</span>
            <span className="text-xl font-bold font-mono text-purple-700 mt-0.5 block">{summary.inTransitCount ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Disputed</span>
            <span className="text-xl font-bold font-mono text-rose-700 mt-0.5 block">{summary.disputedCount ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Inter-Company</span>
            <span className="text-xl font-bold font-mono text-teal-700 mt-0.5 block">{summary.interCompanyCount ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Internal Transfers</span>
            <span className="text-xl font-bold font-mono text-slate-700 mt-0.5 block">{summary.internalCount ?? 0}</span>
          </div>
        </div>
      )}

      {/* Filter and Export Toolbar */}
      <ReportFilters
        reportType="transfers"
        config={filterConfig}
        filters={filters}
        onFilterChange={setFilters}
        totalRecords={total}
        isLoading={loading}
      />

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white border border-slate-200/90 rounded-lg overflow-hidden shadow-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Transfer Code</th>
                <th className="py-2.5 px-3 font-semibold">Asset Tag & Name</th>
                <th className="py-2.5 px-3 font-semibold">Type</th>
                <th className="py-2.5 px-3 font-semibold">Origin</th>
                <th className="py-2.5 px-3 font-semibold">Destination</th>
                <th className="py-2.5 px-3 font-semibold">Dates</th>
                <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                <th className="py-2.5 px-3 font-semibold">Digital Signature Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading transfer history...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No transfer records found.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-medium text-teal-700 whitespace-nowrap">
                      {item.transfer_code}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono text-teal-800 font-semibold">{item.asset_tag}</div>
                      <div className="text-[11px] text-slate-500">{item.asset_name}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded ${
                          item.transfer_type === "INTER_COMPANY"
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {item.transfer_type === "INTER_COMPANY" ? "Inter-Company" : "Internal"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <div className="font-medium text-slate-900">{item.from_company_name}</div>
                      <div className="text-[11px] text-slate-400">{item.from_department_name || "—"}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <div className="font-medium text-slate-900">{item.to_company_name}</div>
                      <div className="text-[11px] text-slate-400">{item.to_department_name || "—"}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <div>
                        Initiated:{" "}
                        <span className="text-slate-800 font-mono">
                          {item.transfer_date ? new Date(item.transfer_date).toLocaleDateString() : "—"}
                        </span>
                      </div>
                      {item.actual_delivery_date && (
                        <div className="text-[11px] text-emerald-700 font-mono">
                          Delivered: {new Date(item.actual_delivery_date).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                      {item.handover_signature_ref ? (
                        <span className="text-teal-700 truncate max-w-[120px] block" title={item.handover_signature_ref}>
                          {item.handover_signature_ref}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200/90 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage <= 1 || loading}
                onClick={() => setFilters({ ...filters, page: String(currentPage - 1) })}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={currentPage >= totalPages || loading}
                onClick={() => setFilters({ ...filters, page: String(currentPage + 1) })}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
