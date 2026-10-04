"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  apiClient,
  getAccessToken,
  setAccessToken,
  setRefreshToken,
  getRefreshToken,
  getStoredCompanyContext,
  setStoredCompanyContext,
  clearAuthStorage,
} from "./api";

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  companyId: string | null;
  companyCode: string | null;
  companyName: string | null;
  roleId: string;
  roleCode: string;
  roleName: string;
  employeeId: string | null;
  departmentId: string | null;
  employeeCode: string | null;
  isCommonAdmin: boolean;
  permissions: string[];
}

export interface CompanySummary {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  companyContext: string | null;
  availableCompanies: CompanySummary[];
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setCompanyContext: (companyId: string | null) => void;
  hasPermission: (permissionCode: string) => boolean;
  hasRole: (roleCode: string) => boolean;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [companyContext, setCompanyContextState] = useState<string | null>(null);
  const [availableCompanies, setAvailableCompanies] = useState<CompanySummary[]>([]);

  // Load companies for the switcher if user is Common Admin
  const fetchAvailableCompanies = useCallback(async () => {
    try {
      const companies = await apiClient<CompanySummary[]>("/companies");
      setAvailableCompanies(companies);
    } catch {
      // Ignore if not permitted or network down
    }
  }, []);

  const refreshUserProfile = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const profile = await apiClient<UserProfile>("/auth/me");
      setUser(profile);

      if (profile.isCommonAdmin) {
        await fetchAvailableCompanies();
      }
    } catch {
      clearAuthStorage();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetchAvailableCompanies]);

  useEffect(() => {
    const storedContext = getStoredCompanyContext();
    if (storedContext) {
      setCompanyContextState(storedContext);
    }
    refreshUserProfile();
  }, [refreshUserProfile]);

  const login = async (username: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await apiClient<{
        user: UserProfile;
        accessToken: string;
        refreshToken: string;
      }>("/auth/login", {
        method: "POST",
        requiresAuth: false,
        body: JSON.stringify({ username, password }),
      });

      setAccessToken(res.accessToken);
      setRefreshToken(res.refreshToken);
      setUser(res.user);

      if (res.user.isCommonAdmin) {
        await fetchAvailableCompanies();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    const currentRefreshToken = getRefreshToken();
    try {
      if (currentRefreshToken) {
        await apiClient("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken: currentRefreshToken }),
        });
      }
    } catch {
      // Continue client cleanup regardless
    } finally {
      clearAuthStorage();
      setUser(null);
      setCompanyContextState(null);
      window.location.href = "/login";
    }
  };

  const setCompanyContext = (companyId: string | null) => {
    setCompanyContextState(companyId);
    setStoredCompanyContext(companyId);
  };

  const hasPermission = (permissionCode: string): boolean => {
    if (!user) return false;
    if (user.isCommonAdmin) return true;
    return user.permissions.includes(permissionCode);
  };

  const hasRole = (roleCode: string): boolean => {
    if (!user) return false;
    return user.roleCode === roleCode;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        companyContext,
        availableCompanies,
        login,
        logout,
        setCompanyContext,
        hasPermission,
        hasRole,
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
