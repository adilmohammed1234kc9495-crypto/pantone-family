"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  QrCode,
  Barcode,
  Camera,
  CameraOff,
  Zap,
  ZapOff,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  Sliders,
} from "lucide-react";
import { scanApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export default function ScannerPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"camera" | "manual">("camera");
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>("");
  const [manualType, setManualType] = useState<string>("AUTO");
  const [resolving, setResolving] = useState<boolean>(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const scannerRef = useRef<any>(null);
  const lastScannedCodeRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);

  // Play audio beep on successful scan
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880 Hz
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // AudioContext unavailable or blocked by autoplay policy
    }
  };

  const triggerFeedback = () => {
    playBeep();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(100);
      } catch {
        // ignore
      }
    }
  };

  // Fetch recent scan logs
  const loadRecentScans = async () => {
    try {
      setLoadingHistory(true);
      const res = await scanApi.getScans({ limit: 8 });
      setRecentScans(res.data?.scans || res.scans || []);
    } catch {
      // Ignore if not authorized or offline
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadRecentScans();
  }, []);

  // Handle scanned decoded text
  const handleDecodedCode = async (decodedText: string, scanType: string = "QR") => {
    const now = Date.now();
    // Debounce duplicate scans within 2 seconds
    if (lastScannedCodeRef.current === decodedText && now - lastScanTimeRef.current < 2000) {
      return;
    }
    lastScannedCodeRef.current = decodedText;
    lastScanTimeRef.current = now;

    triggerFeedback();
    setResolving(true);
    setResolveError(null);

    try {
      const result = await scanApi.resolve(decodedText, scanType, activeTab === "camera" ? "WEB_CAMERA" : "MANUAL_ENTRY");
      const asset = result.data?.asset || result.asset;
      if (asset?.id) {
        // Redirect to asset scan action page
        router.push(`/scan/${encodeURIComponent(asset.id)}`);
      } else {
        setResolveError("Asset record found but missing identifier.");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to resolve asset code.";
      setResolveError(msg);
    } finally {
      setResolving(false);
      loadRecentScans();
    }
  };

  // Initialize camera scanner
  const startCamera = async () => {
    setCameraError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {
          // ignore
        }
      }

      const html5Qr = new Html5Qrcode("interactive-scanner-viewport");
      scannerRef.current = html5Qr;

      const config = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await html5Qr.start(
        { facingMode },
        config,
        (decodedText) => {
          handleDecodedCode(decodedText, "QR");
        },
        () => {
          // Frame error (silenced for smoothness)
        }
      );

      setCameraActive(true);

      // Check for torch capability
      try {
        const stream = (html5Qr as any).mediaStream as MediaStream;
        if (stream && stream.getVideoTracks().length > 0) {
          const track = stream.getVideoTracks()[0];
          videoTrackRef.current = track;
          const capabilities = (track.getCapabilities && track.getCapabilities()) || {};
          if ((capabilities as any).torch) {
            setHasTorch(true);
          }
        }
      } catch {
        // Torch not available
      }
    } catch (err: any) {
      setCameraActive(false);
      setCameraError(
        err.message || "Camera access denied or no compatible camera detected. Check browser permissions."
      );
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current && cameraActive) {
      try {
        await scannerRef.current.stop();
        setCameraActive(false);
      } catch {
        // ignore
      }
    }
  };

  const toggleTorch = async () => {
    if (videoTrackRef.current && hasTorch) {
      try {
        const newTorch = !torchOn;
        await (videoTrackRef.current as any).applyConstraints({
          advanced: [{ torch: newTorch }],
        });
        setTorchOn(newTorch);
      } catch {
        // Torch toggle failed
      }
    }
  };

  const switchCameraFacing = async () => {
    const nextFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextFacing);
    await stopCamera();
    setTimeout(() => {
      startCamera();
    }, 200);
  };

  useEffect(() => {
    if (activeTab === "camera") {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const detectedType =
      manualType === "AUTO"
        ? manualCode.startsWith("asset:") || (manualCode.includes("-") && manualCode.length > 30)
          ? "QR"
          : "BARCODE"
        : manualType;
    handleDecodedCode(manualCode.trim(), detectedType);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Page Header */}
      <PageHeader
        title="Physical Asset Scanner"
        description="Scan QR identity codes, Code 128 barcodes, or look up asset tags with real-time operational context."
        icon={<QrCode className="w-6 h-6 text-teal-600" />}
        actions={
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveTab("camera")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === "camera"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Live Camera</span>
            </button>
            <button
              onClick={() => setActiveTab("manual")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === "manual"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Barcode className="w-3.5 h-3.5" />
              <span>Manual / Laser</span>
            </button>
          </div>
        }
      />

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Viewport Card */}
        <div className="lg:col-span-2 space-y-4">
          {activeTab === "camera" ? (
            <div className="bg-slate-950 rounded-2xl overflow-hidden shadow-xl border border-slate-800 relative">
              {/* Camera Header Bar */}
              <div className="bg-slate-900/90 backdrop-blur px-4 py-3 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${cameraActive ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                  <span className="text-xs font-medium text-slate-300">
                    {cameraActive ? "Camera Active (15 FPS)" : "Camera Offline"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {hasTorch && (
                    <button
                      onClick={toggleTorch}
                      className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                        torchOn ? "bg-amber-400 text-slate-900" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                      title={torchOn ? "Turn Torch Off" : "Turn Torch On"}
                    >
                      {torchOn ? <ZapOff className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    onClick={switchCameraFacing}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium transition-colors"
                    title="Switch Camera Lens"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Viewport Container */}
              <div className="relative aspect-square max-h-[460px] w-full flex items-center justify-center bg-black">
                <div id="interactive-scanner-viewport" className="w-full h-full overflow-hidden" />

                {/* Laser scan line overlay when active */}
                {cameraActive && !resolving && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div className="w-64 h-64 border-2 border-teal-500/80 rounded-2xl relative shadow-[0_0_20px_rgba(20,184,166,0.3)]">
                      {/* Corner indicators */}
                      <span className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-teal-400" />
                      <span className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-teal-400" />
                      <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-teal-400" />
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-teal-400" />

                      {/* Animated Laser Bar */}
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_8px_#2dd4bf] animate-[bounce_2s_infinite]" />
                    </div>
                    <p className="text-xs text-slate-400 font-medium mt-4 bg-slate-900/80 px-3 py-1 rounded-full">
                      Align asset QR or Barcode within viewfinder
                    </p>
                  </div>
                )}

                {/* Loading State Overlay */}
                {resolving && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-20">
                    <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-semibold text-white tracking-wide">
                      Resolving Asset Identity...
                    </p>
                  </div>
                )}

                {/* Camera Error Message */}
                {cameraError && (
                  <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center z-10">
                    <div className="w-12 h-12 rounded-full bg-red-950/60 border border-red-800 text-red-400 flex items-center justify-center mb-3">
                      <CameraOff className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1">
                      Camera Initialization Error
                    </h3>
                    <p className="text-xs text-slate-400 max-w-sm mb-4">
                      {cameraError}
                    </p>
                    <button
                      onClick={startCamera}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                    >
                      Retry Camera Access
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Manual / USB Laser Scanner Tab */
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-5">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-slate-100 text-slate-700 rounded-xl">
                  <Barcode className="w-6 h-6" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Manual Code Entry / USB Laser Input
                  </h3>
                  <p className="text-xs text-slate-500">
                    Compatible with hardware handheld USB scanners, barcode readers, and manual entry.
                  </p>
                </div>
              </div>

              <form onSubmit={handleManualSubmit} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Scanned Token / Asset Tag / Barcode
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      autoFocus
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="e.g. asset:7bf0... or BAR-APP-2026-0001 or AST-000123"
                      className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="submit"
                      disabled={resolving || !manualCode.trim()}
                      className="absolute right-2 top-2 bottom-2 px-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                    >
                      {resolving ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Code Type:</span>
                  {["AUTO", "QR", "BARCODE", "TAG"].map((type) => (
                    <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="manualType"
                        value={type}
                        checked={manualType === type}
                        onChange={(e) => setManualType(e.target.value)}
                        className="text-teal-600 focus:ring-teal-500 h-3.5 w-3.5 border-slate-300"
                      />
                      <span>{type}</span>
                    </label>
                  ))}
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={resolving || !manualCode.trim()}
                    variant="primary"
                    size="lg"
                    className="w-full justify-center"
                  >
                    {resolving ? "Looking up Asset..." : "Lookup & Open Operational Actions"}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Resolve Error Alert */}
          {resolveError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-red-900 uppercase tracking-wider">
                  Scan Resolution Error
                </h4>
                <p className="text-xs text-red-700 leading-relaxed">
                  {resolveError}
                </p>
                {resolveError.toLowerCase().includes("tenant") || resolveError.toLowerCase().includes("forbidden") ? (
                  <p className="text-[11px] text-red-600 font-medium">
                    Strict Multi-Tenant Boundary: Scanned asset belongs to a foreign company and cannot be inspected.
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Info & Recent Scans Sidebar */}
        <div className="space-y-5">
          {/* Quick Guide Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-teal-600" />
              Operational Scanner Engine
            </h4>
            <ul className="text-xs text-slate-600 space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 flex-shrink-0 mt-0.5" />
                <span><strong>No Duplicate Assets:</strong> Scanning resolves real-time database records without generating clones.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 flex-shrink-0 mt-0.5" />
                <span><strong>Context-Aware Actions:</strong> Returns allowable operations based on status (e.g. Assign, Return, Transfer, Work Order).</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 flex-shrink-0 mt-0.5" />
                <span><strong>In-Transit Handovers:</strong> Receiving company admins can scan incoming assets to verify and execute dual authorization.</span>
              </li>
            </ul>
          </div>

          {/* Recent Scans History Widget */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Recent Scans
              </h4>
              <button
                onClick={loadRecentScans}
                className="text-xs text-teal-600 hover:text-teal-700 font-medium"
              >
                Refresh
              </button>
            </div>

            {loadingHistory ? (
              <div className="py-6 text-center text-xs text-slate-400">Loading history...</div>
            ) : recentScans.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No recent scans recorded.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {recentScans.map((scan: any) => (
                  <div
                    key={scan.id}
                    onClick={() => router.push(`/scan/${scan.asset_id}`)}
                    className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition-colors group"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-800 group-hover:text-teal-600 transition-colors">
                        {scan.asset_tag || "Asset"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {scan.scan_type} • {scan.source?.replace("_", " ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400">
                        {new Date(scan.scanned_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
