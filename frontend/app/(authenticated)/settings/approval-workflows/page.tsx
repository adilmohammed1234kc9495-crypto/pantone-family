"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  GitMerge,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Shield,
  Layers,
  HelpCircle,
  Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

interface WorkflowStep {
  id?: string;
  step_order: number;
  role_code: string;
  description: string | null;
}

interface WorkflowItem {
  id: string;
  company_id: string;
  company_name?: string;
  name: string;
  request_type: string;
  description: string | null;
  is_active: boolean;
  steps: WorkflowStep[];
  created_at: string;
}

const AVAILABLE_ROLES = [
  { code: "DEPT_MANAGER", label: "Department Manager (Initial Authorization)" },
  { code: "ASSET_MANAGER", label: "Asset Manager (Custody & Technical Evaluation)" },
  { code: "COMPANY_ADMIN", label: "Company Administrator (Executive Clearance)" },
  { code: "FINANCE_HEAD", label: "Finance / Budget Controller" },
  { code: "IT_ADMIN", label: "IT / Tech Lead" },
];

export default function ApprovalWorkflowsPage() {
  const { user, hasPermission } = useAuth();

  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Workflow Builder Modal
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [workflowName, setWorkflowName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<Array<{ stepNumber: number; roleCode: string; description: string }>>([
    { stepNumber: 1, roleCode: "DEPT_MANAGER", description: "Department Manager Initial Authorization" },
    { stepNumber: 2, roleCode: "ASSET_MANAGER", description: "Asset Manager Technical Evaluation" },
    { stepNumber: 3, roleCode: "COMPANY_ADMIN", description: "Executive Financial Clearance" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);

  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient<WorkflowItem[]>("/approval-workflows");
      setWorkflows(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err.message || "Failed to load approval workflows");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleAddStep = () => {
    const nextOrder = steps.length + 1;
    setSteps([
      ...steps,
      {
        stepNumber: nextOrder,
        roleCode: "ASSET_MANAGER",
        description: `Stage ${nextOrder} Authorization`,
      },
    ]);
  };

  const handleRemoveStep = (indexToRemove: number) => {
    if (steps.length <= 1) return;
    const remaining = steps.filter((_, idx) => idx !== indexToRemove);
    // Re-index sequentially without gaps
    const reindexed = remaining.map((s, idx) => ({
      ...s,
      stepNumber: idx + 1,
    }));
    setSteps(reindexed);
  };

  const handleStepChange = (index: number, field: string, value: string) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuilderError(null);
    setSubmitting(true);

    try {
      await apiClient.post("/approval-workflows", {
        name: workflowName.trim(),
        description: description.trim() || undefined,
        requestType: "ASSET_REQUEST",
        steps: steps.map((s) => ({
          stepNumber: s.stepNumber,
          roleCode: s.roleCode,
          description: s.description || undefined,
        })),
      });

      setIsBuilderOpen(false);
      setWorkflowName("");
      setDescription("");
      fetchWorkflows();
    } catch (err: any) {
      setBuilderError(err.message || "Failed to configure workflow");
    } finally {
      setSubmitting(false);
    }
  };

  const activeWorkflow = workflows.find((w) => w.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Approval Workflows & Policy"
        description="Define multi-tier approval sequences, mandatory stages, and approver role hierarchy."
        icon={GitMerge}
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Settings", href: "/settings" },
          { label: "Approval Workflows" },
        ]}
        actions={
          (user?.isCommonAdmin || hasPermission("approval_config:manage")) ? (
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setIsBuilderOpen(true)}
            >
              Configure New Workflow
            </Button>
          ) : undefined
        }
      />

      {/* Active Workflow Pipeline Flow Chart */}
      {activeWorkflow && (
        <div className="p-6 rounded-xl bg-white border border-teal-200/90 shadow-subtle space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Authoritative Active Workflow: {activeWorkflow.name}
              </h2>
            </div>
            <span className="text-xs font-mono font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
              {activeWorkflow.steps?.length || 0} Approval Tiers Configured
            </span>
          </div>

          <p className="text-xs text-slate-600">
            {activeWorkflow.description || "Default company asset requisition authorization pipeline."}
          </p>

          {/* Sequential Step Diagram */}
          <div className="pt-2 flex flex-col md:flex-row items-center gap-3 overflow-x-auto pb-2">
            {activeWorkflow.steps?.map((step, idx) => (
              <React.Fragment key={step.id || idx}>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 min-w-[220px] flex-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Stage {step.step_order}</span>
                    <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-700 font-bold border border-teal-200 text-2xs">
                      Tier {step.step_order}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-1.5">
                    {step.role_code.replace("_", " ")}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {step.description || "Authorization clearance required"}
                  </p>
                </div>
                {idx < (activeWorkflow.steps?.length || 0) - 1 && (
                  <ArrowRight className="w-5 h-5 text-teal-600 hidden md:block flex-shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Historical / Configured Workflows Table */}
      <div className="rounded-xl border border-slate-200/90 bg-white overflow-hidden shadow-subtle space-y-3">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Configured Workflows History ({workflows.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={4} />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-sm">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-80" />
            <p className="font-semibold">{error}</p>
          </div>
        ) : workflows.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={GitMerge}
              title="No workflows configured"
              description="Configure an approval workflow to manage requisition lifecycles."
              actionLabel="Configure New Workflow"
              onAction={() => setIsBuilderOpen(true)}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Workflow Name</th>
                  <th className="px-4 py-3">Request Type</th>
                  <th className="px-4 py-3">Approval Tiers</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Created On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workflows.map((wf) => (
                  <tr key={wf.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{wf.name}</div>
                      {wf.description && (
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">
                          {wf.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {wf.request_type}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {wf.steps?.map((s) => (
                          <span
                            key={s.step_order}
                            className="px-2 py-0.5 rounded text-[10px] bg-slate-100 border border-slate-200 text-slate-700"
                          >
                            {s.step_order}. {s.role_code}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {wf.is_active ? (
                        <Badge variant="success">ACTIVE</Badge>
                      ) : (
                        <Badge variant="neutral">INACTIVE</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono">
                      {new Date(wf.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Visual Workflow Builder Modal */}
      <Modal
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        title="Visual Approval Workflow Builder"
        maxWidth="xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {builderError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {builderError}
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Workflow Policy Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Standard Multi-Tier Equipment Workflow"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Workflow Description / Purpose
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Mandatory 3-tier sequence for capital expenditure..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none shadow-2xs"
            />
          </div>

          {/* Sequential Stages Builder */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Sequential Stages (Ordered Without Gaps)
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={Plus}
                onClick={handleAddStep}
              >
                Add Stage
              </Button>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {steps.map((st, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-3"
                >
                  <span className="w-6 h-6 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-bold flex items-center justify-center flex-shrink-0 text-xs">
                    {st.stepNumber}
                  </span>

                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <select
                      value={st.roleCode}
                      onChange={(e) => handleStepChange(idx, "roleCode", e.target.value)}
                      className="px-2 py-1.5 bg-white border border-slate-300 rounded text-slate-900 text-xs shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
                    >
                      {AVAILABLE_ROLES.map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.label}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="Stage description (optional)..."
                      value={st.description}
                      onChange={(e) => handleStepChange(idx, "description", e.target.value)}
                      className="px-2 py-1.5 bg-white border border-slate-300 rounded text-slate-900 text-xs shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
                    />
                  </div>

                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(idx)}
                      className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                      title="Remove Stage"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsBuilderOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={submitting}
            >
              Save & Activate Workflow
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
