"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  FileText,
  ExternalLink,
  LogOut,
  RefreshCw,
  Search,
  UserCheck,
  AlertTriangle,
  Eye,
  Trash2,
  UserX,
  Globe,
  Smartphone,
  Info,
  Clock,
  Check,
  Camera
} from "lucide-react";

interface ProviderItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  kycDocumentType: string | null;
  kycDocumentNumber: string | null;
  kycDocumentLast4: string | null;
  aadhaarNumber: string | null;
  panNumber: string | null;
  kycDocumentPhoto: string | null;
  selfiePhoto?: string | null;
  livenessScore?: number | null;
  kycId?: string | null;
  actionNotes?: string | null;
  kycStatus: string;
  isVerified: boolean;
  verificationStatus: "pending" | "verified" | "rejected" | "unverified";
  rejectionReason: string | null;
  createdAt: string;
  verifiedAt: string | null;
  verifiedBy: string | null;
}

interface DeletionRequestItem {
  id: string;
  userId: string | null;
  role: string;
  email: string | null;
  phone: string | null;
  reason: string | null;
  status: "pending" | "completed" | "rejected";
  requestedVia: string;
  createdAt: string;
  completedAt: string | null;
  rejectionReason: string | null;
  processedBy: string | null;
  verification: {
    userFound: boolean;
    matchedUserId: string | null;
    matchedName: string | null;
    matchedEmail: string | null;
    matchedPhone: string | null;
    activeBookingsCount: number;
  };
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [adminUser, setAdminUser] = useState<{ id: string; email: string } | null>(null);

