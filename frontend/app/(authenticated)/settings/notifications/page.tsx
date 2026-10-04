"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { notificationsApi } from "@/lib/api";
import {
  Bell,
  ShieldAlert,
  Package,
  Wrench,
  Boxes,
  FileCheck2,
  ArrowLeftRight,
  CheckCircle2,
  AlertTriangle,
  Save,
  RotateCcw,
  ArrowLeft,
  Lock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

interface PreferencesState {
  [key: string]: boolean;
  assetEvents: boolean;
  maintenanceEvents: boolean;
  stockEvents: boolean;
  requestEvents: boolean;
  transferEvents: boolean;
  securityAlerts: boolean;
}

export default function NotificationPreferencesPage() {
  const { user } = useAuth();

  const [prefs, setPrefs] = useState<PreferencesState>({
    assetEvents: true,
    maintenanceEvents: true,
    stockEvents: true,
    requestEvents: true,
    transferEvents: true,
    securityAlerts: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await notificationsApi.getPreferences();
      const data = res?.data || res;
      if (data) {
        setPrefs({
          assetEvents: data.asset_events !== undefined ? Boolean(data.asset_events) : true,
          maintenanceEvents: data.maintenance_events !== undefined ? Boolean(data.maintenance_events) : true,
          stockEvents: data.stock_events !== undefined ? Boolean(data.stock_events) : true,
          requestEvents: data.request_events !== undefined ? Boolean(data.request_events) : true,
          transferEvents: data.transfer_events !== undefined ? Boolean(data.transfer_events) : true,
          securityAlerts: data.security_alerts !== undefined ? Boolean(data.security_alerts) : true,
        });
        if (data.updated_at) {
          setLastUpdated(data.updated_at);
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to load notification preferences");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const handleToggle = (key: keyof PreferencesState) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setSuccessMessage(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSuccessMessage(null);
      setErrorMessage(null);

      const res = await notificationsApi.updatePreferences(prefs);
      const data = res?.data || res;
      if (data?.updated_at) {
        setLastUpdated(data.updated_at);
      }
      setSuccessMessage("Notification preferences successfully saved and activated.");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to save notification preferences");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setPrefs({
      assetEvents: true,
      maintenanceEvents: true,
      stockEvents: true,
      requestEvents: true,
      transferEvents: true,
      securityAlerts: true,
    });
    setSuccessMessage(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Notification Delivery Preferences"
        description="Configure delivery settings for automated system alerts, operational triggers, and activity notifications."
        icon={<Bell className="w-5 h-5 text-teal-600" />}
        breadcrumbs={[
          { label: "Notifications", href: "/notifications" },
          { label: "Preferences" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handleResetDefaults}
              disabled={loading || saving}
              variant="outline"
              size="sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={loading || saving}
              variant="primary"
              size="sm"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving Changes..." : "Save Preferences"}
            </Button>
          </div>
        }
      />

      {/* Status Messages */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Compliance / Non-Suppressible Notice Banner */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
        <div className="flex items-center gap-2.5 font-semibold text-sm">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <span>Enterprise Compliance & Security Policy Notice</span>
        </div>
        <p className="text-xs text-amber-800 leading-relaxed">
          Critical security alerts (including account lockouts, brute-force detections, suspicious QR/barcode scans, and inter-company transfer disputes) are <strong>mandatory and non-suppressible</strong>. These critical notifications will be delivered to your inbox regardless of individual preference settings to satisfy regulatory auditability and tamper protection.
        </p>
      </div>

      {/* Preferences List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
        {/* Preference Item 1: Asset & Custody */}
        <div className="p-5 flex items-start justify-between gap-4 hover:bg-slate-50/50 transition-colors">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 flex-shrink-0 mt-0.5">
              <Package className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Asset & Custody Events</h3>
                <Badge variant="info" size="sm">
                  Custody
                </Badge>
              </div>
              <p className="text-xs text-slate-500 max-w-xl">
                Notifications when an asset is assigned to you, return confirmations, return due reminders, overdue notices, and physical damage inspection reports.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.assetEvents}
            onClick={() => handleToggle("assetEvents")}
            disabled={loading}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              prefs.assetEvents ? "bg-teal-600" : "bg-slate-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                prefs.assetEvents ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Preference Item 2: Maintenance & Work Orders */}
        <div className="p-5 flex items-start justify-between gap-4 hover:bg-slate-50/50 transition-colors">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600 flex-shrink-0 mt-0.5">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Maintenance & Work Orders</h3>
                <Badge variant="warning" size="sm">
                  Service
                </Badge>
              </div>
              <p className="text-xs text-slate-500 max-w-xl">
                Updates regarding work order creation, technician assignment, status transitions, repair completion, and post-repair quality verification.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.maintenanceEvents}
            onClick={() => handleToggle("maintenanceEvents")}
            disabled={loading}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              prefs.maintenanceEvents ? "bg-teal-600" : "bg-slate-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                prefs.maintenanceEvents ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Preference Item 3: Stock & Inventory */}
        <div className="p-5 flex items-start justify-between gap-4 hover:bg-slate-50/50 transition-colors">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600 flex-shrink-0 mt-0.5">
              <Boxes className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Stock & Consumable Inventory Alerts</h3>
                <Badge variant="brand" size="sm">
                  Inventory
                </Badge>
              </div>
              <p className="text-xs text-slate-500 max-w-xl">
                Automated threshold alerts when warehouse stock falls below minimum safety buffer or hits zero stock-out state.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.stockEvents}
            onClick={() => handleToggle("stockEvents")}
            disabled={loading}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              prefs.stockEvents ? "bg-teal-600" : "bg-slate-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                prefs.stockEvents ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Preference Item 4: Requests & Approvals */}
        <div className="p-5 flex items-start justify-between gap-4 hover:bg-slate-50/50 transition-colors">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 flex-shrink-0 mt-0.5">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Requisitions & Approval Workflows</h3>
                <Badge variant="success" size="sm">
                  Workflows
                </Badge>
              </div>
              <p className="text-xs text-slate-500 max-w-xl">
                Notifications for requisition submissions, pending multi-level approvals requiring your action, approvals, rejections, and fulfillment.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.requestEvents}
            onClick={() => handleToggle("requestEvents")}
            disabled={loading}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              prefs.requestEvents ? "bg-teal-600" : "bg-slate-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                prefs.requestEvents ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Preference Item 5: Transfers & Inter-Company */}
        <div className="p-5 flex items-start justify-between gap-4 hover:bg-slate-50/50 transition-colors">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 flex-shrink-0 mt-0.5">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Transfers & Inter-Company Logistics</h3>
                <Badge variant="info" size="sm">
                  Logistics
                </Badge>
              </div>
              <p className="text-xs text-slate-500 max-w-xl">
                Internal department transfers, inter-company shipments, dual-authorization handover requirements, and receipt acknowledgments.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.transferEvents}
            onClick={() => handleToggle("transferEvents")}
            disabled={loading}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              prefs.transferEvents ? "bg-teal-600" : "bg-slate-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                prefs.transferEvents ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Preference Item 6: Security & Administrative */}
        <div className="p-5 flex items-start justify-between gap-4 hover:bg-slate-50/50 transition-colors">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600 flex-shrink-0 mt-0.5">
              <Lock className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Routine Security & System Events</h3>
                <Badge variant="danger" size="sm">
                  Security
                </Badge>
              </div>
              <p className="text-xs text-slate-500 max-w-xl">
                Routine session logins, administrative role assignments, and standard audit notifications. (Note: Critical alerts bypass this filter).
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.securityAlerts}
            onClick={() => handleToggle("securityAlerts")}
            disabled={loading}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              prefs.securityAlerts ? "bg-teal-600" : "bg-slate-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                prefs.securityAlerts ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Metadata footer */}
      {lastUpdated && (
        <div className="text-xs text-slate-400 text-right">
          Preferences last synchronized: {new Date(lastUpdated).toLocaleString()}
        </div>
      )}
    </div>
  );
}
