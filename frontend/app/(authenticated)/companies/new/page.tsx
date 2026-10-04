"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import { Building2, ArrowLeft, Save, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

export default function NewCompanyPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();

  const [form, setForm] = useState({
    code: "",
    name: "",
    taxId: "",
    phone: "",
    email: "",
    address: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canCreate = user?.isCommonAdmin || hasPermission("companies:manage");

  if (!canCreate) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Access Denied</h2>
        <p className="text-sm text-slate-500 mt-1">
          You do not have the required administrative permission (<code className="font-mono text-xs">companies:manage</code>) to register new enterprise companies.
        </p>
        <Link
          href="/companies"
          className="inline-block mt-4 px-4 py-2 text-sm font-semibold text-teal-600 hover:text-teal-700"
        >
          &larr; Return to Companies Directory
        </Link>
      </div>
    );
  }

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.code.trim()) {
      errs.code = "Company code is required (e.g. PANTONE-TEX).";
    } else if (form.code.trim().length < 2 || form.code.trim().length > 50) {
      errs.code = "Company code must be between 2 and 50 characters.";
    }

    if (!form.name.trim()) {
      errs.name = "Company legal name is required.";
    } else if (form.name.trim().length < 2 || form.name.trim().length > 255) {
      errs.name = "Company name must be between 2 and 255 characters.";
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = "Please enter a valid official email address.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validate()) return;

    setSubmitting(true);
    try {
      const created = await apiClient<{ id: string; code: string; name: string }>("/companies", {
        method: "POST",
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          taxId: form.taxId.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          address: form.address.trim() || undefined,
        }),
      });

      router.push(`/companies/${created.id}`);
    } catch (err: any) {
      setGeneralError(err?.message || "Failed to create company");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb Header */}
      <PageHeader
        title="Register New Enterprise Company"
        description="Create an authoritative enterprise tenant boundary for asset management."
        icon={<Building2 className="w-5 h-5 text-teal-600" />}
        breadcrumbs={[
          { label: "Settings" },
          { label: "Companies", href: "/companies" },
          { label: "New Company" },
        ]}
      />

      {generalError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-rose-700 font-medium">{generalError}</div>
        </div>
      )}

      {/* Form Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Company Code *
              </label>
              <input
                type="text"
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="e.g. PANTONE-TEX"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg uppercase font-mono placeholder:normal-case placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              {errors.code ? (
                <p className="text-xs text-rose-600 mt-1">{errors.code}</p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">Unique uppercase company identifier</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Legal Company Name *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Pantone Textiles Private Limited"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              {errors.name && (
                <p className="text-xs text-rose-600 mt-1">{errors.name}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Tax Identification / GSTIN
              </label>
              <input
                type="text"
                value={form.taxId}
                onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                placeholder="e.g. TAX-TEX-9921"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Contact Phone
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. +91-11-45678900"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Official Corporate Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="contact@pantone-textiles.com"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            {errors.email && (
              <p className="text-xs text-rose-600 mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Registered Physical Address
            </label>
            <textarea
              rows={3}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Registered factory or corporate office location..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Link href="/companies">
              <Button variant="outline" size="md">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={submitting}
              variant="primary"
              size="md"
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? "Creating Entity..." : "Register Company"}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
