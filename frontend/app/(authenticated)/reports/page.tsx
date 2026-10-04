"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { reportsApi } from "@/lib/api";
import {
  BarChart3,
  DollarSign,
  PackageCheck,
  ArrowLeftRight,
  UserCheck,
  Wrench,
  Boxes,
  ClipboardList,
  ShieldCheck,
  QrCode,
  RefreshCw,
  AlertTriangle,
  Building2,
  TrendingDown,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { CardSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

export default function ReportsDashboardPage() {
  const { user, companyContext } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await reportsApi.getDashboard();
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const reportCards = [
    {
      title: "Fixed Asset Register",
      description: "Full directory with categories, locations, custodians, and valuation.",
      href: "/reports/assets",
      icon: PackageCheck,
      color: "text-blue-700 bg-blue-50 border-blue-200",
    },
    {
      title: "Straight-Line Depreciation",
      description: "Amortization engine, remaining useful life, and net book values.",
      href: "/reports/depreciation",
      icon: DollarSign,
      color: "text-emerald-700 bg-emerald-50 border-emerald-200",
    },
    {
      title: "Transfers & Routing",
      description: "Inter-company dual authorizations, dispatch, and physical handovers.",
      href: "/reports/transfers",
      icon: ArrowLeftRight,
      color: "text-purple-700 bg-purple-50 border-purple-200",
    },
    {
      title: "Custody & Overdue Returns",
      description: "Employee asset accountability, active custody, and return conditions.",
      href: "/reports/custody",
      icon: UserCheck,
      color: "text-amber-700 bg-amber-50 border-amber-200",
    },
    {
      title: "Maintenance & Work Orders",
      description: "Corrective and preventative orders, repair costs, and downtime.",
      href: "/reports/maintenance",
      icon: Wrench,
      color: "text-rose-700 bg-rose-50 border-rose-200",
    },
    {
      title: "Stock & Inventory",
      description: "Consumable parts, quantities on hand, and reorder threshold alerts.",
      href: "/reports/stock",
      icon: Boxes,
      color: "text-cyan-700 bg-cyan-50 border-cyan-200",
    },
    {
      title: "Asset Requisitions",
      description: "Employee purchase requests, justification, and approval tiers.",
      href: "/reports/requests",
      icon: ClipboardList,
      color: "text-teal-700 bg-teal-50 border-teal-200",
    },
    {
      title: "Audit & Security Ledger",
      description: "Immutable compliance logs, actor identities, and security events.",
      href: "/reports/audit",
      icon: ShieldCheck,
      color: "text-indigo-700 bg-indigo-50 border-indigo-200",
    },
    {
      title: "Physical Scanning Ledger",
      description: "Real-time verification events, QR/barcode hardware scans, and audits.",
      href: "/reports/scans",
      icon: QrCode,
      color: "text-slate-700 bg-slate-100 border-slate-200",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Executive Reports & Analytics"
        description="Real-time transactional metrics, straight-line depreciation amortization, and audit ledgers."
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Reports & Analytics" },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : data ? (
        <>
          {/* Financial & Valuation KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/90 rounded-lg p-4 shadow-subtle">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Total Active Assets</span>
                <PackageCheck className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900">
                {data.assets?.total?.toLocaleString() ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Managed capital assets</p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-lg p-4 shadow-subtle">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Gross Acquisition Cost</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900">
                ${(data.assets?.acquisitionCost ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Original purchase valuation</p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-lg p-4 shadow-subtle">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Current Net Book Value</span>
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-teal-700">
                ${(data.assets?.bookValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Carrying balance post-depreciation</p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-lg p-4 shadow-subtle">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Accumulated Depreciation</span>
                <TrendingDown className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold font-mono text-amber-700">
                ${(data.assets?.accumulatedDepreciation ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Straight-line amortized to date</p>
            </div>
          </div>

          {/* Operational Status Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {[
              { label: "Available", val: data.assets?.available, color: "text-emerald-700 border-emerald-200 bg-emerald-50/60" },
              { label: "Assigned", val: data.assets?.assigned, color: "text-blue-700 border-blue-200 bg-blue-50/60" },
              { label: "Under Maint.", val: data.assets?.underMaintenance, color: "text-amber-700 border-amber-200 bg-amber-50/60" },
              { label: "Damaged", val: data.assets?.damaged, color: "text-rose-700 border-rose-200 bg-rose-50/60" },
              { label: "In Transit", val: data.assets?.inTransit, color: "text-purple-700 border-purple-200 bg-purple-50/60" },
              { label: "Disputed", val: data.assets?.disputed, color: "text-red-700 border-red-200 bg-red-50/60" },
              { label: "Retired", val: data.assets?.retired, color: "text-slate-600 border-slate-200 bg-slate-50" },
            ].map((st) => (
              <div key={st.label} className={`border rounded-lg p-2.5 text-center ${st.color}`}>
                <div className="text-lg font-bold font-mono">{st.val ?? 0}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider mt-0.5">{st.label}</div>
              </div>
            ))}
          </div>

          {/* Operational Counts Card */}
          <div className="bg-white border border-slate-200/90 rounded-lg p-4 shadow-subtle">
            <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              Operational Activity Highlights
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Pending Requisitions</span>
                <span className="text-base font-bold font-mono text-slate-900">{data.operations?.pendingRequests ?? 0}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Pending Approvals</span>
                <span className="text-base font-bold font-mono text-amber-700">{data.operations?.pendingApprovals ?? 0}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Open Work Orders</span>
                <span className="text-base font-bold font-mono text-rose-700">{data.operations?.openMaintenance ?? 0}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Inter-Company Transfers</span>
                <span className="text-base font-bold font-mono text-purple-700">{data.operations?.interCompanyTransfers ?? 0}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Low Stock Alerts</span>
                <span className="text-base font-bold font-mono text-amber-700">{data.operations?.lowStockItems ?? 0}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Total Scans Audited</span>
                <span className="text-base font-bold font-mono text-teal-700">{data.operations?.totalScans ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Common Admin Global Breakdown */}
          {data.companyBreakdown && data.companyBreakdown.length > 0 && (
            <div className="bg-white border border-slate-200/90 rounded-lg p-4 shadow-subtle">
              <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-teal-600" />
                Multi-Tenant Company Breakdown (Global Overview)
              </h2>
              <div className="overflow-x-auto rounded border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Company</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Assets</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Acquisition Cost</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Book Value</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Accumulated Dep.</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Available</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Assigned</th>
                      <th className="py-2.5 px-3 font-semibold text-center">In Maint.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.companyBreakdown.map((c: any) => (
                      <tr key={c.company_id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          <div>{c.company_name}</div>
                          <span className="text-[10px] text-teal-700 uppercase font-mono">{c.company_code}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-800 font-mono font-medium">{c.total_assets}</td>
                        <td className="py-2.5 px-3 text-right text-slate-700 font-mono">
                          ${Number(c.acquisition_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right text-teal-700 font-mono font-semibold">
                          ${Number(c.book_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right text-amber-700 font-mono">
                          ${Number(c.accumulated_depreciation || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-emerald-700">{c.available_assets}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-blue-700">{c.assigned_assets}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-amber-700">{c.under_maintenance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Quick Links to 9 Specialized Reports */}
          <div>
            <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3">
              Specialized Management Reports
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {reportCards.map((rc) => {
                const Icon = rc.icon;
                return (
                  <Link
                    key={rc.href}
                    href={rc.href}
                    className="bg-white border border-slate-200/90 hover:border-slate-300 p-4 rounded-lg shadow-subtle hover:shadow-card transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className={`p-2 rounded-md border ${rc.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 group-hover:text-teal-700 transition-colors">
                          {rc.title}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{rc.description}</p>
                    </div>
                    <div className="mt-3.5 pt-2.5 border-t border-slate-100 text-xs font-medium text-teal-700 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                      <span>View & Export Report</span>
                      <span>&rarr;</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
