"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { reportsApi } from "@/lib/api";
import { ReportFilters, ReportFilterConfig } from "@/components/reports/report-filters";
import { QrCode, ArrowLeft, AlertCircle, Camera, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export default function ScansReportPage() {
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
    searchPlaceholder: "Search asset tag, operator...",
    showScanType: true,
    scanTypes: [
      { value: "QR", label: "QR Code" },
      { value: "BARCODE", label: "Barcode (Code 128)" },
      { value: "MANUAL", label: "Manual Lookup" },
    ],
    showDateRange: true,
  };

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await reportsApi.getScans(filters);
      setData(res.items || []);
      setTotal(res.total || 0);
      setSummary(res.summary || null);
    } catch (err: any) {
      setError(err?.message || "Failed to load scans report");
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
        title="Physical Asset Scanning & Audit Ledger Report"
        description="Real-time physical asset verification events captured via web cameras, hardware scanners, and manual lookups."
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Reports", href: "/reports" },
          { label: "Scanning Ledger" },
        ]}
      />

      {/* Summary KPI Strip */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Scans Audited</span>
            <span className="text-xl font-bold font-mono text-slate-900 mt-0.5 block">{summary.totalScans ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">QR Code Scans</span>
            <span className="text-xl font-bold font-mono text-teal-700 mt-0.5 block">{summary.qrScans ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Barcode Scans</span>
            <span className="text-xl font-bold font-mono text-blue-700 mt-0.5 block">{summary.barcodeScans ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Manual Entries</span>
            <span className="text-xl font-bold font-mono text-amber-700 mt-0.5 block">{summary.manualScans ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Failed Verifications</span>
            <span className="text-xl font-bold font-mono text-rose-700 mt-0.5 block">{summary.failedScans ?? 0}</span>
          </div>
        </div>
      )}

      {/* Filter and Export Toolbar */}
      <ReportFilters
        reportType="scans"
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
                <th className="py-2.5 px-3 font-semibold">Scan Timestamp</th>
                <th className="py-2.5 px-3 font-semibold">Asset Tag & Name</th>
                <th className="py-2.5 px-3 font-semibold text-center">Scan Type</th>
                <th className="py-2.5 px-3 font-semibold">Capture Device</th>
                <th className="py-2.5 px-3 font-semibold">Operator</th>
                <th className="py-2.5 px-3 font-semibold">Company</th>
                <th className="py-2.5 px-3 font-semibold text-center">Result</th>
                <th className="py-2.5 px-3 font-semibold">Notes / Token</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading scan audit trail...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No physical scan events found.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                      {item.scan_time ? new Date(item.scan_time).toLocaleString() : "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono text-teal-700 font-semibold">{item.asset_tag}</div>
                      <div className="text-[11px] text-slate-500">{item.asset_name}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded ${
                          item.scan_type === "QR"
                            ? "bg-teal-50 text-teal-700 border border-teal-200"
                            : item.scan_type === "BARCODE"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {item.scan_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                      {item.source}
                    </td>
                    <td className="py-2.5 px-3 text-slate-900 font-medium">{item.operator_username}</td>
                    <td className="py-2.5 px-3 text-slate-600">{item.company_name}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-medium rounded border border-emerald-200">
                        {item.result || "SUCCESS"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate" title={item.notes}>
                      {item.notes || "—"}
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
