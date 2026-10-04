"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { reportsApi } from "@/lib/api";
import { ReportFilters, ReportFilterConfig } from "@/components/reports/report-filters";
import { UserCheck, ArrowLeft, AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

export default function CustodyReportPage() {
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
    searchPlaceholder: "Search employee, asset tag...",
    showStatus: true,
    statuses: [
      { value: "ACTIVE", label: "Active Custody" },
      { value: "RETURNED", label: "Returned" },
      { value: "CANCELLED", label: "Cancelled" },
    ],
    showDateRange: true,
  };

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await reportsApi.getCustody(filters);
      setData(res.items || []);
      setTotal(res.total || 0);
      setSummary(res.summary || null);
    } catch (err: any) {
      setError(err?.message || "Failed to load custody report");
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
        title="Asset Custody & Overdue Assignments Report"
        description="Tracking personal asset accountability, return schedules, overdue alerts, and damage return inspections."
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Reports", href: "/reports" },
          { label: "Custody & Overdue" },
        ]}
      />

      {/* Summary KPI Strip */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Assignments</span>
            <span className="text-xl font-bold font-mono text-slate-900 mt-0.5 block">{summary.totalAssignments ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Active Custody</span>
            <span className="text-xl font-bold font-mono text-teal-700 mt-0.5 block">{summary.activeCustody ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Returned Assets</span>
            <span className="text-xl font-bold font-mono text-emerald-700 mt-0.5 block">{summary.returnedCount ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Overdue for Return</span>
            <span className="text-xl font-bold font-mono text-rose-700 mt-0.5 block">{summary.overdueCount ?? 0}</span>
          </div>
        </div>
      )}

      {/* Filter and Export Toolbar */}
      <ReportFilters
        reportType="custody"
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
                <th className="py-2.5 px-3 font-semibold">Asset Tag & Name</th>
                <th className="py-2.5 px-3 font-semibold">Custodian Employee</th>
                <th className="py-2.5 px-3 font-semibold">Company / Dept</th>
                <th className="py-2.5 px-3 font-semibold">Assigned Date</th>
                <th className="py-2.5 px-3 font-semibold">Return Due Date</th>
                <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                <th className="py-2.5 px-3 font-semibold">Condition</th>
                <th className="py-2.5 px-3 font-semibold">Return & Damage Assessment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading custody records...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No custody assignments found.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-mono text-teal-700 font-semibold">{item.asset_tag}</div>
                      <div className="text-[11px] text-slate-500">{item.asset_name}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-900">{item.employee_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{item.employee_code}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <div>{item.company_name}</div>
                      <div className="text-[11px] text-slate-400">{item.department_name || "—"}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono">
                      {item.assigned_at ? new Date(item.assigned_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {item.return_due_date ? (
                        <div>
                          <span className="font-mono">{new Date(item.return_due_date).toLocaleDateString()}</span>
                          {item.is_overdue && (
                            <span className="inline-block ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase">
                              OVERDUE
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Open-ended</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <span className="px-2 py-0.5 bg-slate-50 rounded text-[11px] border border-slate-200">
                        {item.condition_at_assignment || "GOOD"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {item.returned_at ? (
                        <div>
                          <div className="text-emerald-700 text-[11px] font-mono">
                            Returned: {new Date(item.returned_at).toLocaleDateString()}
                          </div>
                          <div className="text-[10px] text-slate-400">Condition: {item.return_condition || "—"}</div>
                          {item.damage_severity && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-rose-50 border border-rose-200 text-rose-700 text-[9px] rounded font-semibold uppercase">
                              Damage: {item.damage_severity}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">In Possession</span>
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
