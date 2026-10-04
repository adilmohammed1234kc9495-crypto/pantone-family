"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  Building2,
  Users,
  Box,
  Clock,
  ArrowRightLeft,
  Wrench,
  DollarSign,
  Activity,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/skeleton";
import Link from "next/link";

interface DashboardData {
  scope: "GLOBAL" | "COMPANY";
  company_id: string | null;
  companies: {
    total: number;
    active: number;
    inactive: number;
  };
  users: {
    total: number;
    active: number;
    inactive: number;
  };
  assets: {
    total: number;
    total_valuation: number;
    by_status: Record<string, number>;
  };
  operations: {
    pending_approvals: number;
    active_transfers: number;
    pending_inter_company_transfers: number;
    active_maintenance: number;
  };
  company_summaries?: Array<{
    id: string;
    code: string;
    name: string;
    is_active: boolean;
    asset_count: number;
    user_count: number;
    branch_count: number;
  }>;
  recent_activity: Array<{
    id: string;
    action: string;
    entity: string;
    entity_id: string | null;
    timestamp: string;
    actor_username: string | null;
    company_name: string | null;
    company_code: string | null;
  }>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient<DashboardData>("/dashboard/stats");
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard statistics");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const hasPendingOperations =
    (data?.operations.pending_approvals ?? 0) > 0 ||
    (data?.operations.active_transfers ?? 0) > 0 ||
    (data?.operations.active_maintenance ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={
          data?.scope === "GLOBAL"
            ? "Global Enterprise Dashboard"
            : "Company Asset Dashboard"
        }
        description="Operational overview across fixed asset inventory, active custody, transfers, and system audits."
        badge={
          <Badge
            variant={data?.scope === "GLOBAL" ? "brand" : "info"}
            className="uppercase"
          >
            {data?.scope === "GLOBAL" ? "Global Scope" : "Tenant Scope"}
          </Badge>
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchStats}
            isLoading={isLoading}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        }
      />

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200/80 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800">{error}</div>
        </div>
      )}

      {/* Actionable Attention Banner */}
      {!isLoading && hasPendingOperations && (
        <div className="p-3.5 sm:p-4 rounded-lg bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-500/30">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-100">
                Operational Items Requiring Attention
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-0.5 flex-wrap">
                {data?.operations.pending_approvals ? (
                  <span>
                    <strong className="text-amber-300 font-mono">
                      {data.operations.pending_approvals}
                    </strong>{" "}
                    pending approvals
                  </span>
                ) : null}
                {data?.operations.active_transfers ? (
                  <span>
                    <strong className="text-teal-300 font-mono">
                      {data.operations.active_transfers}
                    </strong>{" "}
                    active transfers
                  </span>
                ) : null}
                {data?.operations.active_maintenance ? (
                  <span>
                    <strong className="text-rose-300 font-mono">
                      {data.operations.active_maintenance}
                    </strong>{" "}
                    active work orders
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {data?.operations.pending_approvals ? (
              <Link
                href="/approvals"
                className="text-xs font-medium px-2.5 py-1 rounded bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 transition-colors inline-flex items-center gap-1"
              >
                <span>Approvals</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
              </Link>
            ) : null}
            {data?.operations.active_transfers ? (
              <Link
                href="/transfers"
                className="text-xs font-medium px-2.5 py-1 rounded bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 transition-colors inline-flex items-center gap-1"
              >
                <span>Transfers</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
              </Link>
            ) : null}
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            {/* Total Companies (Global) or Scope Info */}
            <Card>
              <div className="p-4 sm:p-5 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {data?.scope === "GLOBAL" ? "Registered Enterprises" : "Operating Scope"}
                  </span>
                  <Building2 className="w-4 h-4 text-slate-400" />
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
                    {data?.scope === "GLOBAL" ? data?.companies.total : (user?.companyCode || "PANTONE")}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    {data?.scope === "GLOBAL" ? (
                      <>
                        <span className="text-emerald-700 font-medium">{data?.companies.active} Active</span>
                        <span>&bull;</span>
                        <span className="text-slate-400">{data?.companies.inactive} Inactive</span>
                      </>
                    ) : (
                      <span>{user?.companyName || "Pantone Facility"}</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Total Users */}
            <Card>
              <div className="p-4 sm:p-5 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Personnel Directory
                  </span>
                  <Users className="w-4 h-4 text-slate-400" />
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
                    {data?.users.total}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <span className="text-emerald-700 font-medium">{data?.users.active} Active accounts</span>
                    {data?.users.inactive ? (
                      <>
                        <span>&bull;</span>
                        <span className="text-slate-400">{data.users.inactive} Inactive</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>

            {/* Total Fixed Assets */}
            <Card>
              <div className="p-4 sm:p-5 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Total Fixed Assets
                  </span>
                  <Box className="w-4 h-4 text-slate-400" />
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
                    {data?.assets.total}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Cataloged across facilities
                  </div>
                </div>
              </div>
            </Card>

            {/* Total Valuation */}
            <Card>
              <div className="p-4 sm:p-5 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Asset Book Valuation
                  </span>
                  <DollarSign className="w-4 h-4 text-slate-400" />
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
                    ${(data?.assets.total_valuation || 0).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Net depreciated book value
                  </div>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Operational Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/approvals"
          className="group p-4 bg-white rounded-lg border border-slate-200/90 shadow-subtle hover:border-slate-300 transition-colors flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-amber-50 text-amber-700 border border-amber-200/70 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 font-mono leading-none">
                {data?.operations.pending_approvals ?? 0}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Pending Approvals</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
        </Link>

        <Link
          href="/transfers"
          className="group p-4 bg-white rounded-lg border border-slate-200/90 shadow-subtle hover:border-slate-300 transition-colors flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-teal-50 text-teal-700 border border-teal-200/70 flex items-center justify-center flex-shrink-0">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 font-mono leading-none">
                {data?.operations.active_transfers ?? 0}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Active In-Transit Transfers</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
        </Link>

        <Link
          href="/maintenance"
          className="group p-4 bg-white rounded-lg border border-slate-200/90 shadow-subtle hover:border-slate-300 transition-colors flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center flex-shrink-0">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 font-mono leading-none">
                {data?.operations.active_maintenance ?? 0}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Active Maintenance Orders</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
        </Link>
      </div>

      {/* Two Column Layout: Directory / Status Breakdown + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Companies Overview or Status Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          {data?.scope === "GLOBAL" && data?.company_summaries && (
            <Card>
              <CardHeader
                title="Managed Enterprises"
                subtitle="Tenant facilities under Common Admin oversight"
                actions={
                  <Link
                    href="/companies"
                    className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1"
                  >
                    <span>View All</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200/80">
                    <tr>
                      <th className="px-5 py-3">Company</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3 text-right">Branches</th>
                      <th className="px-3 py-3 text-right">Personnel</th>
                      <th className="px-3 py-3 text-right">Assets</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {data.company_summaries.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-semibold text-slate-900">{c.name}</div>
                          <div className="text-[11px] font-mono text-slate-400">{c.code}</div>
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={c.is_active} />
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-slate-700">
                          {c.branch_count}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-slate-700">
                          {c.user_count}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-medium text-slate-900">
                          {c.asset_count}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            href={`/companies/${c.id}`}
                            className="text-xs font-medium text-teal-700 hover:text-teal-900 inline-flex items-center gap-0.5"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Assets By Status Distribution */}
          <Card>
            <CardHeader
              title="Asset Lifecycle Distribution"
              subtitle="Current operational distribution across cataloged assets"
            />
            <CardContent>
              {Object.entries(data?.assets.by_status || {}).length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No assets cataloged in this scope.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(data?.assets.by_status || {}).map(([st, cnt]) => (
                    <div
                      key={st}
                      className="p-3 rounded-md border border-slate-200/80 bg-slate-50/40 flex flex-col justify-between"
                    >
                      <StatusBadge status={st} />
                      <div className="text-xl font-bold font-mono text-slate-900 mt-2">
                        {cnt}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Recent Activity Feed */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title={
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-600" />
                  <span>Recent Audit Activity</span>
                </div>
              }
              actions={
                <Link
                  href="/audit"
                  className="text-xs font-medium text-teal-700 hover:text-teal-900 inline-flex items-center gap-0.5"
                >
                  <span>Audit Trail</span>
                  <ChevronRight className="w-3 h-3" />
                </Link>
              }
            />
            <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
              {!data?.recent_activity || data.recent_activity.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">
                  No recent security audit logs recorded.
                </p>
              ) : (
                data.recent_activity.map((act) => (
                  <div key={act.id} className="p-3.5 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-800 text-[11px] font-mono">
                        {act.action}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(act.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                      <span>
                        Actor: <strong className="text-slate-700 font-medium">{act.actor_username || "System"}</strong>
                      </span>
                      {act.company_code && (
                        <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-100 text-slate-600">
                          {act.company_code}
                        </span>
                      )}
                      <span>&bull;</span>
                      <span className="text-slate-400 text-[11px] capitalize">{act.entity}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
