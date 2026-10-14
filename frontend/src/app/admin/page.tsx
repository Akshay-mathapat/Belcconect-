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
  Eye
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
  kycStatus: string;
  isVerified: boolean;
  verificationStatus: "pending" | "verified" | "rejected" | "unverified";
  rejectionReason: string | null;
  createdAt: string;
  verifiedAt: string | null;
  verifiedBy: string | null;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [adminUser, setAdminUser] = useState<{ id: string; email: string } | null>(null);

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

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Rejection modal
  const [rejectModalProvider, setRejectModalProvider] = useState<ProviderItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Provider Detail modal
  const [detailProvider, setDetailProvider] = useState<ProviderItem | null>(null);

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

  useEffect(() => {
    if (!isAuthenticated) return;
    let ignore = false;
    const load = async () => {
      try {
        const statusParam = activeTab === "all" ? "" : `?status=${activeTab}`;
        const res = await fetch(`/api/admin/providers${statusParam}`);
        if (!ignore && res.ok) {
          const data = await res.json();
          setProviders(data.providers || []);
        } else if (!ignore) {
          const err = await res.json().catch(() => ({}));
          setActionError(err.error || "Failed to load providers");
        }
      } catch (e: unknown) {
        if (!ignore) {
          setActionError(e instanceof Error ? e.message : "Network error loading providers");
        }
      }
    };
    void load();
    return () => {
      ignore = true;
    };
  }, [isAuthenticated, activeTab]);

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
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Failed to connect to authentication server.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Admin Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    setAdminUser(null);
    setProviders([]);
  };

  // Handle Approve Provider
  const handleApprove = async (provider: ProviderItem) => {
    if (!confirm(`Are you sure you want to approve and verify '${provider.name}'?`)) return;

    setActionLoadingId(provider.id);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/admin/providers/${provider.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error || "Failed to approve provider");
        return;
      }

      setActionSuccess(`Provider '${provider.name}' approved successfully.`);
      fetchProviders();
      if (detailProvider?.id === provider.id) {
        setDetailProvider(null);
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Network error during approval");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Reject Provider
  const handleConfirmReject = async () => {
    if (!rejectModalProvider) return;
    if (!rejectReason.trim()) {
      alert("Please enter a rejection reason for the provider.");
      return;
    }

    setActionLoadingId(rejectModalProvider.id);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/admin/providers/${rejectModalProvider.id}/reject`, {
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
      fetchProviders();
      if (detailProvider?.id === rejectModalProvider.id) {
        setDetailProvider(null);
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Network error during rejection");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered providers
  const filteredProviders = providers.filter((p) => {
    const q = searchTerm.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.phone?.toLowerCase().includes(q) ||
      p.id?.toLowerCase().includes(q)
    );
  });

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">
        <div className="flex items-center space-x-3 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
          <span>Verifying administrator credentials...</span>
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
              <p className="text-[11px] text-slate-500 mt-0.5">Provider Verification & Safety</p>
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
              There are no providers matching the &quot;{activeTab}&quot; filter status.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">KYC Document</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Document Photo</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProviders.map((provider) => (
                    <tr key={provider.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{provider.name || "Unnamed"}</div>
                        <div className="text-[10px] text-slate-400 font-mono">ID: {provider.id}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-700">{provider.phone || "—"}</div>
                        <div className="text-[11px] text-slate-500">{provider.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">
                          {provider.kycDocumentType || "Aadhaar Card"}
                        </div>
                        <div className="font-mono text-slate-500 text-[11px]">
                          {provider.kycDocumentNumber || (provider.kycDocumentLast4 ? `XXXX-XXXX-${provider.kycDocumentLast4}` : "Not submitted")}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            provider.verificationStatus === "verified"
                              ? "bg-emerald-100 text-emerald-800"
                              : provider.verificationStatus === "rejected"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {provider.verificationStatus.toUpperCase()}
                        </span>
                        {provider.rejectionReason && (
                          <div className="text-[10px] text-rose-600 mt-1 max-w-xs truncate" title={provider.rejectionReason}>
                            Reason: {provider.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {provider.kycDocumentPhoto ? (
                          <a
                            href={provider.kycDocumentPhoto}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-indigo-600 rounded text-[11px] font-medium transition-colors"
                          >
                            <FileText className="w-3 h-3" />
                            <span>View Photo</span>
                            <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                          </a>
                        ) : (
                          <span className="text-slate-400 text-[11px]">No upload</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => setDetailProvider(provider)}
                            title="Inspect Details"
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded border border-slate-200"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {provider.verificationStatus !== "verified" && (
                            <button
                              onClick={() => handleApprove(provider)}
                              disabled={actionLoadingId === provider.id}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-[11px] transition-colors disabled:opacity-50"
                            >
                              Approve
                            </button>
                          )}

                          {provider.verificationStatus !== "rejected" && (
                            <button
                              onClick={() => {
                                setRejectModalProvider(provider);
                                setRejectReason("");
                              }}
                              disabled={actionLoadingId === provider.id}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium text-[11px] transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* REJECT MODAL */}
      {rejectModalProvider && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-md w-full p-5">
            <div className="flex items-center space-x-2 mb-3 text-rose-600 font-bold text-sm">
              <XCircle className="w-5 h-5 shrink-0" />
              <span>Reject Provider Verification</span>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Rejecting <strong>{rejectModalProvider.name}</strong> ({rejectModalProvider.phone}). Please provide a clear reason that will be delivered to the provider.
            </p>

            <textarea
              rows={3}
              required
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

              {detailProvider.kycDocumentPhoto && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[10px] mb-1.5">KYC Document Upload</span>
                  <a
                    href={detailProvider.kycDocumentPhoto}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Open Uploaded Document Photo</span>
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </div>
              )}

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