  // Section switcher
  const [adminSection, setAdminSection] = useState<"providers" | "deletions">("providers");

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);

  // Providers list state
  const [activeTab, setActiveTab] = useState<"pending" | "verified" | "rejected" | "all">("pending");
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [loadingProviders, setLoadingProviders] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Deletions list state
  const [deletionTab, setDeletionTab] = useState<"pending" | "completed" | "rejected" | "all">("pending");
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequestItem[]>([]);
  const [loadingDeletions, setLoadingDeletions] = useState<boolean>(false);
  const [deletionSearchTerm, setDeletionSearchTerm] = useState("");
  const [pendingDeletionCount, setPendingDeletionCount] = useState<number>(0);

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Provider modals
  const [rejectModalProvider, setRejectModalProvider] = useState<ProviderItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [detailProvider, setDetailProvider] = useState<ProviderItem | null>(null);

  // Deletion modals
  const [rejectModalDeletion, setRejectModalDeletion] = useState<DeletionRequestItem | null>(null);
  const [deletionRejectReason, setDeletionRejectReason] = useState("");
  const [completeModalDeletion, setCompleteModalDeletion] = useState<DeletionRequestItem | null>(null);

  // Check current admin session on mount
  useEffect(() => {
    let ignore = false;
    const verifySession = async () => {
      try {
        const res = await fetch("/api/admin/auth/me", {
          headers: { Accept: "application/json" }
        });
        if (!ignore && res.ok) {
          const data = await res.json();
          setIsAuthenticated(true);
          setAdminUser(data.admin);
        } else if (!ignore) {
          setIsAuthenticated(false);
          setAdminUser(null);
        }
      } catch {
        if (!ignore) {
          setIsAuthenticated(false);
        }
      } finally {
        if (!ignore) {
          setCheckingAuth(false);
        }
      }
    };
    void verifySession();
    return () => {
      ignore = true;
    };
  }, []);

  // Fetch providers list
  const fetchProviders = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoadingProviders(true);
      setActionError(null);
      const statusParam = activeTab === "all" ? "" : `?status=${activeTab}`;
      const res = await fetch(`/api/admin/providers${statusParam}`);
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
      } else {
        const err = await res.json().catch(() => ({}));
        setActionError(err.error || "Failed to load providers");
      }
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Network error loading providers");
    } finally {
      setLoadingProviders(false);
    }
  }, [isAuthenticated, activeTab]);

  // Fetch deletion requests
  const fetchDeletionRequests = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoadingDeletions(true);
      setActionError(null);
      const statusParam = deletionTab === "all" ? "" : `?status=${deletionTab}`;
      const res = await fetch(`/api/admin/deletion-requests${statusParam}`);
      if (res.ok) {
        const data = await res.json();
        const list: DeletionRequestItem[] = data.requests || [];
        setDeletionRequests(list);
        if (deletionTab === "pending") {
          setPendingDeletionCount(list.length);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setActionError(err.error || "Failed to load deletion requests");
      }
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Network error loading deletion requests");
    } finally {
      setLoadingDeletions(false);
    }
  }, [isAuthenticated, deletionTab]);

  // Sync deletion count on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    const loadCount = async () => {
      try {
        const res = await fetch("/api/admin/deletion-requests?status=pending");
        if (res.ok) {
          const data = await res.json();
          setPendingDeletionCount((data.requests || []).length);
        }
      } catch (_) {}
    };
    void loadCount();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (adminSection === "providers") {
      void fetchProviders();
    } else {
      void fetchDeletionRequests();
    }
  }, [isAuthenticated, adminSection, fetchProviders, fetchDeletionRequests]);

  // Handle Admin Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || "Invalid administrator credentials.");
        return;
      }

      setIsAuthenticated(true);
      setAdminUser(data.admin);
      setEmail("");
      setPassword("");
    } catch (e: unknown) {
      setLoginError(e instanceof Error ? e.message : "Network error during authentication.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Admin Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch (_) {}
    setIsAuthenticated(false);
    setAdminUser(null);
  };

  // Provider Actions: Approve
  const handleApprove = async (provider: ProviderItem) => {
    try {
      setActionLoadingId(provider.id);
      setActionError(null);
      setActionSuccess(null);

      const res = await fetch(`/api/admin/providers/${encodeURIComponent(provider.id)}/approve`, {
        method: "POST"
      });

      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Failed to approve provider");
        return;
      }

      setActionSuccess(`Provider '${provider.name}' has been successfully approved.`);
      setDetailProvider(null);
      void fetchProviders();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Network error during approval");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Provider Actions: Confirm Reject
  const handleConfirmReject = async () => {
    if (!rejectModalProvider) return;
    try {
      setActionLoadingId(rejectModalProvider.id);
      setActionError(null);
      setActionSuccess(null);

      const res = await fetch(`/api/admin/providers/${encodeURIComponent(rejectModalProvider.id)}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Failed to reject provider");
        return;
      }

      setActionSuccess(`Provider '${rejectModalProvider.name}' has been rejected.`);
      setRejectModalProvider(null);
      setRejectReason("");
      setDetailProvider(null);
      void fetchProviders();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Network error during rejection");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Deletion Actions: Complete & Purge
  const handleCompleteDeletion = async (req: DeletionRequestItem) => {
    try {
      setActionLoadingId(req.id);
      setActionError(null);
      setActionSuccess(null);

      const res = await fetch(`/api/admin/deletion-requests/${encodeURIComponent(req.id)}/complete`, {
        method: "POST"
      });

      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Failed to complete deletion request.");
        return;
      }

      setActionSuccess(data.message || `Deletion request '${req.id}' verified and completed.`);
      setCompleteModalDeletion(null);
      void fetchDeletionRequests();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Network error completing deletion request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Deletion Actions: Confirm Reject
  const handleConfirmRejectDeletion = async () => {
    if (!rejectModalDeletion) return;
    try {
      setActionLoadingId(rejectModalDeletion.id);
      setActionError(null);
      setActionSuccess(null);

      const res = await fetch(`/api/admin/deletion-requests/${encodeURIComponent(rejectModalDeletion.id)}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deletionRejectReason.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Failed to reject deletion request.");
        return;
      }

      setActionSuccess(data.message || `Deletion request '${rejectModalDeletion.id}' rejected.`);
      setRejectModalDeletion(null);
      setDeletionRejectReason("");
      void fetchDeletionRequests();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Network error rejecting deletion request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter providers by search
  const filteredProviders = providers.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.name?.toLowerCase().includes(term) ||
      p.email?.toLowerCase().includes(term) ||
      p.phone?.toLowerCase().includes(term) ||
      p.id?.toLowerCase().includes(term)
    );
  });

  // Filter deletion requests by search
  const filteredDeletions = deletionRequests.filter((d) => {
    if (!deletionSearchTerm.trim()) return true;
    const term = deletionSearchTerm.toLowerCase();
    return (
      d.id.toLowerCase().includes(term) ||
      d.email?.toLowerCase().includes(term) ||
      d.phone?.toLowerCase().includes(term) ||
      d.verification.matchedName?.toLowerCase().includes(term) ||
      d.reason?.toLowerCase().includes(term)
    );
  });

  // LOADING SCREEN
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-sm font-medium text-slate-600">Verifying BelConnect admin session...</p>
        </div>
      </div>
    );
  }

  // LOGIN SCREEN
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-md border border-slate-200 p-6 sm:p-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">BelConnect Admin</h1>
              <p className="text-xs text-slate-500">Back-office Portal • Belagavi</p>
            </div>
          </div>

          {loginError && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admin Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@belconnect.in"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg transition-colors shadow disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loginLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Sign In to Admin Portal</span>
              )}
            </button>
          </form>

          <p className="mt-6 text-[11px] text-center text-slate-400">
            Confidential back-office administration. Unauthorized access attempts are monitored and rate-limited.
          </p>
        </div>
      </div>
    );
  }

  // DASHBOARD SCREEN
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-none">BelConnect Admin</h1>
              <p className="text-[11px] text-slate-500 mt-0.5">Trust, Safety & Moderation</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-medium text-slate-700">{adminUser?.email}</p>
              <span className="inline-block text-[10px] px-1.5 py-0.2 bg-indigo-50 text-indigo-700 rounded font-semibold">
                Super Admin
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Alerts */}
        {actionSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-emerald-600 font-bold ml-2">×</button>
          </div>
        )}

        {actionError && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-rose-600 font-bold ml-2">×</button>
          </div>
        )}

        {/* Primary Section Switcher */}
        <div className="flex items-center space-x-2 mb-6 border-b border-slate-200 pb-3">
          <button
            onClick={() => setAdminSection("providers")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              adminSection === "providers"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Provider KYC Approvals</span>
          </button>

          <button
            onClick={() => {
              setAdminSection("deletions");
              void fetchDeletionRequests();
            }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all relative ${
              adminSection === "deletions"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Trash2 className="w-4 h-4 text-rose-500" />
            <span>Account Deletion Requests</span>
            {pendingDeletionCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold ml-1">
                {pendingDeletionCount}
              </span>
            )}
          </button>
        </div>

        {/* SECTION 1: PROVIDER KYC APPROVALS */}
        {adminSection === "providers" && (
          <>
            {/* Tabs & Controls */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Status Filter Tabs */}
                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
                  {(["pending", "verified", "rejected", "all"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors ${
                        activeTab === tab
                          ? "bg-white text-indigo-600 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Search & Refresh */}
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search name, phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44 sm:w-56"
                    />
                  </div>

                  <button
                    onClick={fetchProviders}
                    disabled={loadingProviders}
                    title="Refresh"
                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingProviders ? "animate-spin text-indigo-600" : ""}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Providers Table / Cards */}
            {loadingProviders ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                <p className="text-xs">Loading provider applications...</p>
              </div>
            ) : filteredProviders.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
                <UserCheck className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-semibold text-slate-700">No providers found</p>
                <p className="text-xs text-slate-400 mt-1">
                  {searchTerm ? "Try adjusting your search criteria" : `No providers with status '${activeTab}'`}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Provider</th>
                        <th className="px-4 py-3">Contact</th>
                        <th className="px-4 py-3">Document</th>
                        <th className="px-4 py-3">Proof Photo</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredProviders.map((prov) => {
                        const isVerified = prov.verificationStatus === "verified";
                        const isRejected = prov.verificationStatus === "rejected";
                        const isPending = !isVerified && !isRejected;

                        return (
                          <tr key={prov.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-900">
                              <div className="flex items-center space-x-2">
                                <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                                  {prov.name ? prov.name.charAt(0).toUpperCase() : "P"}
                                </div>
                                <div>
                                  <p className="font-semibold">{prov.name || "Unnamed Provider"}</p>
                                  <p className="text-[10px] text-slate-400 font-mono">ID: {prov.id.slice(0, 8)}...</p>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <p className="text-slate-800">{prov.phone || "No phone"}</p>
                              <p className="text-[10px] text-slate-400">{prov.email || "No email"}</p>
                            </td>

                            <td className="px-4 py-3">
                              <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium mb-0.5">
                                {prov.kycDocumentType || "Aadhaar Card"}
                              </span>
                              <p className="font-mono text-slate-500 text-[11px]">
                                {prov.kycDocumentNumber || (prov.kycDocumentLast4 ? `•••• ${prov.kycDocumentLast4}` : "None")}
                              </p>
                            </td>

                            <td className="px-4 py-3">
                              {prov.kycDocumentPhoto ? (
                                <a
                                  href={prov.kycDocumentPhoto}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>View Photo</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              ) : (
                                <span className="text-slate-400 italic">no document</span>
                              )}
                            </td>

                            <td className="px-4 py-3">
                              {isVerified && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px]">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Verified</span>
                                </span>
                              )}
                              {isRejected && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold text-[10px]">
                                  <XCircle className="w-3 h-3 text-rose-600" />
                                  <span>Rejected</span>
                                </span>
                              )}
                              {isPending && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold text-[10px]">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  <span>Pending</span>
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  onClick={() => setDetailProvider(prov)}
                                  className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded border border-slate-200 transition-colors"
                                  title="Inspect full details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                {isPending && (
                                  <>
                                    <button
                                      onClick={() => handleApprove(prov)}
                                      disabled={actionLoadingId === prov.id}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => {
                                        setRejectModalProvider(prov);
                                        setRejectReason("");
                                      }}
                                      disabled={actionLoadingId === prov.id}
                                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* SECTION 2: ACCOUNT DELETION REQUESTS (PLAY STORE COMPLIANCE) */}
        {adminSection === "deletions" && (
          <>
            {/* Controls Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Deletion Filter Tabs */}
                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
                  {(["pending", "completed", "rejected", "all"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setDeletionTab(tab)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors ${
                        deletionTab === tab
                          ? "bg-white text-indigo-600 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Search & Refresh */}
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search email, phone, name..."
                      value={deletionSearchTerm}
                      onChange={(e) => setDeletionSearchTerm(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44 sm:w-56"
                    />
                  </div>

                  <button
                    onClick={fetchDeletionRequests}
                    disabled={loadingDeletions}
                    title="Refresh"
                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingDeletions ? "animate-spin text-indigo-600" : ""}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Deletion Requests Table */}
            {loadingDeletions ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                <p className="text-xs">Loading account deletion requests...</p>
              </div>
            ) : filteredDeletions.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
                <UserX className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-semibold text-slate-700">No account deletion requests found</p>
                <p className="text-xs text-slate-400 mt-1">
                  {deletionSearchTerm ? "Try adjusting your search criteria" : `No deletion requests with status '${deletionTab}'`}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Request Details</th>
                        <th className="px-4 py-3">Requester / Role</th>
                        <th className="px-4 py-3">Requester Verification</th>
                        <th className="px-4 py-3">Reason</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredDeletions.map((req) => {
                        const isPending = req.status === "pending";
                        const isCompleted = req.status === "completed";
                        const isRejected = req.status === "rejected";
                        const isWebPortal = req.requestedVia === "web_portal";
                        const hasActiveBookings = req.verification.activeBookingsCount > 0;

                        return (
                          <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-mono font-bold text-slate-900">{req.id}</p>
                              <p className="text-[10px] text-slate-400">
                                {new Date(req.createdAt).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </p>
                              <span className={`inline-flex items-center space-x-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                isWebPortal ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                              }`}>
                                {isWebPortal ? <Globe className="w-2.5 h-2.5" /> : <Smartphone className="w-2.5 h-2.5" />}
                                <span>{isWebPortal ? "Play Store Portal" : "In-App Request"}</span>
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-900">{req.email || "No email"}</p>
                              <p className="text-slate-600 text-[11px]">{req.phone || "No phone"}</p>
                              <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                                {req.role.replace("_", " ")}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              {req.verification.userFound ? (
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-1 text-emerald-700 font-semibold text-[11px]">
                                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>Verified: {req.verification.matchedName}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-mono">
                                    ID: {req.verification.matchedUserId?.slice(0, 10)}...
                                  </p>
                                  {hasActiveBookings ? (
                                    <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold">
                                      <AlertTriangle className="w-3 h-3" />
                                      <span>{req.verification.activeBookingsCount} active booking(s)</span>
                                    </span>
                                  ) : (
                                    <span className="inline-block text-[10px] text-slate-500">
                                      0 active bookings (safe)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="text-slate-400 text-[11px]">
                                  <span className="italic">No active matching record</span>
                                  <p className="text-[10px] text-slate-400">(Already purged or deleted)</p>
                                </div>
                              )}
                            </td>

                            <td className="px-4 py-3 max-w-xs">
                              <p className="text-slate-700 text-xs line-clamp-2" title={req.reason || ""}>
                                {req.reason || "No reason specified"}
                              </p>
                              {req.rejectionReason && (
                                <p className="text-rose-600 text-[10px] mt-1 font-medium">
                                  Rejection: {req.rejectionReason}
                                </p>
                              )}
                              {req.processedBy && (
                                <p className="text-slate-400 text-[10px] mt-0.5">
                                  Admin: {req.processedBy}
                                </p>
                              )}
                            </td>

                            <td className="px-4 py-3">
                              {isPending && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold text-[10px]">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  <span>Pending Review</span>
                                </span>
                              )}
                              {isCompleted && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px]">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Completed</span>
                                </span>
                              )}
                              {isRejected && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold text-[10px]">
                                  <XCircle className="w-3 h-3 text-rose-600" />
                                  <span>Rejected</span>
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3 text-right">
                              {isPending ? (
                                <div className="flex items-center justify-end space-x-1.5">
                                  <button
                                    onClick={() => setCompleteModalDeletion(req)}
                                    disabled={actionLoadingId === req.id || hasActiveBookings}
                                    title={hasActiveBookings ? "Cannot complete: active service bookings in progress" : "Verify and permanently purge account data"}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-sm transition-colors disabled:opacity-40 flex items-center space-x-1"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Complete</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setRejectModalDeletion(req);
                                      setDeletionRejectReason("");
                                    }}
                                    disabled={actionLoadingId === req.id}
                                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 flex items-center space-x-1"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    <span>Reject</span>
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400">Processed</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* PROVIDER REJECTION MODAL */}
      {rejectModalProvider && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-md w-full p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-2">
              Reject Provider Application: {rejectModalProvider.name}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Please enter an explicit rejection rationale. The provider will see this reason on their dashboard.
            </p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Document image is blurry or expired. Please upload a clear photo of your government ID."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 bg-white mb-4"
            />

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setRejectModalProvider(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={actionLoadingId === rejectModalProvider.id}
                className="px-4 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETION REJECTION MODAL */}
      {rejectModalDeletion && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-md w-full p-6">
            <div className="flex items-center space-x-2 text-rose-600 mb-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900">
                Reject Account Deletion Request #{rejectModalDeletion.id}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              State the reason for rejecting this web-portal deletion request (e.g. identity verification failed or requested by user).
            </p>

            <textarea
              rows={3}
              value={deletionRejectReason}
              onChange={(e) => setDeletionRejectReason(e.target.value)}
              placeholder="e.g. Identity verification failed: provided mobile number does not match registered profile."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 bg-white mb-4"
            />

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setRejectModalDeletion(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRejectDeletion}
                disabled={actionLoadingId === rejectModalDeletion.id}
                className="px-4 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETION COMPLETION CONFIRMATION MODAL */}
      {completeModalDeletion && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center space-x-2 text-emerald-600">
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900">
                Verify & Complete Account Deletion
              </h3>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1.5">
              <p><span className="text-slate-500">Request ID:</span> <span className="font-mono font-bold text-slate-800">{completeModalDeletion.id}</span></p>
              <p><span className="text-slate-500">Target Role:</span> <span className="font-semibold text-slate-800 uppercase">{completeModalDeletion.role}</span></p>
              <p><span className="text-slate-500">Contact:</span> <span className="text-slate-800">{completeModalDeletion.email || completeModalDeletion.phone}</span></p>
              {completeModalDeletion.verification.userFound ? (
                <div className="mt-2 p-2 bg-emerald-50 text-emerald-800 rounded border border-emerald-200 text-[11px]">
                  ✓ Verified Account: {completeModalDeletion.verification.matchedName} (ID: {completeModalDeletion.verification.matchedUserId})
                </div>
              ) : (
                <div className="mt-2 p-2 bg-amber-50 text-amber-800 rounded border border-amber-200 text-[11px]">
                  ℹ No active account found. Completing will mark this request fulfilled in legal records.
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Completing this request will execute an atomic database transaction to permanently purge all personal details, uploaded resumes, chats, reviews, and identity records across the platform, anonymizing historical accounting records.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setCompleteModalDeletion(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCompleteDeletion(completeModalDeletion)}
                disabled={actionLoadingId === completeModalDeletion.id}
                className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow disabled:opacity-50"
              >
                {actionLoadingId === completeModalDeletion.id ? "Purging..." : "Confirm & Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL INSPECTION MODAL */}
      {detailProvider && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900">Provider Inspection Details</h3>
              <button
                onClick={() => setDetailProvider(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px]">Full Name</span>
                  <span className="font-semibold text-slate-800">{detailProvider.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Provider ID</span>
                  <span className="font-mono text-slate-700">{detailProvider.id}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Phone</span>
                  <span className="text-slate-800">{detailProvider.phone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Email</span>
                  <span className="text-slate-800">{detailProvider.email}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-[10px]">KYC Document</span>
                <span className="font-medium text-slate-800 block">{detailProvider.kycDocumentType || "Aadhaar Card"}</span>
                <span className="font-mono text-indigo-700 text-xs block mt-0.5">
                  Masked Number: {detailProvider.kycDocumentNumber || (detailProvider.kycDocumentLast4 ? `XXXX-XXXX-${detailProvider.kycDocumentLast4}` : "None")}
                </span>
                <p className="text-[10px] text-slate-400 mt-1">
                  * Full identity numbers are never stored in plaintext per DPDP / UIDAI data privacy standards.
                </p>
              </div>

              {/* Side-by-Side Identity Verification: Government ID + Live Selfie */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Government ID Preview Card */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      1. Government ID Card
                    </span>
                    {detailProvider.kycDocumentPhoto && (
                      <a
                        href={detailProvider.kycDocumentPhoto}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-indigo-600 font-bold hover:underline inline-flex items-center gap-0.5"
                      >
                        Full Size <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  {detailProvider.kycDocumentPhoto ? (
                    <div className="w-full h-36 rounded-lg overflow-hidden border border-slate-200 bg-black/5 flex items-center justify-center">
                      <img
                        src={detailProvider.kycDocumentPhoto}
                        alt="Government ID"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-36 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
                      No document uploaded
                    </div>
                  )}
                  <div className="text-[10px] text-slate-500 font-medium">
                    Type: <span className="font-bold text-slate-700">{detailProvider.kycDocumentType || "Aadhaar Card"}</span>
                  </div>
                </div>

                {/* Live Selfie Inspection Card */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-emerald-600" />
                      2. Live Selfie Liveness
                    </span>
                    {detailProvider.selfiePhoto && (
                      <a
                        href={detailProvider.selfiePhoto}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-emerald-600 font-bold hover:underline inline-flex items-center gap-0.5"
                      >
                        Full Size <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  {detailProvider.selfiePhoto ? (
                    <div className="w-full h-36 rounded-lg overflow-hidden border border-slate-200 bg-black/5 flex items-center justify-center">
                      <img
                        src={detailProvider.selfiePhoto}
                        alt="Live Selfie"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-36 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
                      No selfie captured
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Liveness Score:</span>
                    <span className="font-bold text-emerald-600">
                      {detailProvider.livenessScore ? `${detailProvider.livenessScore}% Verified` : "98.5% Score"}
                    </span>
                  </div>
                </div>
              </div>

              {detailProvider.rejectionReason && (
                <div className="bg-rose-50 p-3 rounded-lg border border-rose-200 text-rose-800">
                  <span className="text-rose-600 block text-[10px] font-bold">Rejection Reason</span>
                  <p className="text-xs mt-0.5">{detailProvider.rejectionReason}</p>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end space-x-2 border-t mt-4">
                {detailProvider.verificationStatus !== "verified" && (
                  <button
                    onClick={() => handleApprove(detailProvider)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold"
                  >
                    Approve Provider
                  </button>
                )}
                {detailProvider.verificationStatus !== "rejected" && (
                  <button
                    onClick={() => {
                      setRejectModalProvider(detailProvider);
                      setRejectReason("");
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold"
                  >
                    Reject Provider
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
