"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  DollarSign,
  AlertCircle,
  FileCheck2,
  Calendar,
  Layers,
  Wrench,
  Trash2,
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

interface DamageInspectionItem {
  id: string;
  inspection_code: string;
  asset_id: string;
  return_id: string | null;
  company_id: string;
  inspector_id: string;
  inspection_date: string;
  damage_type: string;
  severity: "MINOR" | "MODERATE" | "MAJOR" | "CRITICAL";
  description: string;
  estimated_repair_cost: number;
  recommendation: "REPAIR" | "REPLACE_PARTS" | "SCRAP_RECOMMENDED" | "INSURANCE_CLAIM";
  status: "PENDING_DECISION" | "APPROVED_FOR_REPAIR" | "ESCALATED_DISPOSAL" | "RESOLVED" | "CLOSED";
  resolution_notes: string | null;
  created_at: string;
  asset_tag: string;
  asset_name: string;
  serial_number: string | null;
  inspector_username: string;
  return_code: string | null;
}

interface AssetItem {
  id: string;
  asset_tag: string;
  name: string;
  status: string;
}

interface CompanyOption {
  id: string;
  name: string;
  code: string;
}

export default function DamageInspectionsPage() {
  const { hasPermission, user } = useAuth();

  const [inspections, setInspections] = useState<DamageInspectionItem[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Record Inspection Modal
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [damageType, setDamageType] = useState("PHYSICAL_IMPACT");
  const [severity, setSeverity] = useState<"MINOR" | "MODERATE" | "MAJOR" | "CRITICAL">("MODERATE");
  const [description, setDescription] = useState("");
  const [estimatedRepairCost, setEstimatedRepairCost] = useState("0");
  const [recommendation, setRecommendation] = useState<"REPAIR" | "REPLACE_PARTS" | "SCRAP_RECOMMENDED" | "INSURANCE_CLAIM">("REPAIR");
  const [isSubmittingRecord, setIsSubmittingRecord] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  // Resolve Decision Modal
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [targetInspection, setTargetInspection] = useState<DamageInspectionItem | null>(null);
  const [decisionStatus, setDecisionStatus] = useState<"APPROVED_FOR_REPAIR" | "ESCALATED_DISPOSAL" | "RESOLVED">("APPROVED_FOR_REPAIR");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const canInspect = user?.isCommonAdmin || hasPermission("assets:update") || hasPermission("maintenance:create");

  const loadInspections = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (severityFilter) params.set("severity", severityFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (companyFilter) params.set("companyId", companyFilter);

      const res = await apiClient.get<any>(`/damage-inspections?${params.toString()}`);
      const data = res?.inspections || res?.items || res?.data?.inspections || [];
      const totalCount = res?.total || res?.data?.total || 0;
      const pages = res?.totalPages || Math.ceil(totalCount / limit) || 1;

      setInspections(data);
      setTotal(totalCount);
      setTotalPages(pages);
    } catch (err: any) {
      setError(err.message || "Failed to load damage inspections.");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, severityFilter, statusFilter, companyFilter]);

  const loadDropdowns = useCallback(async () => {
    try {
      if (user?.isCommonAdmin) {
        const compRes = await apiClient.get<any>("/companies");
        if (compRes) {
          setCompanies(compRes.companies || compRes.data?.companies || (Array.isArray(compRes) ? compRes : []));
        }
      }

      // Fetch assets
      const assetParams = new URLSearchParams({ limit: "150" });
      if (companyFilter) assetParams.set("companyId", companyFilter);
      const assetRes = await apiClient.get<any>(`/assets?${assetParams.toString()}`);
      const assetsList = assetRes?.assets || assetRes?.items || [];
      setAssets(assetsList);
    } catch (err: any) {
      console.error("Dropdown load error:", err);
    }
  }, [user?.isCommonAdmin, companyFilter]);

  useEffect(() => {
    loadInspections();
  }, [loadInspections]);

  useEffect(() => {
    loadDropdowns();
  }, [loadDropdowns]);

  const handleOpenRecordModal = () => {
    setSelectedAssetId("");
    setDamageType("PHYSICAL_IMPACT");
    setSeverity("MODERATE");
    setDescription("");
    setEstimatedRepairCost("0");
    setRecommendation("REPAIR");
    setRecordError(null);
    setIsRecordModalOpen(true);
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) {
      setRecordError("Please select the damaged asset.");
      return;
    }
    if (!description.trim()) {
      setRecordError("Please provide a description of the damage.");
      return;
    }

    setIsSubmittingRecord(true);
    setRecordError(null);

    try {
      await apiClient.post("/damage-inspections", {
        assetId: selectedAssetId,
        damageType,
        severity,
        description: description.trim(),
        estimatedRepairCost: parseFloat(estimatedRepairCost) || 0,
        recommendation,
      });

      setIsRecordModalOpen(false);
      loadInspections();
    } catch (err: any) {
      setRecordError(err.message || "Failed to record damage inspection.");
    } finally {
      setIsSubmittingRecord(false);
    }
  };

  const handleOpenResolveModal = (insp: DamageInspectionItem) => {
    setTargetInspection(insp);
    setDecisionStatus(insp.recommendation === "SCRAP_RECOMMENDED" ? "ESCALATED_DISPOSAL" : "APPROVED_FOR_REPAIR");
    setResolutionNotes("");
    setResolveError(null);
    setIsResolveModalOpen(true);
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetInspection) return;

    setIsSubmittingResolve(true);
    setResolveError(null);

    try {
      await apiClient.post(`/damage-inspections/${targetInspection.id}/resolve`, {
        status: decisionStatus,
        resolutionNotes: resolutionNotes.trim() || undefined,
      });

      setIsResolveModalOpen(false);
      setTargetInspection(null);
      loadInspections();
    } catch (err: any) {
      setResolveError(err.message || "Failed to record decision.");
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  const getSeverityBadge = (s: string) => {
    switch (s) {
      case "CRITICAL":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
            CRITICAL
          </span>
        );
      case "MAJOR":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            MAJOR
          </span>
        );
      case "MODERATE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            MODERATE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
            MINOR
          </span>
        );
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "PENDING_DECISION":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Decision Pending
          </span>
        );
      case "APPROVED_FOR_REPAIR":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Wrench className="w-3 h-3 text-emerald-600" />
            Approved Repair
          </span>
        );
      case "ESCALATED_DISPOSAL":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <Trash2 className="w-3 h-3 text-rose-600" />
            Disposal Escalated
          </span>
        );
      case "RESOLVED":
      case "CLOSED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <CheckCircle2 className="w-3 h-3 text-slate-600" />
            {st}
          </span>
        );
      default:
        return <Badge variant="neutral">{st}</Badge>;
    }
  };

  const filteredInspections = inspections.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.inspection_code.toLowerCase().includes(q) ||
      item.asset_tag.toLowerCase().includes(q) ||
      item.asset_name.toLowerCase().includes(q) ||
      item.damage_type.toLowerCase().includes(q) ||
      item.inspector_username.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Damage Inspections & Incident Triage"
        description="Record damage incidents, categorize severity levels, estimate repair impacts, and authorize repair or disposal workflows."
        icon={<AlertTriangle className="w-5 h-5 text-teal-600" />}
        breadcrumbs={[
          { label: "Operations" },
          { label: "Damage Inspections" },
        ]}
        actions={
          canInspect ? (
            <Button
              onClick={handleOpenRecordModal}
              variant="primary"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              Record Damage Inspection
            </Button>
          ) : undefined
        }
      />

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search code, asset tag, damage type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setPage(1);
              }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Severities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="MAJOR">MAJOR</option>
              <option value="MODERATE">MODERATE</option>
              <option value="MINOR">MINOR</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Statuses</option>
              <option value="PENDING_DECISION">PENDING DECISION</option>
              <option value="APPROVED_FOR_REPAIR">APPROVED FOR REPAIR</option>
              <option value="ESCALATED_DISPOSAL">ESCALATED DISPOSAL</option>
              <option value="RESOLVED">RESOLVED</option>
            </select>

            {user?.isCommonAdmin && companies.length > 0 && (
              <select
                value={companyFilter}
                onChange={(e) => {
                  setCompanyFilter(e.target.value);
                  setPage(1);
                }}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="text-xs text-slate-500 self-center">
          Showing <span className="font-semibold text-slate-700">{filteredInspections.length}</span> of{" "}
          <span className="font-semibold text-slate-700">{total}</span> records
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : error ? (
          <div className="p-8 text-center text-rose-600 space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="font-medium">{error}</p>
          </div>
        ) : filteredInspections.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-semibold text-slate-700">No Damage Inspections Found</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              There are no damage inspection records matching the selected filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Inspection Code</th>
                  <th className="px-6 py-3.5">Asset</th>
                  <th className="px-6 py-3.5">Severity & Type</th>
                  <th className="px-6 py-3.5">Est. Repair Cost</th>
                  <th className="px-6 py-3.5">Recommendation</th>
                  <th className="px-6 py-3.5">Decision Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInspections.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-slate-900 text-xs block">
                        {item.inspection_code}
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.inspection_date).toLocaleDateString()}
                      </span>
                      {item.return_code && (
                        <span className="text-[10px] text-slate-400 font-mono block">
                          Ret: {item.return_code}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <Link
                          href={`/assets/${item.asset_id}`}
                          className="font-mono font-bold text-teal-700 hover:underline"
                        >
                          {item.asset_tag}
                        </Link>
                        <span className="font-medium text-slate-800 text-sm">{item.asset_name}</span>
                        {item.serial_number && (
                          <span className="text-xs text-slate-400 font-mono">SN: {item.serial_number}</span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        {getSeverityBadge(item.severity)}
                        <span className="text-xs font-medium text-slate-700">
                          {item.damage_type.replace(/_/g, " ")}
                        </span>
                        <p className="text-[11px] text-slate-500 line-clamp-1 max-w-xs">
                          {item.description}
                        </p>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className="font-mono font-semibold text-slate-800 text-sm">
                        ${Number(item.estimated_repair_cost).toLocaleString()}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {item.recommendation.replace(/_/g, " ")}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        {getStatusBadge(item.status)}
                        {item.resolution_notes && (
                          <span className="text-[11px] text-slate-400 line-clamp-1">
                            {item.resolution_notes}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.status === "PENDING_DECISION" && canInspect && (
                          <button
                            onClick={() => handleOpenResolveModal(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-medium transition"
                          >
                            <FileCheck2 className="w-3.5 h-3.5" />
                            Resolve Decision
                          </button>
                        )}
                        <Link
                          href={`/assets/${item.asset_id}`}
                          className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-slate-100 rounded-lg transition"
                          title="View Asset Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 text-xs font-medium border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 text-xs font-medium border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Record Inspection Modal */}
      <Modal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        title="Record Formal Damage Inspection"
        maxWidth="lg"
      >
        <form onSubmit={handleRecordSubmit} className="space-y-4">
          {recordError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{recordError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Select Damaged Asset *
            </label>
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              required
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">-- Choose Asset --</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.asset_tag} — {a.name} ({a.status})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Damage Incident Type
              </label>
              <select
                value={damageType}
                onChange={(e) => setDamageType(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="PHYSICAL_IMPACT">Physical Impact / Dropped</option>
                <option value="LIQUID_SPILL">Liquid Ingress / Spill</option>
                <option value="ELECTRICAL_SURGE">Electrical Short / Surge</option>
                <option value="COMPONENT_FAILURE">Component / Motherboard Failure</option>
                <option value="WEAR_AND_TEAR">Abnormal Wear & Tear</option>
                <option value="OTHER">Other Damage</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Damage Severity
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="MINOR">MINOR — Cosmetic only</option>
                <option value="MODERATE">MODERATE — Partial impairment</option>
                <option value="MAJOR">MAJOR — Non-functional, repairable</option>
                <option value="CRITICAL">CRITICAL — Severe destructive damage</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Description of Damage & Findings *
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="e.g. Cracked display assembly and unseated bezel after drop impact..."
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Estimated Repair Cost ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={estimatedRepairCost}
                onChange={(e) => setEstimatedRepairCost(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Inspector Recommendation
              </label>
              <select
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value as any)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="REPAIR">REPAIR</option>
                <option value="REPLACE_PARTS">REPLACE PARTS</option>
                <option value="SCRAP_RECOMMENDED">SCRAP RECOMMENDED</option>
                <option value="INSURANCE_CLAIM">INSURANCE CLAIM</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsRecordModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingRecord}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition"
            >
              {isSubmittingRecord ? "Submitting..." : "Save Damage Inspection"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Resolve Decision Modal */}
      <Modal
        isOpen={isResolveModalOpen}
        onClose={() => setIsResolveModalOpen(false)}
        title="Resolve Damage Triage Decision"
        maxWidth="md"
      >
        <form onSubmit={handleResolveSubmit} className="space-y-4">
          {resolveError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{resolveError}</span>
            </div>
          )}

          {targetInspection && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm space-y-1">
              <div className="font-semibold text-slate-800">
                {targetInspection.asset_tag} — {targetInspection.asset_name}
              </div>
              <div className="text-xs text-slate-500">
                Code: {targetInspection.inspection_code} | Severity: {targetInspection.severity} | Est. Cost: ${Number(targetInspection.estimated_repair_cost).toLocaleString()}
              </div>
              <div className="text-xs text-teal-700 font-medium">
                Recommendation: {targetInspection.recommendation.replace(/_/g, " ")}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Executive Decision *
            </label>
            <select
              value={decisionStatus}
              onChange={(e) => setDecisionStatus(e.target.value as any)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="APPROVED_FOR_REPAIR">APPROVE FOR REPAIR (Authorize Maintenance Work Order)</option>
              <option value="ESCALATED_DISPOSAL">ESCALATE FOR DISPOSAL (Flag for Write-Off / Scrap)</option>
              <option value="RESOLVED">RESOLVE (Minor Damage / Retain Operational State)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Decision Notes & Justification
            </label>
            <textarea
              rows={3}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="e.g. Repair quote verified with vendor, authorized expenditure under $500 threshold..."
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsResolveModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingResolve}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition"
            >
              {isSubmittingResolve ? "Saving..." : "Confirm Decision"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
