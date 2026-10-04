"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Printer,
  QrCode,
  Barcode,
  Search,
  CheckSquare,
  Square,
  RefreshCw,
  Sliders,
  Layers,
  FileText,
  Building2,
  Tag,
} from "lucide-react";
import { apiClient, scanApi } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

export default function AssetLabelsPage() {
  const searchParams = useSearchParams();
  const preselectedAssetId = searchParams.get("assetId");

  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState<boolean>(false);
  const [labels, setLabels] = useState<any[]>([]);

  // Print layout settings
  const [labelSize, setLabelSize] = useState<"standard" | "compact" | "grid">("standard");
  const [showBarcode, setShowBarcode] = useState<boolean>(true);
  const [showQr, setShowQr] = useState<boolean>(true);

  // Fetch asset catalog
  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<any>("/assets?limit=100");
      const list = res.data?.assets || res.assets || [];
      setAssets(list);

      if (preselectedAssetId && list.some((a: any) => a.id === preselectedAssetId)) {
        setSelectedIds([preselectedAssetId]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [preselectedAssetId]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // When selected IDs change, fetch generated printable labels with SVGs
  const generateSelectedLabels = async (ids: string[]) => {
    if (ids.length === 0) {
      setLabels([]);
      return;
    }
    setGenerating(true);
    try {
      const res = await scanApi.getBatchLabels(ids);
      setLabels(res.data?.labels || res.labels || []);
    } catch {
      // ignore
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (selectedIds.length > 0) {
      generateSelectedLabels(selectedIds);
    } else {
      setLabels([]);
    }
  }, [selectedIds]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredAssets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAssets.map((a) => a.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const filteredAssets = assets.filter((a) => {
    const q = searchQuery.toLowerCase();
    return (
      a.name?.toLowerCase().includes(q) ||
      a.asset_tag?.toLowerCase().includes(q) ||
      a.serial_number?.toLowerCase().includes(q) ||
      a.category_name?.toLowerCase().includes(q)
    );
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Non-print controls bar */}
      <div className="print:hidden space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Asset Physical Label Station"
          description="Generate scannable black-and-white asset labels with high-density QR codes and Code 128 linear barcodes."
          icon={<Printer className="w-5 h-5 text-teal-600" />}
          breadcrumbs={[
            { label: "Assets", href: "/assets" },
            { label: "Physical Label Station" },
          ]}
          actions={
            <Button
              onClick={handlePrint}
              disabled={labels.length === 0}
              variant="primary"
              size="sm"
            >
              <Printer className="w-4 h-4" />
              Print Labels ({labels.length})
            </Button>
          }
        />

        {/* Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Asset Selection Column */}
          <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-xl p-5 shadow-subtle space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Select Assets to Print
              </h3>
              <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/50">
                {selectedIds.length} Selected
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Filter by name, tag, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            {/* Select All Bar */}
            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 font-medium text-slate-700 hover:text-slate-900"
              >
                {selectedIds.length === filteredAssets.length && filteredAssets.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-teal-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>Select All ({filteredAssets.length})</span>
              </button>
              {selectedIds.length > 0 && (
                <button
                  onClick={() => setSelectedIds([])}
                  className="text-slate-400 hover:text-slate-600"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {/* Assets List */}
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading catalog...</div>
            ) : filteredAssets.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No assets match your search.</div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto pr-1">
                {filteredAssets.map((asset) => {
                  const isChecked = selectedIds.includes(asset.id);
                  return (
                    <div
                      key={asset.id}
                      onClick={() => toggleSelectOne(asset.id)}
                      className={`py-2.5 px-2 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                        isChecked ? "bg-teal-50/60" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-teal-600 flex-shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-xs font-bold text-slate-900 leading-tight">
                            {asset.name}
                          </p>
                          <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                            {asset.asset_tag} • {asset.category_name || "Asset"}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {asset.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Label Configuration Column */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-subtle space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-teal-600" />
                  Print & Layout Preferences
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Layout Format</label>
                  <select
                    value={labelSize}
                    onChange={(e: any) => setLabelSize(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 text-xs"
                  >
                    <option value="standard">Standard (100 × 50 mm)</option>
                    <option value="compact">Compact (70 × 35 mm)</option>
                    <option value="grid">A4 Sheet Grid (3 × 8)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Linear Barcode</label>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBarcode}
                      onChange={(e) => setShowBarcode(e.target.checked)}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-slate-700">Code 128 Barcode</span>
                  </label>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">2D Matrix</label>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showQr}
                      onChange={(e) => setShowQr(e.target.checked)}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-slate-700">QR Code Matrix</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Live Preview Container (Screen View) */}
            <div className="bg-slate-100 border border-slate-300 rounded-2xl p-6 shadow-inner min-h-[380px] space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wider text-slate-600">
                  Label Output Preview ({labels.length} Ready)
                </span>
                {generating && (
                  <span className="flex items-center gap-1.5 text-teal-600 font-medium">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Generating vectors...
                  </span>
                )}
              </div>

              {labels.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  Select one or more assets on the left to render printable machine identity labels.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[480px] overflow-y-auto p-2">
                  {labels.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-white border-2 border-black rounded-lg p-3 text-black shadow-sm font-sans flex flex-col justify-between"
                      style={{ minHeight: "170px" }}
                    >
                      {/* Top Header */}
                      <div className="flex items-center justify-between border-b border-black pb-1 mb-2">
                        <span className="text-[10px] font-bold tracking-tight uppercase">
                          {item.companyName || "PANTONE ENTERPRISES"}
                        </span>
                        <span className="text-[9px] font-mono uppercase">
                          {item.categoryName || "FIXED ASSET"}
                        </span>
                      </div>

                      {/* Main Center Area: Name + QR */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-0.5">
                          <p className="text-xs font-bold leading-tight line-clamp-2">
                            {item.assetName}
                          </p>
                          <p className="text-sm font-black font-mono tracking-wider mt-1">
                            {item.assetTag}
                          </p>
                          <p className="text-[9px] font-mono text-neutral-600">
                            SN: {item.serialNumber || "N/A"}
                          </p>
                        </div>
                        {showQr && item.qrSvg && (
                          <div
                            className="w-16 h-16 flex-shrink-0 flex items-center justify-center border border-black p-0.5 bg-white"
                            dangerouslySetInnerHTML={{ __html: item.qrSvg }}
                          />
                        )}
                      </div>

                      {/* Bottom Barcode */}
                      {showBarcode && item.barcodeSvg && (
                        <div className="mt-2 pt-1 border-t border-black/40 flex flex-col items-center">
                          <div
                            className="w-full flex justify-center max-h-12 overflow-hidden"
                            dangerouslySetInnerHTML={{ __html: item.barcodeSvg }}
                          />
                          <span className="font-mono text-[9px] font-bold tracking-widest mt-0.5">
                            {item.barcode}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PRINT-ONLY CONTAINER */}
      <div className="hidden print:block print:p-0">
        <style jsx global>{`
          @media print {
            @page {
              margin: 4mm;
              size: auto;
            }
            body {
              background: white !important;
              color: black !important;
            }
            .print-label-item {
              page-break-inside: avoid;
              break-inside: avoid;
            }
          }
        `}</style>

        <div
          className={
            labelSize === "grid"
              ? "grid grid-cols-3 gap-2"
              : "grid grid-cols-2 gap-3"
          }
        >
          {labels.map((item, idx) => (
            <div
              key={idx}
              className="print-label-item border-2 border-black p-3 bg-white text-black flex flex-col justify-between"
              style={{
                width: labelSize === "compact" ? "65mm" : "95mm",
                minHeight: labelSize === "compact" ? "32mm" : "48mm",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-black pb-1 mb-1.5">
                <span className="text-[10px] font-extrabold tracking-tight uppercase">
                  {item.companyName || "PANTONE ENTERPRISES"}
                </span>
                <span className="text-[9px] font-mono uppercase font-bold">
                  {item.categoryName || "FIXED ASSET"}
                </span>
              </div>

              {/* Asset Identity Details */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-0.5">
                  <p className="text-xs font-bold leading-tight">
                    {item.assetName}
                  </p>
                  <p className="text-sm font-black font-mono tracking-wider">
                    {item.assetTag}
                  </p>
                  <p className="text-[9px] font-mono">
                    SN: {item.serialNumber || "N/A"}
                  </p>
                </div>
                {showQr && item.qrSvg && (
                  <div
                    className="w-16 h-16 flex-shrink-0 flex items-center justify-center border border-black p-0.5"
                    dangerouslySetInnerHTML={{ __html: item.qrSvg }}
                  />
                )}
              </div>

              {/* Barcode */}
              {showBarcode && item.barcodeSvg && (
                <div className="mt-1 pt-1 border-t border-black flex flex-col items-center">
                  <div
                    className="w-full flex justify-center max-h-11 overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: item.barcodeSvg }}
                  />
                  <span className="font-mono text-[9px] font-bold tracking-widest">
                    {item.barcode}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
