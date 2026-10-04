"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Globe,
  Building2,
  LogOut,
  ChevronDown,
  Check,
  Bell,
  Menu,
  User,
  Settings,
  BellRing,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { notificationsApi } from "@/lib/api";

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout, companyContext, setCompanyContext, availableCompanies } = useAuth();
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const companyDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        companyDropdownRef.current &&
        !companyDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCompanyDropdownOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const res = await notificationsApi.getUnreadCount();
        setUnreadCount(res.unreadCount || 0);
      } catch {
        // Non-blocking
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const selectedCompany = availableCompanies.find((c) => c.id === companyContext);

  const handleSelectContext = (companyId: string | null) => {
    setCompanyContext(companyId);
    setIsCompanyDropdownOpen(false);
    // Reload page to re-fetch tenant data cleanly
    window.location.reload();
  };

  const userInitials = (user?.username || "U")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      {/* Left: Mobile Hamburger & Company Context Switcher */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Hamburger Button */}
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="md:hidden p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Company Context Indicator / Switcher */}
        {user?.isCommonAdmin ? (
          <div className="relative" ref={companyDropdownRef}>
            <button
              onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-slate-300/80 bg-slate-50/70 hover:bg-slate-100/80 text-xs sm:text-sm font-medium text-slate-800 transition-colors shadow-2xs"
              aria-expanded={isCompanyDropdownOpen}
              aria-haspopup="true"
            >
              {companyContext ? (
                <>
                  <Building2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
                  <span className="truncate max-w-[130px] sm:max-w-[200px]">
                    {selectedCompany?.name || "Selected Company"}
                  </span>
                  <span className="hidden sm:inline-block text-[11px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-mono">
                    {selectedCompany?.code}
                  </span>
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <span className="font-semibold text-slate-900">GLOBAL View</span>
                  <span className="hidden sm:inline-block text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    All Companies
                  </span>
                </>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>

            {isCompanyDropdownOpen && (
              <div className="absolute left-0 mt-2 w-72 bg-white rounded-lg shadow-elevated border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  Authority Scope
                </div>

                {/* Global Option */}
                <button
                  onClick={() => handleSelectContext(null)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs sm:text-sm text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900">GLOBAL System View</div>
                      <div className="text-[11px] text-slate-500">Cross-company oversight</div>
                    </div>
                  </div>
                  {!companyContext && <Check className="w-4 h-4 text-teal-600 flex-shrink-0" />}
                </button>

                <div className="my-1 border-t border-slate-100" />

                {/* Registered Companies */}
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Switch to Tenant
                </div>
                {availableCompanies.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectContext(c.id)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs sm:text-sm text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Building2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-slate-900">{c.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{c.code}</div>
                      </div>
                    </div>
                    {companyContext === c.id && <Check className="w-4 h-4 text-teal-600 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium text-slate-800">
            <Building2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
            <span className="truncate max-w-[140px] sm:max-w-none">
              {user?.companyName || "Pantone Enterprise"}
            </span>
            <span className="hidden sm:inline-block text-[11px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">
              {user?.companyCode}
            </span>
          </div>
        )}
      </div>

      {/* Right: Notifications & User Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notification Bell */}
        <Link
          href="/notifications"
          title="Notification Center"
          className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
          aria-label={`Notifications, ${unreadCount} unread`}
        >
          <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-xs">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

        <div className="h-5 w-px bg-slate-200" />

        {/* User Menu Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-md hover:bg-slate-100 transition-colors text-left"
            aria-expanded={isUserMenuOpen}
            aria-haspopup="true"
          >
            <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-semibold shadow-2xs">
              {userInitials}
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                <span>{user?.username}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </div>
              <div className="text-[11px] text-slate-500">{user?.roleName || user?.roleCode}</div>
            </div>
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-elevated border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
              {/* Profile Card Header */}
              <div className="px-3.5 py-2.5 border-b border-slate-100">
                <div className="font-semibold text-sm text-slate-900 leading-tight">
                  {user?.username}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">{user?.email}</div>
                <div className="mt-2 flex items-center gap-1.5">
                  <Badge variant={user?.isCommonAdmin ? "brand" : "neutral"} size="sm">
                    {user?.roleName || user?.roleCode}
                  </Badge>
                  {user?.companyCode && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {user.companyCode}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Navigation Links */}
              <div className="py-1">
                <Link
                  href="/notifications"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Bell className="w-3.5 h-3.5 text-slate-400" />
                  <span>Notification Center</span>
                  {unreadCount > 0 && (
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                      {unreadCount}
                    </span>
                  )}
                </Link>
                <Link
                  href="/settings/notifications"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <BellRing className="w-3.5 h-3.5 text-slate-400" />
                  <span>Notification Preferences</span>
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  <span>System Settings</span>
                </Link>
              </div>

              <div className="border-t border-slate-100 my-1" />

              {/* Logout Action */}
              <div className="px-1.5">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded transition-colors text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
