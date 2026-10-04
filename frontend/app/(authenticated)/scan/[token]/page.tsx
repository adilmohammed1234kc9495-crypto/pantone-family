"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  QrCode,
  Barcode,
  PackageCheck,
  UserCheck,
  RotateCcw,
  ArrowLeftRight,
  Wrench,
  AlertTriangle,
  CheckSquare,
  ShieldAlert,
  ArrowLeft,
  Printer,
  Calendar,
  Building2,
  MapPin,
  DollarSign,
  Clock,
  ExternalLink,
  RefreshCw,
  FileCheck2,
} from "lucide-react";
import { scanApi, apiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

export default function AssetScanActionPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;
  const { user } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [scans, setScans] = useState<any[]>([]);
  const [loadingScans, setLoadingScans] = useState<boolean>(false);

  // Action Modals State
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [modalFeedback, setModalFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form states
  const [formData, setFormData] = useState<any>({});

  const loadAssetData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await scanApi.resolveByToken(token, "QR", "WEB_CAMERA");
      setData(res.data || res);

      // Load scans history
      const assetId = res.data?.asset?.id || res.asset?.id;
      if (assetId) {
        loadScanHistory(assetId);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to resolve scanned asset.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadScanHistory = async (assetId: string) => {
    try {
      setLoadingScans(true);
      const res = await scanApi.getAssetScans(assetId);
      setScans(res.data?.scans || res.scans || []);
    } catch {
      // ignore
    } finally {
      setLoadingScans(false);
    }
  };

  useEffect(() => {
    loadAssetData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const asset = data?.asset;
  const allowedActions: string[] = data?.allowedActions || [];
  const activeTransfer = data?.activeTransfer;

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset) return;
    setSubmitting(true);
    setModalFeedback(null);

    try {
      if (activeModal === "assign") {
        await apiClient.post("/assignments", {
          assetId: asset.id,
          employeeId: formData.employeeId,
          assignedDate: formData.assignedDate || new Date().toISOString().split("T")[0],
          notes: formData.notes,
        });
        setModalFeedback({ type: "success", message: "Asset successfully assigned to custodian." });
      } else if (activeModal === "return") {
        await apiClient.post("/returns", {
          assetId: asset.id,
          returnDate: formData.returnDate || new Date().toISOString().split("T")[0],
          condition: formData.condition || "GOOD",
          notes: formData.notes,
        });
        setModalFeedback({ type: "success", message: "Asset return processed successfully." });
      } else if (activeModal === "work_order") {
        await apiClient.post("/maintenance", {
          assetId: asset.id,
          problem: formData.problem,
          priority: formData.priority || "MEDIUM",
          notes: formData.notes,
        });
        setModalFeedback({ type: "success", message: "Maintenance work order reported." });
      } else if (activeModal === "confirm_receipt") {
        const transferId = activeTransfer?.id || formData.transferId;
        await apiClient.post(`/transfers/${transferId}/confirm-receipt`, {
          notes: formData.notes || "Receipt confirmed via physical barcode/QR scanning verification.",
        });
        setModalFeedback({ type: "success", message: "Transfer receipt confirmed! Asset ownership updated." });
      } else if (activeModal === "dispute") {
        const transferId = activeTransfer?.id || formData.transferId;
        await apiClient.post(`/transfers/${transferId}/dispute`, {
          disputeReason: formData.disputeReason,
        });
        setModalFeedback({ type: "success", message: "Transfer dispute submitted for administrative review." });
      }

      setTimeout(() => {
        setActiveModal(null);
        setModalFeedback(null);
        loadAssetData();
      }, 1500);
    } catch (err: any) {
      setModalFeedback({
        type: "error",
        message: err.response?.data?.message || err.message || "Action failed to execute.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">AVAILABLE</span>;
      case "ASSIGNED":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">ASSIGNED</span>;
      case "UNDER_MAINTENANCE":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">UNDER MAINTENANCE</span>;
      case "IN_TRANSIT":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">IN TRANSIT</span>;
      case "DAMAGED":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">DAMAGED</span>;
      case "DISPUTED":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">DISPUTED</span>;
      case "RETIRED":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">RETIRED</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-600">Resolving physical asset token...</p>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-white rounded-2xl border border-red-200 p-8 shadow-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Physical Scan Rejection
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {error || "Scanned identity token cannot be resolved to any authorized asset record."}
          </p>
          <div className="p-4 bg-slate-50 rounded-xl text-left text-xs text-slate-600 space-y-1 font-mono">
            <p><span className="font-semibold text-slate-700">Scanned Token:</span> {token}</p>
            <p><span className="font-semibold text-slate-700">Authenticated User:</span> {user?.username} ({user?.roleName})</p>
            <p><span className="font-semibold text-slate-700">Company Context:</span> {user?.companyName || "Global Common Admin"}</p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              href="/scan"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Scan Another Asset
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Page Header */}
      <PageHeader
        title={asset.name}
        description={`Tag: ${asset.asset_tag} • Serial: ${asset.serial_number || "N/A"}`}
        breadcrumbs={[
          { label: "Scan Station", href: "/scan" },
          { label: asset.asset_tag },
        ]}
        badge={getStatusBadge(asset.status)}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/assets/${asset.id}`}>
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4" />
                Full Asset Profile
              </Button>
            </Link>
            <Link href={`/assets/labels?assetId=${asset.id}`}>
              <Button variant="primary" size="sm">
                <Printer className="w-4 h-4" />
                Print Label
              </Button>
            </Link>
          </div>
        }
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Machine Identity & Status Card */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <QrCode className="w-4 h-4 text-teal-600" />
              Machine Identity
            </h3>

            {/* QR / Barcode Visuals */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              {data.qrSvg ? (
                <div
                  className="w-40 h-40 bg-white p-2 rounded-lg border border-slate-200 shadow-xs flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: data.qrSvg }}
                />
              ) : (
                <div className="w-40 h-40 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-slate-400">
                  <QrCode className="w-16 h-16" />
                </div>
              )}
              <div className="text-center font-mono text-[11px] text-slate-500">
                asset:{asset.id}
              </div>

              {/* Barcode SVG */}
              {data.barcodeSvg && (
                <div
                  className="w-full flex justify-center overflow-hidden py-1"
                  dangerouslySetInnerHTML={{ __html: data.barcodeSvg }}
                />
              )}
              <div className="text-center font-mono text-xs font-bold text-slate-800 tracking-wider">
                {asset.barcode || `BAR-${asset.asset_tag}`}
              </div>
            </div>

            {/* Key Metadata Table */}
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Company</span>
                <span className="font-semibold text-slate-800">{asset.company_name || "N/A"}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Category</span>
                <span className="font-semibold text-slate-800">{asset.category_name || "N/A"}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Branch</span>
                <span className="font-semibold text-slate-800">{asset.branch_name || "N/A"}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Location</span>
                <span className="font-semibold text-slate-800">{asset.location_name || "N/A"}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Custodian</span>
                <span className="font-semibold text-slate-800">
                  {asset.assigned_to_name ? `${asset.assigned_to_name} (${asset.assigned_to_code || ""})` : "Unassigned"}
                </span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Current Book Value</span>
                <span className="font-bold text-teal-700">
                  ${Number(asset.current_book_value || asset.purchase_cost || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Physical Scan History */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Physical Scan Ledger
            </h3>

            {loadingScans ? (
              <div className="py-6 text-center text-xs text-slate-400">Loading scan events...</div>
            ) : scans.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                First physical scan recorded just now.
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {scans.map((s: any) => (
                  <div key={s.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{s.scan_type} Scan</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(s.scanned_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center justify-between">
                      <span>Source: {s.source?.replace("_", " ")}</span>
                      <span>By: {s.scanned_by_username || "Authorized User"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Operational Actions Matrix (Context-Aware) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Transfer Notice (if IN_TRANSIT) */}
          {activeTransfer && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                <ArrowLeftRight className="w-4 h-4 text-indigo-600" />
                Active Dual-Authorization Inter-Company Transfer
              </div>
              <p className="text-xs text-indigo-700">
                Transfer <strong>{activeTransfer.transfer_number}</strong> from <strong>{activeTransfer.from_company_name}</strong> to <strong>{activeTransfer.to_company_name}</strong>.
              </p>
              <p className="text-[11px] text-indigo-600">
                Destination company admin must physically scan and inspect the asset to confirm receipt or log a dispute.
              </p>
            </div>
          )}

          {/* Action Cards Container */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Context-Aware Operational Actions
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                The operations below are dynamically authorized based on current lifecycle state (<strong>{asset.status}</strong>) and your security role.
              </p>
            </div>

            {allowedActions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                No state-changing actions available for this asset in its current status ({asset.status}).
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. ASSIGN ACTION */}
                {allowedActions.includes("assign") && (
                  <button
                    onClick={() => setActiveModal("assign")}
                    className="p-4 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/40 text-left transition-all group flex items-start gap-3"
                  >
                    <span className="p-2.5 bg-teal-100 text-teal-700 rounded-lg group-hover:scale-105 transition-transform">
                      <UserCheck className="w-5 h-5" />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                        Assign Custody
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Hand over asset to an employee with physical handover record.
                      </p>
                    </div>
                  </button>
                )}

                {/* 2. RETURN ACTION */}
                {allowedActions.includes("return") && (
                  <button
                    onClick={() => setActiveModal("return")}
                    className="p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-left transition-all group flex items-start gap-3"
                  >
                    <span className="p-2.5 bg-blue-100 text-blue-700 rounded-lg group-hover:scale-105 transition-transform">
                      <RotateCcw className="w-5 h-5" />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                        Process Return
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Accept custody return from custodian and inspect physical condition.
                      </p>
                    </div>
                  </button>
                )}

                {/* 3. MAINTENANCE / WORK ORDER */}
                {(allowedActions.includes("maintenance") || allowedActions.includes("work_order")) && (
                  <button
                    onClick={() => setActiveModal("work_order")}
                    className="p-4 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/40 text-left transition-all group flex items-start gap-3"
                  >
                    <span className="p-2.5 bg-amber-100 text-amber-700 rounded-lg group-hover:scale-105 transition-transform">
                      <Wrench className="w-5 h-5" />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                        Log Maintenance
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Create maintenance order, repair ticket, or servicing request.
                      </p>
                    </div>
                  </button>
                )}

                {/* 4. CONFIRM RECEIPT (Dual-Auth Handover) */}
                {allowedActions.includes("confirm_receipt") && (
                  <button
                    onClick={() => setActiveModal("confirm_receipt")}
                    className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50/60 hover:bg-emerald-100/70 text-left transition-all group flex items-start gap-3"
                  >
                    <span className="p-2.5 bg-emerald-600 text-white rounded-lg group-hover:scale-105 transition-transform shadow-xs">
                      <FileCheck2 className="w-5 h-5" />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-950">
                        Confirm Transfer Receipt
                      </h4>
                      <p className="text-xs text-emerald-800 mt-1">
                        Dual Authorization: Confirm physical handover and transfer ownership to this company.
                      </p>
                    </div>
                  </button>
                )}

                {/* 5. DISPUTE TRANSFER */}
                {allowedActions.includes("dispute") && (
                  <button
                    onClick={() => setActiveModal("dispute")}
                    className="p-4 rounded-xl border-2 border-rose-400 bg-rose-50/50 hover:bg-rose-100/70 text-left transition-all group flex items-start gap-3"
                  >
                    <span className="p-2.5 bg-rose-600 text-white rounded-lg group-hover:scale-105 transition-transform shadow-xs">
                      <AlertTriangle className="w-5 h-5" />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-rose-950">
                        Dispute Transfer
                      </h4>
                      <p className="text-xs text-rose-800 mt-1">
                        Report physical discrepancies, damaged items, or missing components.
                      </p>
                    </div>
                  </button>
                )}

                {/* 6. INITIATE TRANSFER */}
                {allowedActions.includes("transfer") && (
                  <Link
                    href={`/transfers?assetId=${asset.id}`}
                    className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 text-left transition-all group flex items-start gap-3"
                  >
                    <span className="p-2.5 bg-indigo-100 text-indigo-700 rounded-lg group-hover:scale-105 transition-transform">
                      <ArrowLeftRight className="w-5 h-5" />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                        Initiate Transfer
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Internal branch transfer or inter-company relocation workflow.
                      </p>
                    </div>
                  </Link>
                )}

                {/* 7. DAMAGE INSPECTION */}
                {allowedActions.includes("damage_inspection") && (
                  <Link
                    href={`/damage-inspections?assetId=${asset.id}`}
                    className="p-4 rounded-xl border border-slate-200 hover:border-red-500 hover:bg-red-50/40 text-left transition-all group flex items-start gap-3"
                  >
                    <span className="p-2.5 bg-red-100 text-red-700 rounded-lg group-hover:scale-105 transition-transform">
                      <AlertTriangle className="w-5 h-5" />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-red-700 transition-colors">
                        Damage Assessment
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Log damage inspection report with condition and photos.
                      </p>
                    </div>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Modals */}
      {activeModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {activeModal === "assign" && "Assign Custody Handover"}
                {activeModal === "return" && "Process Physical Return"}
                {activeModal === "work_order" && "Log Maintenance Ticket"}
                {activeModal === "confirm_receipt" && "Dual Authorization: Confirm Receipt"}
                {activeModal === "dispute" && "Raise Transfer Dispute"}
              </h3>
              <button
                onClick={() => {
                  setActiveModal(null);
                  setModalFeedback(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            {modalFeedback && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  modalFeedback.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {modalFeedback.message}
              </div>
            )}

            <form onSubmit={handleActionSubmit} className="space-y-4 text-xs">
              {/* ASSIGN FORM FIELDS */}
              {activeModal === "assign" && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Employee ID / Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Employee UUID or Code"
                      value={formData.employeeId || ""}
                      onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Assignment Date</label>
                    <input
                      type="date"
                      defaultValue={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setFormData({ ...formData, assignedDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Handover Notes</label>
                    <textarea
                      rows={3}
                      placeholder="Details on physical condition, accessories handed over..."
                      value={formData.notes || ""}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </>
              )}

              {/* RETURN FORM FIELDS */}
              {activeModal === "return" && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Physical Condition on Return</label>
                    <select
                      value={formData.condition || "GOOD"}
                      onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    >
                      <option value="EXCELLENT">Excellent (Like New)</option>
                      <option value="GOOD">Good (Normal Wear)</option>
                      <option value="FAIR">Fair (Minor cosmetic issues)</option>
                      <option value="POOR">Poor (Requires servicing)</option>
                      <option value="DAMAGED">Damaged (Faulty/Broken)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Return Inspection Notes</label>
                    <textarea
                      rows={3}
                      placeholder="Inspected components, accessories returned..."
                      value={formData.notes || ""}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </>
              )}

              {/* MAINTENANCE WORK ORDER FIELDS */}
              {activeModal === "work_order" && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Problem Description</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Describe issue, fault symptoms, or service required..."
                      value={formData.problem || ""}
                      onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                    <select
                      value={formData.priority || "MEDIUM"}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    >
                      <option value="LOW">Low Priority</option>
                      <option value="MEDIUM">Medium Priority</option>
                      <option value="HIGH">High Priority</option>
                      <option value="CRITICAL">Critical Breakdown</option>
                    </select>
                  </div>
                </>
              )}

              {/* CONFIRM RECEIPT FIELDS */}
              {activeModal === "confirm_receipt" && (
                <div>
                  <p className="text-slate-600 mb-3">
                    Confirm that physical asset <strong>{asset.name}</strong> ({asset.asset_tag}) has been received at the destination facility in satisfactory condition.
                  </p>
                  <label className="block font-semibold text-slate-700 mb-1">Receipt Verification Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Physical verification remarks (e.g. Scanned QR on arrival, condition good)..."
                    value={formData.notes || ""}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              )}

              {/* DISPUTE FIELDS */}
              {activeModal === "dispute" && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dispute Reason & Details</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Explain discrepancy (e.g. Broken screen, serial number mismatch, missing components)..."
                    value={formData.disputeReason || ""}
                    onChange={(e) => setFormData({ ...formData, disputeReason: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setModalFeedback(null);
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center gap-1.5"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Submit Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
