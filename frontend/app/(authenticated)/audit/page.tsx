"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  ShieldCheck,
  Search,
  Filter,
  Eye,
  Building2,
  Calendar,
  AlertCircle,
  FileCode,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

interface AuditLogItem {
  id: string;
  company_id: string | null;
  company_code: string | null;
  company_name: string | null;
  user_id: string | null;
  username: string | null;
  user_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  old_values_json: Record<string, unknown> | null;
  new_values_json: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
}

export default function AuditPage() {
  const { user, availableCompanies } = useAuth();

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inspector modal state
  const [inspectLog, setInspectLog] = useState<AuditLogItem | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (search.trim()) params.set("search", search.trim());
      if (companyFilter !== "all") params.set("companyId", companyFilter);
      if (actionFilter.trim()) params.set("action", actionFilter.trim());
      if (entityFilter.trim()) params.set("entity", entityFilter.trim());

      const res = await apiClient<{
        logs: AuditLogItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/audit?${params.toString()}`);

      setLogs(res.logs);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err?.message || "Failed to query system audit logs");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, companyFilter, actionFilter, entityFilter]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Immutable Audit Ledger"
        description="Complete cryptographic audit trail of administrative modifications and tenant governance events."
        icon={ShieldCheck}
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Security & Governance", href: "/audit" },
          { label: "Audit Ledger" },
        ]}
      />

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-rose-700">{error}</div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by action, entity, user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {user?.isCommonAdmin && (
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-400" />
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="py-2 px-3 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Companies</option>
                <option value="null">Global System Events</option>
                {availableCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <input
            type="text"
            placeholder="Filter by action (e.g. COMPANY_CREATE)"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="py-2 px-3 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 max-w-[220px]"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <strong className="text-slate-800">{logs.length}</strong> of{" "}
          <strong className="text-slate-800">{total}</strong> records
        </div>
      </div>

      {/* Audit Table */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-6 py-3.5">Action Code</th>
                  <th className="px-4 py-3.5">Entity / Target</th>
                  <th className="px-6 py-3.5">Actor</th>
                  <th className="px-4 py-3.5">Company Boundary</th>
                  <th className="px-4 py-3.5">IP Address</th>
                  <th className="px-6 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      No audit records found matching the query.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-3.5 font-mono text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5 font-mono font-bold text-slate-900">
                        {log.action}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-slate-800 capitalize">{log.entity}</span>
                        {log.entity_id && (
                          <div className="font-mono text-[10px] text-slate-400">
                            {log.entity_id.slice(0, 8)}...
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="font-medium text-slate-800">
                          {log.username || "System Engine"}
                        </div>
                        {log.user_email && (
                          <div className="text-[11px] text-slate-400">{log.user_email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {log.company_code ? (
                          <span className="font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                            {log.company_code}
                          </span>
                        ) : (
                          <span className="text-[11px] text-indigo-600 font-medium">GLOBAL</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-slate-400">
                        {log.ip_address || "Internal"}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => setInspectLog(log)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-teal-600 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inspect Diff Modal */}
      {inspectLog && (
        <Modal
          isOpen={!!inspectLog}
          onClose={() => setInspectLog(null)}
          title={`Audit Event: ${inspectLog.action}`}
          maxWidth="xl"
          footer={
            <Button
              onClick={() => setInspectLog(null)}
              variant="secondary"
              size="sm"
            >
              Close
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">Actor:</span>
                <span className="font-semibold text-slate-900">{inspectLog.username || "System Engine"}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Timestamp:</span>
                <span className="font-mono text-slate-900">{new Date(inspectLog.timestamp).toISOString()}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Target Entity:</span>
                <span className="font-semibold text-slate-900">{inspectLog.entity} ({inspectLog.entity_id || "N/A"})</span>
              </div>
              <div>
                <span className="text-slate-500 block">IP Address:</span>
                <span className="font-mono text-slate-900">{inspectLog.ip_address || "Internal System"}</span>
              </div>
            </div>

            {/* Before / After Diff */}
            <div className="space-y-3">
              {inspectLog.old_values_json && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Previous Values (Before Change)
                  </h4>
                  <pre className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono overflow-x-auto max-h-48">
                    {JSON.stringify(inspectLog.old_values_json, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Recorded Event Payload (New Values)
                </h4>
                <pre className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono overflow-x-auto max-h-48">
                  {JSON.stringify(inspectLog.new_values_json, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
