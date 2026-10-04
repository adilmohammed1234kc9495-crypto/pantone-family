"use client";

import React from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Settings,
  Shield,
  Building2,
  Key,
  Server,
  Lock,
  CheckCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <PageHeader
        title="System Configuration & Tenant Governance"
        description="Security architecture, tenant boundary information, and active administrative session parameters."
        icon={<Settings className="w-5 h-5 text-teal-600" />}
        breadcrumbs={[
          { label: "Settings" },
          { label: "Governance & Security" },
        ]}
      />

      {/* Tenant Context Information Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-teal-50 text-teal-600">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Active Tenant Organization</h2>
            <p className="text-xs text-slate-500">Multi-tenant boundary resolution for current session</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-sm">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-xs text-slate-400 block font-medium">Assigned Company</span>
            <span className="font-semibold text-slate-800">
              {user?.companyName || "Global Common Admin (Unscoped Authority)"}
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-xs text-slate-400 block font-medium">Company Code</span>
            <span className="font-mono font-bold text-slate-800">
              {user?.companyCode || "GLOBAL_ROOT"}
            </span>
          </div>
        </div>
      </div>

      {/* Session Security & Cryptography */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Session & Security Architecture</h2>
            <p className="text-xs text-slate-500">Phase 2 zero-trust authentication configuration</p>
          </div>
        </div>

        <div className="space-y-3 pt-2 text-sm">
          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50">
            <span className="text-slate-600">JWT Access Token Expiration</span>
            <span className="font-mono text-xs font-semibold text-slate-800">15 minutes (Stateless)</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50">
            <span className="text-slate-600">Refresh Token Rotation</span>
            <span className="font-mono text-xs font-semibold text-emerald-600">Active (SHA-256 One-Time Use)</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50">
            <span className="text-slate-600">Password Hashing Algorithm</span>
            <span className="font-mono text-xs font-semibold text-slate-800">Bcrypt (Cost Factor: 12)</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50">
            <span className="text-slate-600">Brute Force Protection</span>
            <span className="font-mono text-xs font-semibold text-slate-800">Atomic IP Lockout (5 attempts, 15m cooldown)</span>
          </div>
        </div>
      </div>

      {/* Effective Permissions Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Effective Authorizations</h2>
            <p className="text-xs text-slate-500">
              Resolved permissions granted to {user?.username} ({user?.roleName || user?.roleCode})
            </p>
          </div>
        </div>

        <div className="pt-2">
          {user?.isCommonAdmin ? (
            <div className="p-4 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-sm flex items-center gap-2.5">
              <CheckCircle className="w-5 h-5 text-teal-600 flex-shrink-0" />
              <span>
                <strong>Unrestricted Global Master Authority:</strong> Common Administrator bypasses company barriers with full administrative access across all modules.
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {user?.permissions.map((p) => (
                <span
                  key={p}
                  className="px-2.5 py-1 text-xs font-mono font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-200"
                >
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
