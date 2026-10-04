"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  Building2,
  GitBranch,
  Briefcase,
  MapPin,
  Truck,
  Tags,
  PackageCheck,
  PlusCircle,
  Users,
  ShieldCheck,
  Settings,
  Layers,
  UserCheck,
  RotateCcw,
  AlertTriangle,
  Wrench,
  Boxes,
  ClipboardList,
  CheckSquare,
  GitMerge,
  ArrowLeftRight,
  QrCode,
  Printer,
  BarChart3,
  DollarSign,
  Bell,
  BellRing,
  X,
} from "lucide-react";
import clsx from "clsx";

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, hasPermission } = useAuth();

  const sections = [
    {
      title: "Overview",
      items: [
        {
          label: "Dashboard",
          href: "/dashboard",
          icon: LayoutDashboard,
          show: true,
        },
        {
          label: "Notifications",
          href: "/notifications",
          icon: Bell,
          show: true,
        },
      ],
    },
    {
      title: "Fixed Assets",
      items: [
        {
          label: "Asset Register",
          href: "/assets",
          icon: PackageCheck,
          show: user?.isCommonAdmin || hasPermission("assets:view"),
        },
        {
          label: "Register New Asset",
          href: "/assets/new",
          icon: PlusCircle,
          show: user?.isCommonAdmin || hasPermission("assets:create"),
        },
        {
          label: "Barcode / QR Labels",
          href: "/assets/labels",
          icon: Printer,
          show: user?.isCommonAdmin || hasPermission("labels:view") || hasPermission("assets:view"),
        },
      ],
    },
    {
      title: "Operations",
      items: [
        {
          label: "Scan QR / Barcode",
          href: "/scan",
          icon: QrCode,
          show: user?.isCommonAdmin || hasPermission("scan:view") || hasPermission("assets:view"),
        },
        {
          label: "Custody Assignments",
          href: "/assignments",
          icon: UserCheck,
          show: user?.isCommonAdmin || hasPermission("assignments:view"),
        },
        {
          label: "Asset Returns",
          href: "/returns",
          icon: RotateCcw,
          show: user?.isCommonAdmin || hasPermission("assignments:view") || hasPermission("assignments:return"),
        },
        {
          label: "Damage Inspections",
          href: "/damage-inspections",
          icon: AlertTriangle,
          show: user?.isCommonAdmin || hasPermission("assets:view") || hasPermission("maintenance:view"),
        },
        {
          label: "Maintenance Orders",
          href: "/maintenance",
          icon: Wrench,
          show: user?.isCommonAdmin || hasPermission("maintenance:view"),
        },
        {
          label: "Asset Transfers",
          href: "/transfers",
          icon: ArrowLeftRight,
          show: user?.isCommonAdmin || hasPermission("transfers:view") || hasPermission("assets:view"),
        },
      ],
    },
    {
      title: "Inventory & Requisitions",
      items: [
        {
          label: "Stock Inventory",
          href: "/stock",
          icon: Boxes,
          show: user?.isCommonAdmin || hasPermission("stock:view"),
        },
        {
          label: "Asset Requisitions",
          href: "/requests",
          icon: ClipboardList,
          show: user?.isCommonAdmin || hasPermission("requests:view"),
        },
        {
          label: "Pending Approvals",
          href: "/approvals",
          icon: CheckSquare,
          show: user?.isCommonAdmin || hasPermission("approvals:view"),
        },
      ],
    },
    {
      title: "Reports & Intelligence",
      items: [
        {
          label: "Executive Dashboard",
          href: "/reports",
          icon: BarChart3,
          show: user?.isCommonAdmin || hasPermission("reports:view"),
        },
        {
          label: "Asset Register Report",
          href: "/reports/assets",
          icon: PackageCheck,
          show: user?.isCommonAdmin || hasPermission("reports:assets") || hasPermission("reports:view"),
        },
        {
          label: "Straight-Line Depreciation",
          href: "/reports/depreciation",
          icon: DollarSign,
          show: user?.isCommonAdmin || hasPermission("reports:depreciation") || hasPermission("reports:view"),
        },
        {
          label: "Transfers & Movements",
          href: "/reports/transfers",
          icon: ArrowLeftRight,
          show: user?.isCommonAdmin || hasPermission("reports:transfers") || hasPermission("reports:view"),
        },
        {
          label: "Custody & Overdue",
          href: "/reports/custody",
          icon: UserCheck,
          show: user?.isCommonAdmin || hasPermission("reports:custody") || hasPermission("reports:view"),
        },
        {
          label: "Maintenance Work Orders",
          href: "/reports/maintenance",
          icon: Wrench,
          show: user?.isCommonAdmin || hasPermission("reports:maintenance") || hasPermission("reports:view"),
        },
        {
          label: "Stock & Inventory",
          href: "/reports/stock",
          icon: Boxes,
          show: user?.isCommonAdmin || hasPermission("reports:stock") || hasPermission("reports:view"),
        },
        {
          label: "Requisitions Report",
          href: "/reports/requests",
          icon: ClipboardList,
          show: user?.isCommonAdmin || hasPermission("reports:requests") || hasPermission("reports:view"),
        },
        {
          label: "Audit Event Trail",
          href: "/reports/audit",
          icon: ShieldCheck,
          show: user?.isCommonAdmin || hasPermission("reports:audit") || hasPermission("reports:view"),
        },
        {
          label: "Physical Scans Ledger",
          href: "/reports/scans",
          icon: QrCode,
          show: user?.isCommonAdmin || hasPermission("reports:scans") || hasPermission("reports:view"),
        },
      ],
    },
    {
      title: "Master Data",
      items: [
        {
          label: "Companies",
          href: "/companies",
          icon: Building2,
          show: user?.isCommonAdmin || hasPermission("companies:view"),
        },
        {
          label: "Branches",
          href: "/branches",
          icon: GitBranch,
          show: user?.isCommonAdmin || hasPermission("branches:view"),
        },
        {
          label: "Departments",
          href: "/departments",
          icon: Briefcase,
          show: user?.isCommonAdmin || hasPermission("departments:view"),
        },
        {
          label: "Locations",
          href: "/locations",
          icon: MapPin,
          show: user?.isCommonAdmin || hasPermission("locations:view"),
        },
        {
          label: "Vendors",
          href: "/vendors",
          icon: Truck,
          show: user?.isCommonAdmin || hasPermission("vendors:view"),
        },
        {
          label: "Asset Categories",
          href: "/categories",
          icon: Tags,
          show: user?.isCommonAdmin || hasPermission("categories:view"),
        },
      ],
    },
    {
      title: "Administration",
      items: [
        {
          label: "User Registry",
          href: "/users",
          icon: Users,
          show: user?.isCommonAdmin || hasPermission("users:view"),
        },
        {
          label: "Security Audit Ledger",
          href: "/audit",
          icon: ShieldCheck,
          show: user?.isCommonAdmin || hasPermission("audit:view"),
        },
        {
          label: "Approval Workflows",
          href: "/settings/approval-workflows",
          icon: GitMerge,
          show: user?.isCommonAdmin || hasPermission("approval_config:view"),
        },
        {
          label: "Notification Prefs",
          href: "/settings/notifications",
          icon: BellRing,
          show: true,
        },
        {
          label: "System Settings",
          href: "/settings",
          icon: Settings,
          show: true,
        },
      ],
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-300">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 flex-shrink-0">
        <Link href="/dashboard" className="flex items-center gap-3 group" onClick={onMobileClose}>
          <div className="w-8 h-8 rounded-md bg-teal-600 flex items-center justify-center text-white font-bold shadow-xs">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div className="leading-tight">
            <span className="font-bold text-white tracking-tight text-sm block">
              PANTONE
            </span>
            <span className="text-[10px] uppercase font-semibold text-teal-400 tracking-wider">
              Asset System
            </span>
          </div>
        </Link>

        {/* Mobile Close Button */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="md:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto" tabIndex={-1}>
        {sections.map((sec) => {
          const visibleItems = sec.items.filter((item) => item.show);
          if (visibleItems.length === 0) return null;

          return (
            <div key={sec.title} className="space-y-1">
              <p className="px-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {sec.title}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" &&
                      item.href !== "/assets" &&
                      item.href !== "/reports" &&
                      pathname.startsWith(item.href)) ||
                    (item.href === "/assets" && pathname === "/assets") ||
                    (item.href === "/reports" && pathname === "/reports");

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onMobileClose}
                      className={clsx(
                        "relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors duration-100",
                        isActive
                          ? "bg-slate-800 text-teal-300 font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:bg-teal-500 before:rounded-r"
                          : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                      )}
                    >
                      <Icon
                        className={clsx(
                          "w-4 h-4 flex-shrink-0",
                          isActive ? "text-teal-400" : "text-slate-400"
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 text-slate-500 flex-shrink-0 text-xs">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-slate-400">Pantone Enterprises</span>
          <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-slate-800 text-slate-400">v1.0</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-60 flex-col h-screen sticky top-0 flex-shrink-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <div className="relative w-64 max-w-[80vw] h-full shadow-2xl z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
