"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiClient, scanApi } from "@/lib/api";
import {
  Package,
  ArrowLeft,
  Building2,
  GitBranch,
  Layers,
  MapPin,
  Truck,
  Calculator,
  FileText,
  Camera,
  Calendar,
  AlertCircle,
  Plus,
  ShieldCheck,
  TrendingDown,
  DollarSign,
  QrCode,
  Barcode,
  Printer,
  UserCheck,
  RotateCcw,
  Wrench,
  Clock,
  CheckCircle2,
  ArrowLeftRight,
  RefreshCw,
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";

interface AssetItem {
  id: string;
  company_id: string;
  company_name: string;
  branch_id: string;
  branch_name: string;
  department_id: string | null;
  department_name: string | null;
  location_id: string | null;
  location_name: string | null;
  category_id: string;
  category_name: string;
  category_code: string;
  vendor_id: string | null;
  vendor_name: string | null;
  asset_tag: string;
  name: string;
  description: string | null;
  serial_number: string | null;
  model_number: string | null;
  purchase_date: string;
  purchase_cost: number;
  currency: string;
  salvage_value: number;
  status: string;
  condition: string;
  depreciation_method: string;
  depreciation_rate_percent: number;
  useful_life_months: number;
  depreciation_start_date: string;
  accumulated_depreciation: number;
  current_book_value: number;
  barcode?: string | null;
  qr_code?: string | null;
  created_at: string;
  updated_at: string;
}

interface DepreciationScheduleItem {
  period: number;
  date: string;
  depreciationExpense: number;
  accumulatedDepreciation: number;
  bookValue: number;
}

interface DocumentItem {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

interface PhotoItem {
  id: string;
  file_name: string;
  file_path: string;
  caption: string | null;
  is_primary: boolean;
  created_at: string;
}

interface CustodyItem {
  id: string;
  asset_id: string;
  employee_id: string;
  employee_first_name: string;
  employee_last_name: string;
  employee_code: string;
  department_name: string | null;
  assigned_at: string;
  return_due_date: string | null;
  status: string;
  is_handed_over: boolean;
  handed_over_at: string | null;
  handover_condition: string | null;
  remarks: string | null;
}

interface ReturnRecordItem {
  id: string;
  return_code: string;
  returned_at: string;
  returned_by: string;
  employee_first_name: string;
  employee_last_name: string;
  employee_code: string;
  condition: string;
  return_reason: string | null;
  inspection_status: string;
  inspected_by_username: string | null;
  functional_status: string | null;
  inspection_notes: string | null;
}

interface DamageInspectionRecordItem {
  id: string;
  inspection_code: string;
  inspection_date: string;
  damage_type: string;
  severity: string;
  description: string;
  estimated_repair_cost: number;
  recommendation: string;
  status: string;
  inspector_username: string;
  resolution_notes: string | null;
}

interface MaintenanceRecordItem {
  id: string;
  maintenance_code: string;
  work_order_number: string | null;
  report_date: string;
  problem: string;
  maintenance_type: string;
  priority: string;
  status: string;
  technician_name: string | null;
  vendor_name: string | null;
  estimated_cost: number;
  actual_cost: number;
  invoice_reference: string | null;
}

interface AssetTransferRecordItem {
  id: string;
  transfer_code: string;
  transfer_type: string;
  from_company_code: string;
  to_company_code: string;
  from_department_name: string | null;
  to_department_name: string | null;
  from_location_name: string | null;
  to_location_name: string | null;
  from_employee_name: string | null;
  to_employee_name: string | null;
  status: string;
  reason: string;
  condition_before: string;
  condition_after: string | null;
  created_at: string;
}

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission, user } = useAuth();
  const assetId = params?.id as string;

  const [asset, setAsset] = useState<AssetItem | null>(null);
  const [schedule, setSchedule] = useState<DepreciationScheduleItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [assignments, setAssignments] = useState<CustodyItem[]>([]);
  const [returns, setReturns] = useState<ReturnRecordItem[]>([]);
  const [damageInspections, setDamageInspections] = useState<DamageInspectionRecordItem[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecordItem[]>([]);
  const [transfers, setTransfers] = useState<AssetTransferRecordItem[]>([]);

  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "depreciation"
    | "organization"
    | "documents"
    | "photos"
    | "custody"
    | "returns"
    | "damage"
    | "maintenance"
    | "transfers"
    | "scans"
  >("overview");

  const [assetScans, setAssetScans] = useState<any[]>([]);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [barcodeSvg, setBarcodeSvg] = useState<string | null>(null);
  const [isRegeneratingQr, setIsRegeneratingQr] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Document modal
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docType, setDocType] = useState("INVOICE");
  const [docName, setDocName] = useState("");
  const [docPath, setDocPath] = useState("");
  const [isSubmittingDoc, setIsSubmittingDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  // Photo modal
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [photoName, setPhotoName] = useState("");
  const [photoPath, setPhotoPath] = useState("");
  const [photoCaption, setPhotoCaption] = useState("");
  const [isSubmittingPhoto, setIsSubmittingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const canManage = user?.isCommonAdmin || hasPermission("assets:update");

  const handleRegenerateQr = async () => {
    if (!assetId) return;
    setIsRegeneratingQr(true);
    try {
      const res = await scanApi.regenerateQr(assetId);
      if (res.data?.qrSvg || res.qrSvg) {
        setQrSvg(res.data?.qrSvg || res.qrSvg);
      }
    } catch (err: any) {
      alert(err.message || "Failed to regenerate QR code");
    } finally {
      setIsRegeneratingQr(false);
    }
  };

  const loadAssetDetails = useCallback(async () => {
    if (!assetId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<any>(`/assets/${assetId}`);
      const assetData = res?.asset || res?.data || res;
      setAsset(assetData);

      // Fetch schedule, documents, photos, custody, returns, damage, maintenance, transfers, QR, barcode, scans in parallel
      const [depRes, docRes, photoRes, assignRes, retRes, dmgRes, maintRes, trfRes, qrRes, barRes, scansRes] = await Promise.allSettled([
        apiClient.get<any>(`/assets/${assetId}/depreciation`),
        apiClient.get<any>(`/assets/${assetId}/documents`),
        apiClient.get<any>(`/assets/${assetId}/photos`),
        apiClient.get<any>(`/assets/${assetId}/assignments`),
        apiClient.get<any>(`/assets/${assetId}/returns`),
        apiClient.get<any>(`/assets/${assetId}/damage-inspections`),
        apiClient.get<any>(`/assets/${assetId}/maintenance`),
        apiClient.get<any>(`/assets/${assetId}/transfers`),
        scanApi.getQr(assetId),
        scanApi.getBarcode(assetId),
        scanApi.getAssetScans(assetId),
      ]);

      if (depRes.status === "fulfilled") {
        const d = depRes.value?.schedule || depRes.value?.data?.schedule || [];
        setSchedule(d);
      }
      if (docRes.status === "fulfilled") {
        const docs = docRes.value?.documents || docRes.value?.data?.documents || [];
        setDocuments(docs);
      }
      if (photoRes.status === "fulfilled") {
        const p = photoRes.value?.photos || photoRes.value?.data?.photos || [];
        setPhotos(p);
      }
      if (assignRes.status === "fulfilled") {
        const a = assignRes.value?.assignments || (Array.isArray(assignRes.value) ? assignRes.value : []);
        setAssignments(a);
      }
      if (retRes.status === "fulfilled") {
        const r = retRes.value?.returns || (Array.isArray(retRes.value) ? retRes.value : []);
        setReturns(r);
      }
      if (dmgRes.status === "fulfilled") {
        const dmg = dmgRes.value?.inspections || (Array.isArray(dmgRes.value) ? dmgRes.value : []);
        setDamageInspections(dmg);
      }
      if (maintRes.status === "fulfilled") {
        const m = maintRes.value?.records || (Array.isArray(maintRes.value) ? maintRes.value : []);
        setMaintenanceRecords(m);
      }
      if (trfRes.status === "fulfilled") {
        const t = trfRes.value?.transfers || (Array.isArray(trfRes.value) ? trfRes.value : []);
        setTransfers(t);
      }
      if (qrRes.status === "fulfilled") {
        setQrSvg(qrRes.value?.qrSvg || qrRes.value?.data?.qrSvg || null);
      }
      if (barRes.status === "fulfilled") {
        setBarcodeSvg(barRes.value?.barcodeSvg || barRes.value?.data?.barcodeSvg || null);
      }
      if (scansRes.status === "fulfilled") {
        const s = scansRes.value?.scans || scansRes.value?.data?.scans || [];
        setAssetScans(s);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load asset details");
    } finally {
      setIsLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    loadAssetDetails();
  }, [loadAssetDetails]);

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim() || !docPath.trim()) {
      setDocError("Document title and valid storage file path are required.");
      return;
    }

    setIsSubmittingDoc(true);
    setDocError(null);
    try {
      await apiClient.post(`/assets/${assetId}/documents`, {
        documentType: docType,
        fileName: docName.trim(),
        filePath: docPath.trim(),
        fileSize: 1024 * 250, // standard placeholder size
        mimeType: "application/pdf",
      });
      setIsDocModalOpen(false);
      setDocName("");
      setDocPath("");
      loadAssetDetails();
    } catch (err: any) {
      setDocError(err.message || "Failed to attach document");
    } finally {
      setIsSubmittingDoc(false);
    }
  };

  const handleAddPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoName.trim() || !photoPath.trim()) {
      setPhotoError("Photo title and image storage path are required.");
      return;
    }

    setIsSubmittingPhoto(true);
    setPhotoError(null);
    try {
      await apiClient.post(`/assets/${assetId}/photos`, {
        fileName: photoName.trim(),
        filePath: photoPath.trim(),
        caption: photoCaption.trim() || undefined,
        isPrimary: photos.length === 0,
      });
      setIsPhotoModalOpen(false);
      setPhotoName("");
      setPhotoPath("");
      setPhotoCaption("");
      loadAssetDetails();
    } catch (err: any) {
      setPhotoError(err.message || "Failed to attach photo");
    } finally {
      setIsSubmittingPhoto(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <TableSkeleton rows={8} cols={4} />
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">Asset Record Unavailable</h2>
        <p className="text-sm text-slate-500">{error || "Asset not found"}</p>
        <Link
          href="/assets"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Asset Register
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header */}
      <PageHeader
        title={asset.name}
        description={`${asset.company_name} • ${asset.branch_name} • ${asset.category_name}`}
        breadcrumbs={[
          { label: "Asset Register", href: "/assets" },
          { label: asset.asset_tag },
        ]}
        icon={
          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200">
            {asset.asset_tag}
          </span>
        }
        badge={
          <div className="flex items-center gap-1.5">
            <StatusBadge status={asset.status} />
            <Badge variant="neutral">{asset.condition}</Badge>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/assets/labels"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Label</span>
            </Link>
            <Link
              href="/assets"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Register</span>
            </Link>
          </div>
        }
      />

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg border border-slate-200/90 bg-white shadow-subtle">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Net Book Value
          </span>
          <div className="text-lg font-bold font-mono text-slate-900 mt-1">
            ${Number(asset.current_book_value || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-slate-200/90 bg-white shadow-subtle">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Acquisition Cost
          </span>
          <div className="text-lg font-bold font-mono text-slate-900 mt-1">
            ${Number(asset.purchase_cost || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-slate-200/90 bg-white shadow-subtle">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Branch / Location
          </span>
          <div className="text-sm font-semibold text-slate-900 mt-1 truncate">
            {asset.branch_name}
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            {[asset.department_name, asset.location_name].filter(Boolean).join(" • ") || "Default Facility"}
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-slate-200/90 bg-white shadow-subtle">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Current Custodian
          </span>
          <div className="text-sm font-semibold text-slate-900 mt-1 truncate">
            {assignments.length > 0 && assignments[0].status === "ACTIVE"
              ? `${assignments[0].employee_first_name} ${assignments[0].employee_last_name}`
              : "In Central Storage"}
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            {assignments.length > 0 && assignments[0].status === "ACTIVE"
              ? assignments[0].employee_code
              : "Available for assignment"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-1 overflow-x-auto text-xs bg-slate-50/50 p-1 rounded-lg border">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "overview"
              ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Overview</span>
        </button>
        <button
          onClick={() => setActiveTab("depreciation")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "depreciation"
              ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>Financial & Depreciation</span>
        </button>
        <button
          onClick={() => setActiveTab("organization")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "organization"
              ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span>Organization</span>
        </button>
        <button
          onClick={() => setActiveTab("custody")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "custody"
              ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Custody ({assignments.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("returns")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "returns"
              ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Returns ({returns.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("damage")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "damage"
              ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Damage ({damageInspections.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("maintenance")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "maintenance"
              ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Work Orders ({maintenanceRecords.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("transfers")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "transfers"
              ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>Transfers ({transfers.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("scans")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "scans"
              ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>Physical Scans ({assetScans.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "documents"
              ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Documents ({documents.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("photos")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "photos"
              ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Photos ({photos.length})</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
                General Specifications
              </h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">Asset Tag</span>
                  <span className="font-mono font-bold text-teal-700 text-base">{asset.asset_tag}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">Category</span>
                  <span className="font-medium text-slate-800">{asset.category_name} ({asset.category_code})</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">Serial Number</span>
                  <span className="font-mono text-slate-700">{asset.serial_number || "None listed"}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">Model Number</span>
                  <span className="text-slate-700">{asset.model_number || "None listed"}</span>
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Description</span>
                <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {asset.description || "No description provided."}
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
                Audit & Record Integrity
              </h2>
              <div className="grid grid-cols-2 gap-4 text-xs text-slate-500">
                <div>
                  <span className="block text-slate-400">Created At</span>
                  <span className="font-medium text-slate-700">{new Date(asset.created_at).toLocaleString()}</span>
                </div>
                <div>
                  <span className="block text-slate-400">Last Modified</span>
                  <span className="font-medium text-slate-700">{new Date(asset.updated_at).toLocaleString()}</span>
                </div>
                <div>
                  <span className="block text-slate-400">Asset Record UUID</span>
                  <span className="font-mono text-slate-600 truncate block">{asset.id}</span>
                </div>
                <div>
                  <span className="block text-slate-400">Depreciation Method</span>
                  <span className="font-medium text-slate-700">{asset.depreciation_method.replace(/_/g, " ")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Side Card: QR Tag & Status */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-center space-y-4">
              <div className="flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                {qrSvg ? (
                  <div
                    className="w-32 h-32 bg-white p-1 rounded-lg border border-slate-200 flex items-center justify-center shadow-xs"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                ) : (
                  <div className="w-32 h-32 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400">
                    <QrCode className="w-16 h-16 text-slate-500" />
                  </div>
                )}
                <span className="font-mono text-[10px] text-slate-500">asset:{asset.id}</span>

                {barcodeSvg && (
                  <div
                    className="w-full flex justify-center max-h-12 overflow-hidden pt-1"
                    dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                  />
                )}
                <span className="font-mono text-xs font-bold text-slate-800 tracking-wider">
                  {asset.barcode || `BAR-${asset.asset_tag}`}
                </span>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase text-slate-500 block">Machine Identity</span>
                <span className="text-xs text-slate-400">Scannable 2D QR & Code 128 linear barcode</span>
              </div>

              <div className="flex items-center justify-center gap-2 pt-1 border-t border-slate-100">
                <Link
                  href={`/assets/labels?assetId=${asset.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-xs font-semibold shadow-2xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Label
                </Link>
                {canManage && (
                  <button
                    onClick={handleRegenerateQr}
                    disabled={isRegeneratingQr}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition-all"
                    title="Regenerate scannable visual code token"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRegeneratingQr ? "animate-spin" : ""}`} />
                    Regen
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                Financial Snapshot
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Original Cost</span>
                  <span className="font-mono font-medium text-slate-800">
                    ${Number(asset.purchase_cost).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Accumulated Dep.</span>
                  <span className="font-mono font-medium text-rose-600">
                    -${Number(asset.accumulated_depreciation || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-100 font-bold">
                  <span className="text-slate-800">Current Book Value</span>
                  <span className="font-mono text-teal-700">
                    ${Number(asset.current_book_value).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Active Custodian Card */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-xs font-semibold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-teal-600" />
                Custody & Assignment
              </h3>
              {(() => {
                const activeAssignment = assignments.find((a) => a.status === "ACTIVE");
                if (activeAssignment) {
                  return (
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-semibold text-slate-900 block">
                          {activeAssignment.employee_first_name} {activeAssignment.employee_last_name}
                        </span>
                        <span className="font-mono text-xs text-slate-500">
                          {activeAssignment.employee_code}
                          {activeAssignment.department_name && ` • ${activeAssignment.department_name}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                        <span>Assigned Date</span>
                        <span className="font-medium text-slate-700">
                          {new Date(activeAssignment.assigned_at).toLocaleDateString()}
                        </span>
                      </div>
                      {activeAssignment.return_due_date && (
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Due Date</span>
                          <span className="font-medium text-slate-700">
                            {new Date(activeAssignment.return_due_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-slate-500">Handover Status</span>
                        {activeAssignment.is_handed_over ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Handed Over
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Pending Handover
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="text-xs text-slate-500 py-2">
                    <span className="font-medium text-slate-700 block">In Available Stock</span>
                    <span className="text-slate-400">This asset is not currently assigned to any custodian.</span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Financial & Depreciation */}
      {activeTab === "depreciation" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 block">Acquisition Cost</span>
              <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                ${Number(asset.purchase_cost).toLocaleString()} {asset.currency}
              </span>
              <span className="text-xs text-slate-400 mt-0.5 block">
                Purchased {asset.purchase_date}
              </span>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 block">Salvage / Scrap Value</span>
              <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                ${Number(asset.salvage_value).toLocaleString()}
              </span>
              <span className="text-xs text-slate-400 mt-0.5 block">Protected minimum value</span>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 block">Useful Life</span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">
                {asset.useful_life_months} Months
              </span>
              <span className="text-xs text-slate-400 mt-0.5 block">
                {(asset.useful_life_months / 12).toFixed(1)} Operating Years
              </span>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 block">Net Book Value</span>
              <span className="text-xl font-bold font-mono text-teal-700 mt-1 block">
                ${Number(asset.current_book_value).toLocaleString()}
              </span>
              <span className="text-xs text-teal-600 mt-0.5 block">
                Live calculated
              </span>
            </div>
          </div>

          {/* Schedule Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Straight-Line Depreciation Amortization Schedule</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Monthly amortized schedule computed using authoritative pure domain depreciation engine
                </p>
              </div>
              <Badge variant="success">{schedule.length} Periods Projected</Badge>
            </div>

            {schedule.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No depreciation schedule generated for this asset.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-100 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="px-6 py-3">Month</th>
                      <th className="px-6 py-3">Amortization Date</th>
                      <th className="px-6 py-3 text-right">Monthly Expense</th>
                      <th className="px-6 py-3 text-right">Accumulated Dep.</th>
                      <th className="px-6 py-3 text-right">Remaining Book Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {schedule.map((item) => (
                      <tr key={item.period} className="hover:bg-slate-50">
                        <td className="px-6 py-2.5 font-sans font-medium text-slate-800">
                          Period {item.period}
                        </td>
                        <td className="px-6 py-2.5 text-slate-500">{item.date}</td>
                        <td className="px-6 py-2.5 text-right text-rose-600 font-medium">
                          ${item.depreciationExpense.toFixed(2)}
                        </td>
                        <td className="px-6 py-2.5 text-right text-slate-700">
                          ${item.accumulatedDepreciation.toFixed(2)}
                        </td>
                        <td className="px-6 py-2.5 text-right text-teal-700 font-bold">
                          ${item.bookValue.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Organization & Location */}
      {activeTab === "organization" && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
            Organizational Custody & Physical Location
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-teal-700 font-semibold">
                <Building2 className="w-4 h-4" />
                <span>Operating Company</span>
              </div>
              <p className="text-slate-800 font-bold text-base">{asset.company_name}</p>
              <p className="text-xs text-slate-500">Autonomous multi-tenant boundary</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-teal-700 font-semibold">
                <GitBranch className="w-4 h-4" />
                <span>Branch / Production Plant</span>
              </div>
              <p className="text-slate-800 font-bold text-base">{asset.branch_name}</p>
              <p className="text-xs text-slate-500">Primary operational facility</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-teal-700 font-semibold">
                <Layers className="w-4 h-4" />
                <span>Department / Cost Center</span>
              </div>
              <p className="text-slate-800 font-bold text-base">{asset.department_name || "Unassigned"}</p>
              <p className="text-xs text-slate-500">Functional cost allocation center</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-teal-700 font-semibold">
                <MapPin className="w-4 h-4" />
                <span>Physical Room / Location</span>
              </div>
              <p className="text-slate-800 font-bold text-base">{asset.location_name || "Unassigned"}</p>
              <p className="text-xs text-slate-500">Room, bay, or storage floor-level placement</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Documents */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Asset Documents & Attachments</h2>
              <p className="text-xs text-slate-500">
                Invoices, warranty agreements, maintenance manuals, and insurance certificates
              </p>
            </div>
            {canManage && (
              <button
                onClick={() => setIsDocModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Attach Document
              </button>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {documents.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">No documents attached</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Attach invoices, user manuals, or warranty paperwork.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {documents.map((doc) => (
                  <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-teal-50 text-teal-600">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 text-sm">{doc.file_name}</div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <Badge variant="neutral">{doc.document_type}</Badge>
                          <span>•</span>
                          <span className="font-mono text-slate-500">{doc.file_path}</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Photos */}
      {activeTab === "photos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Asset Photos & Visual Registry</h2>
              <p className="text-xs text-slate-500">
                Onboarding condition photos, manufacturer serial plates, and physical inspection captures
              </p>
            </div>
            {canManage && (
              <button
                onClick={() => setIsPhotoModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Photo
              </button>
            )}
          </div>

          {photos.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400 shadow-sm">
              <Camera className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No photos registered</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload physical asset photos or nameplate snapshots.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {photos.map((p) => (
                <div key={p.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="h-44 bg-slate-100 flex items-center justify-center text-slate-400">
                    <Camera className="w-10 h-10" />
                  </div>
                  <div className="p-3">
                    <div className="font-medium text-slate-900 text-xs truncate">{p.file_name}</div>
                    {p.caption && (
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">{p.caption}</p>
                    )}
                    <div className="text-[10px] text-slate-400 mt-1">
                      {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Custody History */}
      {activeTab === "custody" && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Custody & Assignment Register</h2>
              <p className="text-xs text-slate-500">Historical and active employee possession records for this asset.</p>
            </div>
            <Link
              href="/assignments"
              className="text-xs font-medium text-teal-700 hover:text-teal-800 flex items-center gap-1"
            >
              Manage in Assignments →
            </Link>
          </div>

          {assignments.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <UserCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No custody records found</p>
              <p className="text-xs text-slate-400 mt-0.5">This asset has never been assigned to an employee.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Custodian</th>
                    <th className="px-4 py-2.5">Assigned Date</th>
                    <th className="px-4 py-2.5">Due Date</th>
                    <th className="px-4 py-2.5">Physical Handover</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {assignments.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {item.employee_first_name} {item.employee_last_name}
                        <span className="block text-[11px] text-slate-400 font-mono">
                          {item.employee_code} {item.department_name && `• ${item.department_name}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {new Date(item.assigned_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {item.return_due_date ? new Date(item.return_due_date).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {item.is_handed_over ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Handed Over {item.handover_condition && `(${item.handover_condition})`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Pending Handover
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                        {item.remarks || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 7: Returns History */}
      {activeTab === "returns" && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Inward Return & Inspection History</h2>
              <p className="text-xs text-slate-500">Return receipts and multi-point technical inspections for this asset.</p>
            </div>
            <Link
              href="/returns"
              className="text-xs font-medium text-teal-700 hover:text-teal-800 flex items-center gap-1"
            >
              Manage in Returns →
            </Link>
          </div>

          {returns.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <RotateCcw className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No return records found</p>
              <p className="text-xs text-slate-400 mt-0.5">This asset has no recorded inward returns.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Return Code</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Returned By</th>
                    <th className="px-4 py-2.5">Condition & Reason</th>
                    <th className="px-4 py-2.5">Inspection Status</th>
                    <th className="px-4 py-2.5">Inspection Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {returns.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {item.return_code}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {new Date(item.returned_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {item.employee_first_name} {item.employee_last_name}
                        <span className="block text-[11px] text-slate-400 font-mono">{item.employee_code}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <span className="font-semibold">{item.condition}</span> • {item.return_reason || "General"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.inspection_status} />
                      </td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                        {item.inspection_notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 8: Damage Inspections */}
      {activeTab === "damage" && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Damage Inspections & Incident Triage</h2>
              <p className="text-xs text-slate-500">Incident reports, severity categorizations, and repair decisions.</p>
            </div>
            <Link
              href="/damage-inspections"
              className="text-xs font-medium text-teal-700 hover:text-teal-800 flex items-center gap-1"
            >
              Manage in Damage Inspections →
            </Link>
          </div>

          {damageInspections.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No damage inspections recorded</p>
              <p className="text-xs text-slate-400 mt-0.5">No damage incidents or triage reviews on record for this asset.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Code</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Severity & Type</th>
                    <th className="px-4 py-2.5">Description</th>
                    <th className="px-4 py-2.5">Est. Cost</th>
                    <th className="px-4 py-2.5">Recommendation</th>
                    <th className="px-4 py-2.5">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {damageInspections.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {item.inspection_code}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {new Date(item.inspection_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <span className="font-semibold text-rose-700">{item.severity}</span> • {item.damage_type.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                        {item.description}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                        ${Number(item.estimated_repair_cost).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {item.recommendation.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 9: Maintenance Records */}
      {activeTab === "maintenance" && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Maintenance Work Orders</h2>
              <p className="text-xs text-slate-500">Service work orders, technician logs, and operational expense tracking.</p>
            </div>
            <Link
              href="/maintenance"
              className="text-xs font-medium text-teal-700 hover:text-teal-800 flex items-center gap-1"
            >
              Manage in Maintenance →
            </Link>
          </div>

          {maintenanceRecords.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Wrench className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No maintenance records found</p>
              <p className="text-xs text-slate-400 mt-0.5">No work orders or repairs logged for this asset.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Work Order #</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Problem Scope</th>
                    <th className="px-4 py-2.5">Type & Priority</th>
                    <th className="px-4 py-2.5">Technician / Vendor</th>
                    <th className="px-4 py-2.5">Actual / Est Cost</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {maintenanceRecords.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {item.work_order_number || item.maintenance_code}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {new Date(item.report_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 max-w-xs truncate">
                        {item.problem}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <span className="font-semibold">{item.priority}</span> • {item.maintenance_type}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {item.technician_name || item.vendor_name || "Unassigned"}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <span className="font-semibold text-slate-900">${Number(item.actual_cost || 0).toLocaleString()}</span>
                        <span className="text-slate-400 text-[10px] block">Est: ${Number(item.estimated_cost || 0).toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Asset Transfers */}
      {activeTab === "transfers" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Asset Transfers & Custody Movements</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit trail of internal department relocations, custody assignments, and inter-company transfers.
              </p>
            </div>
            <Link
              href="/transfers"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Transfer Hub
            </Link>
          </div>

          {transfers.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <ArrowLeftRight className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No transfers recorded</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                This asset remains in its originally allocated organizational entity and physical location.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 uppercase font-semibold text-slate-500 tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5">Transfer Code</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Origin &rarr; Destination</th>
                    <th className="px-4 py-2.5">Condition</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transfers.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono font-bold text-teal-700">
                        <Link href={`/transfers/${item.id}`} className="hover:underline">
                          {item.transfer_code}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={item.transfer_type === "INTER_COMPANY" ? "brand" : "neutral"}>
                          {item.transfer_type.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {item.transfer_type === "INTER_COMPANY" ? (
                          <span>
                            {item.from_company_code} &rarr; {item.to_company_code}
                          </span>
                        ) : item.transfer_type === "EMPLOYEE_TO_EMPLOYEE" ? (
                          <span>
                            {item.from_employee_name || "Unassigned"} &rarr; {item.to_employee_name || "Recipient"}
                          </span>
                        ) : item.transfer_type === "DEPT_TO_DEPT" ? (
                          <span>
                            {item.from_department_name || "Current"} &rarr; {item.to_department_name}
                          </span>
                        ) : (
                          <span>
                            {item.from_location_name || "Current"} &rarr; {item.to_location_name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-500">{item.condition_before}</span>
                        {item.condition_after && (
                          <span className="text-emerald-700 font-medium"> &rarr; {item.condition_after}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/transfers/${item.id}`}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-teal-50 hover:text-teal-700 font-medium transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 11: Physical Scans */}
      {activeTab === "scans" && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Physical Scan Event Ledger
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every physical barcode or QR scan event recorded across mobile cameras and hardware handheld scanners.
              </p>
            </div>
            <Link
              href={`/assets/labels?assetId=${asset.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-xs font-semibold shadow-2xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Label
            </Link>
          </div>

          {assetScans.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <QrCode className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              No physical scan events recorded yet for this asset.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Scan Type</th>
                    <th className="py-2.5 px-3">Source Device</th>
                    <th className="py-2.5 px-3">Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {assetScans.map((scan: any) => (
                    <tr key={scan.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-medium">
                        {new Date(scan.scanned_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {scan.scan_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {scan.source?.replace("_", " ") || "WEB CAMERA"}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {scan.scanned_by_username || "Authorized User"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Attach Document Modal */}
      <Modal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        title="Attach Asset Document"
      >
        <form onSubmit={handleAddDocument} className="space-y-4">
          {docError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {docError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Document Type *
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="INVOICE">Purchase Invoice</option>
              <option value="WARRANTY">Warranty Document</option>
              <option value="MANUAL">Operating Manual</option>
              <option value="AMC">Annual Maintenance Contract (AMC)</option>
              <option value="INSURANCE">Insurance Policy</option>
              <option value="OTHER">Other Attachment</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Document Title / Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Purchase Invoice Inv-2026-904.pdf"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Storage File Path * (Safe relative path, e.g. /uploads/invoices/inv-01.pdf)
            </label>
            <input
              type="text"
              placeholder="/uploads/assets/inv-01.pdf"
              value={docPath}
              onChange={(e) => setDocPath(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Path traversal characters (`..`) are strictly rejected by security enforcement
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsDocModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingDoc}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {isSubmittingDoc ? "Attaching..." : "Attach Document"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Attach Photo Modal */}
      <Modal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        title="Add Asset Photo"
      >
        <form onSubmit={handleAddPhoto} className="space-y-4">
          {photoError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {photoError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Photo Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Front View - Commissioning"
              value={photoName}
              onChange={(e) => setPhotoName(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Image Storage Path *
            </label>
            <input
              type="text"
              placeholder="/uploads/photos/machine-01.jpg"
              value={photoPath}
              onChange={(e) => setPhotoPath(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Caption / Inspection Notes
            </label>
            <textarea
              rows={2}
              placeholder="Visual inspection details..."
              value={photoCaption}
              onChange={(e) => setPhotoCaption(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsPhotoModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingPhoto}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {isSubmittingPhoto ? "Uploading..." : "Save Photo"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
