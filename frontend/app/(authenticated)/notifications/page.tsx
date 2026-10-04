"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  Check,
  CheckCheck,
  RefreshCw,
  ExternalLink,
  Sliders,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { notificationsApi } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

interface NotificationItem {
  id: string;
  user_id: string;
  company_id: string | null;
  notification_type: string;
  title: string;
  message: string;
  severity: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";
  is_read: boolean;
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  created_at: string;
  read_at: string | null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(15);
  const [loading, setLoading] = useState<boolean>(true);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Filter states
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [readFilter, setReadFilter] = useState<string>("ALL");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const isReadParam =
        readFilter === "UNREAD" ? false : readFilter === "READ" ? true : undefined;
      const severityParam = severityFilter === "ALL" ? undefined : severityFilter;

      const [listRes, countRes] = await Promise.all([
        notificationsApi.list({
          page,
          limit,
          isRead: isReadParam,
          severity: severityParam,
        }),
        notificationsApi.getUnreadCount(),
      ]);

      setNotifications(listRes.notifications || []);
      setTotal(listRes.total || 0);
      setUnreadCount(countRes.unreadCount || 0);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, readFilter, severityFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return {
          icon: AlertOctagon,
          bg: "bg-rose-50 text-rose-700 border-rose-200",
          cardBorder: "border-l-4 border-l-rose-600",
          iconColor: "text-rose-600",
        };
      case "WARNING":
        return {
          icon: AlertTriangle,
          bg: "bg-amber-50 text-amber-700 border-amber-200",
          cardBorder: "border-l-4 border-l-amber-500",
          iconColor: "text-amber-500",
        };
      case "SUCCESS":
        return {
          icon: CheckCircle2,
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          cardBorder: "border-l-4 border-l-emerald-600",
          iconColor: "text-emerald-600",
        };
      case "INFO":
      default:
        return {
          icon: Info,
          bg: "bg-slate-100 text-slate-700 border-slate-200",
          cardBorder: "border-l-4 border-l-slate-400",
          iconColor: "text-slate-500",
        };
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 24));

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Center"
        description="System operational alerts, approval workflows, and audit security events"
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Notifications" },
        ]}
        badge={
          unreadCount > 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              {unreadCount} unread
            </span>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            <Link href="/settings/notifications">
              <Button variant="secondary" size="sm">
                <Sliders className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                Preferences
              </Button>
            </Link>

            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                <CheckCheck className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
                Mark All as Read
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData()}
              disabled={loading}
              title="Refresh notifications"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200/90 shadow-subtle text-xs">
        {/* Read / Unread Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">Status:</span>
          {[
            { id: "ALL", label: "All" },
            { id: "UNREAD", label: "Unread" },
            { id: "READ", label: "Read" },
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setReadFilter(r.id);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                readFilter === r.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Severity Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">Severity:</span>
          {["ALL", "CRITICAL", "WARNING", "SUCCESS", "INFO"].map((s) => (
            <button
              key={s}
              onClick={() => {
                setSeverityFilter(s);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                severityFilter === s
                  ? "bg-teal-700 text-white"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
              }`}
            >
              {s === "ALL" ? "All Levels" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Notification List */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 bg-white rounded-lg border border-slate-200/90 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-teal-600 mb-2.5" />
            <p className="text-xs font-medium text-slate-500">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications found"
            description="You are all caught up! Operational alerts, approval workflows, and system events will appear here."
            action={
              readFilter !== "ALL" || severityFilter !== "ALL"
                ? {
                    label: "Reset filters",
                    onClick: () => {
                      setReadFilter("ALL");
                      setSeverityFilter("ALL");
                      setPage(1);
                    },
                  }
                : undefined
            }
          />
        ) : (
          notifications.map((n) => {
            const sev = getSeverityBadge(n.severity);
            const SevIcon = sev.icon;

            return (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.is_read) handleMarkRead(n.id);
                  if (n.action_url) router.push(n.action_url);
                }}
                className={`group flex items-start gap-3.5 p-3.5 rounded-lg border transition-all cursor-pointer shadow-subtle ${
                  n.is_read
                    ? "bg-white border-slate-200/90 text-slate-600 hover:border-slate-300"
                    : "bg-teal-50/20 border-teal-200/80 text-slate-900 hover:border-teal-300"
                } ${sev.cardBorder}`}
              >
                {/* Severity Icon */}
                <div className={`p-1.5 rounded-md ${sev.bg} flex-shrink-0 mt-0.5`}>
                  <SevIcon className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-sm tracking-tight ${
                        n.is_read ? "font-medium text-slate-800" : "font-semibold text-slate-900"
                      }`}
                    >
                      {n.title}
                    </span>

                    <span className={`px-1.5 py-0.2 text-[10px] font-semibold rounded border uppercase tracking-wider ${sev.bg}`}>
                      {n.severity}
                    </span>

                    {n.entity_type && (
                      <span className="px-1.5 py-0.2 text-[10px] font-mono rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {n.entity_type}
                      </span>
                    )}

                    {!n.is_read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-600 flex-shrink-0" />
                    )}
                  </div>

                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>

                  <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400">
                    <span className="font-mono">{formatTimestamp(n.created_at)}</span>
                    {n.action_url && (
                      <span className="flex items-center gap-1 text-teal-700 font-medium hover:underline">
                        <span>Open details</span>
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!n.is_read && (
                    <button
                      onClick={(e) => handleMarkRead(n.id, e)}
                      title="Mark as read"
                      className="p-1 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded border border-transparent hover:border-teal-200 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200/90 pt-3 text-xs text-slate-500">
          <div>
            Showing <span className="font-medium text-slate-800">{(page - 1) * limit + 1}</span> to{" "}
            <span className="font-medium text-slate-800">
              {Math.min(page * limit, total)}
            </span>{" "}
            of <span className="font-medium text-slate-800">{total}</span> notifications
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2.5 py-1 font-medium text-slate-800">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
