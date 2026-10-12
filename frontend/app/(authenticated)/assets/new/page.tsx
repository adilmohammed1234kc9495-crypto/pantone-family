"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  Package,
  ArrowLeft,
  Building2,
  GitBranch,
  Layers,
  MapPin,
  Truck,
  Calculator,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  FolderTree,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

interface CompanyOption {
  id: string;
  name: string;
  code: string;
}

interface BranchOption {
  id: string;
  name: string;
  code: string;
  company_id: string;
}

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
  branch_id: string;
}

interface LocationOption {
  id: string;
  name?: string;
  code?: string;
  building?: string;
  floor?: string;
  room?: string;
  room_number?: string;
  branch_id?: string;
}

interface CategoryOption {
  id: string;
  name: string;
  code: string;
  company_id: string | null;
  depreciation_method: string;
  depreciation_rate_percent: number;
  useful_life_months: number;
}

interface VendorOption {
  id: string;
  name: string;
  code: string;
  company_id: string;
}

export default function NewAssetPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);

  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(true);
  const [isLoadingSubs, setIsLoadingSubs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form State
  const [companyId, setCompanyId] = useState<string>("");
  const [branchId, setBranchId] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [vendorId, setVendorId] = useState<string>("");

  const [assetTag, setAssetTag] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [serialNumber, setSerialNumber] = useState<string>("");
  const [modelNumber, setModelNumber] = useState<string>("");
  const [condition, setCondition] = useState<string>("NEW");

  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [purchaseCost, setPurchaseCost] = useState<number>(120000);
  const [currency, setCurrency] = useState<string>("USD");
  const [salvageValue, setSalvageValue] = useState<number>(0);

  // Depreciation state (inherits from category)
  const [depreciationMethod, setDepreciationMethod] = useState<string>("STRAIGHT_LINE");
  const [depreciationRatePercent, setDepreciationRatePercent] = useState<number>(20);
  const [usefulLifeMonths, setUsefulLifeMonths] = useState<number>(60);
  const [depreciationStartDate, setDepreciationStartDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Load master data with tenant scoping
  const loadMasterData = useCallback(async (targetCompanyId?: string) => {
    setIsLoadingDropdowns(true);
    setLoadError(null);
    try {
      let activeCompany = targetCompanyId || companyId;

      if (user?.isCommonAdmin && !activeCompany) {
        const compRes = await apiClient.get<any>("/companies");
        const compList = compRes?.companies || compRes?.data?.companies || (Array.isArray(compRes) ? compRes : []);
        setCompanies(compList);
        if (compList.length > 0) {
          activeCompany = compList[0].id;
          setCompanyId(activeCompany);
        }
      } else if (!user?.isCommonAdmin && user?.companyId) {
        activeCompany = user.companyId;
        setCompanyId(activeCompany);
      }

      const branchQuery = activeCompany ? `?limit=100&companyId=${activeCompany}` : "?limit=100";
      const catQuery = activeCompany ? `?limit=100&companyId=${activeCompany}` : "?limit=100";
      const vendorQuery = activeCompany ? `?limit=100&companyId=${activeCompany}` : "?limit=100";

      const [branchRes, catRes, vendorRes] = await Promise.all([
        apiClient.get<any>(`/branches${branchQuery}`),
        apiClient.get<any>(`/categories${catQuery}`),
        apiClient.get<any>(`/vendors${vendorQuery}`),
      ]);

      const bList = branchRes?.branches || branchRes?.items || [];
      const cList = catRes?.categories || catRes?.items || [];
      const vList = vendorRes?.vendors || vendorRes?.items || [];

      setBranches(bList);
      setCategories(cList);
      setVendors(vList);

      // Auto-select initial branch
      if (bList.length > 0) {
        setBranchId(bList[0].id);
      } else {
        setBranchId("");
        setDepartments([]);
        setLocations([]);
      }

      // Auto-select initial category & apply defaults
      if (cList.length > 0) {
        const firstCat = cList[0];
        setCategoryId(firstCat.id);
        setDepreciationMethod(firstCat.depreciation_method || "STRAIGHT_LINE");
        setDepreciationRatePercent(Number(firstCat.depreciation_rate_percent) || 20);
        setUsefulLifeMonths(Number(firstCat.useful_life_months) || 60);
      } else {
        setCategoryId("");
      }
    } catch (err: any) {
      setLoadError(err.message || "Failed to load master dropdown data");
    } finally {
      setIsLoadingDropdowns(false);
    }
  }, [user, companyId]);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // Load departments & locations when branch changes
  useEffect(() => {
    if (!branchId) {
      setDepartments([]);
      setLocations([]);
      setDepartmentId("");
      setLocationId("");
      return;
    }

    const loadBranchSubs = async () => {
      setIsLoadingSubs(true);
      try {
        const [deptRes, locRes] = await Promise.all([
          apiClient.get<any>(`/departments?branchId=${branchId}&limit=100`),
          apiClient.get<any>(`/locations?branchId=${branchId}&limit=100`),
        ]);
        const dList = deptRes?.departments || deptRes?.items || [];
        const lList = locRes?.locations || locRes?.items || [];
        setDepartments(dList);
        setLocations(lList);
        setDepartmentId(dList[0]?.id || "");
        setLocationId(lList[0]?.id || "");
      } catch {
        // Fallback gracefully
      } finally {
        setIsLoadingSubs(false);
      }
    };
    loadBranchSubs();
  }, [branchId]);

  // Handle Common Admin switching company
  const handleCompanyChange = async (newCompanyId: string) => {
    setCompanyId(newCompanyId);
    setBranchId("");
    setDepartmentId("");
    setLocationId("");
    setVendorId("");
    setCategoryId("");
    await loadMasterData(newCompanyId);
  };

  // When category changes, inherit depreciation defaults
  const handleCategoryChange = (catId: string) => {
    setCategoryId(catId);
    const cat = categories.find((c) => c.id === catId);
    if (cat) {
      if (cat.depreciation_method) setDepreciationMethod(cat.depreciation_method);
      if (cat.depreciation_rate_percent) setDepreciationRatePercent(Number(cat.depreciation_rate_percent));
      if (cat.useful_life_months) setUsefulLifeMonths(Number(cat.useful_life_months));
    }
  };

  // Live Straight-Line Depreciation Calculations
  const livePreview = useMemo(() => {
    const cost = Number(purchaseCost) || 0;
    const salvage = Number(salvageValue) || 0;
    const months = Number(usefulLifeMonths) || 1;
    const basis = Math.max(0, cost - salvage);
    const monthlyDep = months > 0 ? basis / months : 0;
    const annualDep = monthlyDep * 12;

    return {
      depreciableBasis: basis,
      monthlyDepreciation: monthlyDep,
      annualDepreciation: annualDep,
    };
  }, [purchaseCost, salvageValue, usefulLifeMonths]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.isCommonAdmin && !companyId) {
      setError("Company Authority is required. Please select a company.");
      return;
    }
    if (!name.trim()) {
      setError("Asset name is required.");
      return;
    }
    if (!branchId) {
      setError("Branch selection is required.");
      return;
    }
    if (!categoryId) {
      setError("Asset Category selection is required. Please select or create a category.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const payload: Record<string, unknown> = {
        companyId: user?.isCommonAdmin ? (companyId || undefined) : undefined,
        branchId: branchId || undefined,
        departmentId: departmentId || undefined,
        locationId: locationId || undefined,
        categoryId: categoryId || undefined,
        vendorId: vendorId || undefined,
        assetTag: assetTag.trim() || undefined,
        name: name.trim(),
        description: description.trim() || undefined,
        serialNumber: serialNumber.trim() || undefined,
        modelNumber: modelNumber.trim() || undefined,
        purchaseDate: purchaseDate || undefined,
        purchaseCost: Number(purchaseCost) || 0,
        currency: currency || "USD",
        salvageValue: Number(salvageValue) || 0,
        condition: condition || "NEW",
        depreciationMethod: depreciationMethod || "STRAIGHT_LINE",
        depreciationRatePercent: Number(depreciationRatePercent) || 0,
        usefulLifeMonths: Math.round(Number(usefulLifeMonths)) || 60,
        depreciationStartDate: depreciationStartDate || purchaseDate || undefined,
      };

      const res = await apiClient.post<any>("/assets", payload);
      const createdAsset = res?.asset || res?.data || res;
      router.push(createdAsset?.id ? `/assets/${createdAsset.id}` : "/assets");
    } catch (err: any) {
      if (err.data?.error?.details?.fieldErrors) {
        const fErrors: Record<string, string[]> = err.data.error.details.fieldErrors;
        setFieldErrors(fErrors);
        const detailedMsg = Object.entries(fErrors)
          .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(", ") : msgs}`)
          .join(" • ");
        setError(`Validation error: ${detailedMsg}`);
      } else {
        setError(err.message || "Failed to register asset");
      }
      setIsSubmitting(false);
    }
  };

  const selectedCategoryObj = categories.find((c) => c.id === categoryId);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Page Header */}
      <PageHeader
        title="Register New Fixed Asset"
        description="Authoritative asset catalog onboarding with straight-line depreciation engine setup."
        icon={<Package className="w-5 h-5 text-teal-600" />}
        breadcrumbs={[
          { label: "Assets", href: "/assets" },
          { label: "New Asset" },
        ]}
      />

      {/* Critical Load Error Alert */}
      {loadError && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600" />
            <span>{loadError}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadMasterData()}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </Button>
        </div>
      )}

      {/* Form Submission Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex flex-col gap-2 text-sm shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
            <span className="font-semibold">{error}</span>
          </div>
          {Object.keys(fieldErrors).length > 0 && (
            <ul className="list-disc list-inside text-xs pl-8 space-y-1 text-rose-600">
              {Object.entries(fieldErrors).map(([field, msgs]) => (
                <li key={field}>
                  <strong className="capitalize">{field}</strong>: {Array.isArray(msgs) ? msgs.join(", ") : msgs}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Identification & Classification */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Package className="w-4 h-4 text-teal-600" />
            1. Asset Identification & Classification
          </h2>

          {user?.isCommonAdmin && (
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Company Authority *
              </label>
              <select
                value={companyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className={`w-full bg-white border ${fieldErrors.companyId ? "border-rose-500 focus:ring-rose-500" : "border-slate-300 focus:ring-teal-500"} rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2`}
                required
              >
                <option value="">Select Target Company Authority</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              {fieldErrors.companyId && (
                <span className="text-xs text-rose-600 mt-1 block">{fieldErrors.companyId[0]}</span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Asset Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Brother Lockstitch S-7200C"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full bg-white border ${fieldErrors.name ? "border-rose-500 focus:ring-rose-500" : "border-slate-300 focus:ring-teal-500"} rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2`}
                required
              />
              {fieldErrors.name && (
                <span className="text-xs text-rose-600 mt-1 block">{fieldErrors.name[0]}</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1 flex items-center justify-between">
                <span>Asset Category *</span>
                {categories.length > 0 && (
                  <span className="text-[11px] text-teal-700 font-normal">
                    {categories.length} available
                  </span>
                )}
              </label>

              {isLoadingDropdowns ? (
                <div className="flex items-center gap-2.5 px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-xs text-slate-500">
                  <div className="w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                  <span>Loading categories from database...</span>
                </div>
              ) : categories.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    No Asset Categories Configured
                  </div>
                  <p>You cannot register an asset without an assigned category.</p>
                  <Link
                    href="/categories"
                    className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-800 font-medium underline mt-1"
                  >
                    <FolderTree className="w-3.5 h-3.5" />
                    Configure Categories in Master &rarr;
                  </Link>
                </div>
              ) : (
                <select
                  value={categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className={`w-full bg-white border ${fieldErrors.categoryId ? "border-rose-500 focus:ring-rose-500" : "border-slate-300 focus:ring-teal-500"} rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2`}
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              )}
              {fieldErrors.categoryId && (
                <span className="text-xs text-rose-600 mt-1 block">{fieldErrors.categoryId[0]}</span>
              )}

              {selectedCategoryObj && (
                <div className="mt-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 flex items-center justify-between">
                  <span>
                    Defaults: <strong className="text-slate-800">{selectedCategoryObj.depreciation_method}</strong> ({selectedCategoryObj.depreciation_rate_percent}% / {selectedCategoryObj.useful_life_months} mos)
                  </span>
                  <Link href="/categories" className="text-teal-600 hover:underline">
                    Edit Category
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Asset Tag / Barcode (Leave empty to auto-generate)
              </label>
              <input
                type="text"
                placeholder="AST-2026-XXXX"
                value={assetTag}
                onChange={(e) => setAssetTag(e.target.value.toUpperCase())}
                className={`w-full bg-white border ${fieldErrors.assetTag ? "border-rose-500 focus:ring-rose-500" : "border-slate-300 focus:ring-teal-500"} rounded-lg px-3 py-2 text-sm text-slate-900 font-mono uppercase focus:outline-none focus:ring-2`}
              />
              {fieldErrors.assetTag && (
                <span className="text-xs text-rose-600 mt-1 block">{fieldErrors.assetTag[0]}</span>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Serial Number
              </label>
              <input
                type="text"
                placeholder="e.g. BR-7200-9941"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Model Number
              </label>
              <input
                type="text"
                placeholder="e.g. S-7200C-403"
                value={modelNumber}
                onChange={(e) => setModelNumber(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Description / Notes
            </label>
            <textarea
              rows={2}
              placeholder="Technical specifications, capacity, operating voltages, or accessory list..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Section 2: Organizational Placement */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <GitBranch className="w-4 h-4 text-teal-600" />
            2. Organizational & Physical Placement
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Branch / Plant *
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className={`w-full bg-white border ${fieldErrors.branchId ? "border-rose-500 focus:ring-rose-500" : "border-slate-300 focus:ring-teal-500"} rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2`}
                required
              >
                {branches.length === 0 ? (
                  <option value="">No branches configured</option>
                ) : (
                  <>
                    <option value="">Select Branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </>
                )}
              </select>
              {fieldErrors.branchId && (
                <span className="text-xs text-rose-600 mt-1 block">{fieldErrors.branchId[0]}</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Department / Cost Center
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                disabled={isLoadingSubs}
              >
                <option value="">-- Unassigned --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Location / Bay
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                disabled={isLoadingSubs}
              >
                <option value="">-- Unassigned --</option>
                {locations.map((loc) => {
                  const labelParts = [
                    loc.name || loc.building,
                    loc.floor,
                    loc.room || loc.room_number,
                  ].filter(Boolean);
                  const label = labelParts.length > 0 ? labelParts.join(" • ") : "Location";
                  return (
                    <option key={loc.id} value={loc.id}>
                      {label} {loc.code ? `(${loc.code})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Procurement & Vendor */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Truck className="w-4 h-4 text-teal-600" />
            3. Procurement & Commercial Terms
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Vendor / Supplier
              </label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">-- None / Unknown Vendor --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Initial Condition *
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className={`w-full bg-white border ${fieldErrors.condition ? "border-rose-500 focus:ring-rose-500" : "border-slate-300 focus:ring-teal-500"} rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2`}
              >
                <option value="NEW">New (Brand New / Unused)</option>
                <option value="EXCELLENT">Excellent (Like New)</option>
                <option value="GOOD">Good (Operational)</option>
                <option value="FAIR">Fair (Minor Wear)</option>
                <option value="DAMAGED">Damaged (Needs Repair / Poor)</option>
                <option value="UNUSABLE">Unusable (Scrap / Beyond Repair)</option>
              </select>
              {fieldErrors.condition && (
                <span className="text-xs text-rose-600 mt-1 block">{fieldErrors.condition[0]}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Purchase Date *
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => {
                  setPurchaseDate(e.target.value);
                  if (!depreciationStartDate) setDepreciationStartDate(e.target.value);
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Purchase Cost *
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={purchaseCost}
                onChange={(e) => setPurchaseCost(Number(e.target.value))}
                className={`w-full bg-white border ${fieldErrors.purchaseCost ? "border-rose-500 focus:ring-rose-500" : "border-slate-300 focus:ring-teal-500"} rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2`}
                required
              />
              {fieldErrors.purchaseCost && (
                <span className="text-xs text-rose-600 mt-1 block">{fieldErrors.purchaseCost[0]}</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="USD">USD ($)</option>
                <option value="BDT">BDT (Tk)</option>
                <option value="INR">INR (₹)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Salvage Value
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={salvageValue}
                onChange={(e) => setSalvageValue(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Depreciation Schedule & Live Preview */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Calculator className="w-4 h-4 text-teal-600" />
            4. Depreciation Schedule & Live Engine Calculation
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Method *
              </label>
              <select
                value={depreciationMethod}
                onChange={(e) => setDepreciationMethod(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="STRAIGHT_LINE">Straight Line (SLM) — Active Standard</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Useful Life (Months) *
              </label>
              <input
                type="number"
                min={1}
                max={600}
                value={usefulLifeMonths}
                onChange={(e) => setUsefulLifeMonths(Number(e.target.value))}
                className={`w-full bg-white border ${fieldErrors.usefulLifeMonths ? "border-rose-500 focus:ring-rose-500" : "border-slate-300 focus:ring-teal-500"} rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2`}
                required
              />
              {fieldErrors.usefulLifeMonths && (
                <span className="text-xs text-rose-600 mt-1 block">{fieldErrors.usefulLifeMonths[0]}</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Annual Rate (%) *
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={depreciationRatePercent}
                onChange={(e) => setDepreciationRatePercent(Number(e.target.value))}
                className={`w-full bg-white border ${fieldErrors.depreciationRatePercent ? "border-rose-500 focus:ring-rose-500" : "border-slate-300 focus:ring-teal-500"} rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2`}
                required
              />
              {fieldErrors.depreciationRatePercent && (
                <span className="text-xs text-rose-600 mt-1 block">{fieldErrors.depreciationRatePercent[0]}</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={depreciationStartDate}
                onChange={(e) => setDepreciationStartDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
          </div>

          {/* Live Depreciation Preview Card */}
          <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-4 mt-3">
            <div className="flex items-center gap-2 text-teal-900 font-semibold text-xs uppercase tracking-wider mb-3">
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
              Engine Projection (Straight-Line Pure Domain Verification)
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-slate-700">
              <div>
                <span className="text-xs text-slate-500 block">Depreciable Basis</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  ${livePreview.depreciableBasis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Monthly Amortization</span>
                <span className="font-mono font-bold text-teal-700 text-sm">
                  ${livePreview.monthlyDepreciation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / mo
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Annual Depreciation</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  ${livePreview.annualDepreciation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / yr
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Residual Book Value</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  ${salvageValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <Link href="/assets">
            <Button variant="outline" size="md">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={isSubmitting || categories.length === 0}
            variant="primary"
            size="md"
          >
            {isSubmitting ? "Registering Asset..." : "Confirm & Register Asset"}
          </Button>
        </div>
      </form>
    </div>
  );
}
