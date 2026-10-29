"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Laptop, Trash2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useTranslation } from "@/lib/i18n";
import { getAuthToken } from "@/lib/clientAuth";
import { useAuthStore, getStoredAuthToken } from "@/store/useAuthStore";
import { panelVariants } from "../uiTokens";

export function SettingsPanel() {
  const router = useRouter();
  const { currentUser } = useAuthStore();
  const { theme, setTheme, mounted } = useTheme();
  const { t } = useTranslation();
  const inputCls = "block w-full px-3 py-3 border border-border rounded-xl bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm text-foreground placeholder-muted-foreground";
  const labelCls = "block text-sm font-medium text-foreground mb-2";

  // Account Deletion State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteOtp, setDeleteOtp] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpSentMessage, setOtpSentMessage] = useState<string | null>(null);
  const [isGoogleAccount, setIsGoogleAccount] = useState(false);

  useEffect(() => {
    if (currentUser?.google_id || (currentUser as any)?.googleId) {
      setIsGoogleAccount(true);
    }
  }, [currentUser]);

  const handleSendOtp = async () => {
    try {
      setIsSendingOtp(true);
      setDeleteError(null);
      const token = getStoredAuthToken();
      const res = await fetch("/api/account/delete", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ action: "send_otp" })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send verification code");
      }
      setOtpSentMessage(data.message || `Verification code sent to ${currentUser?.email || "your email"}`);
      setIsGoogleAccount(true);
    } catch (err: any) {
      setDeleteError(err.message || "Failed to send verification code. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeletingAccount(true);
      setDeleteError(null);
      const token = getAuthToken();
      const res = await fetch("/api/account/delete", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          password: deletePassword,
          otp: deleteOtp,
          reason: "Job provider requested in-app account deletion"
        })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.requiresOtp || data.error?.includes("verification code") || data.error?.includes("Google-authenticated")) {
          setIsGoogleAccount(true);
        }
        throw new Error(data.error || "Failed to delete account");
      }
      try {
        localStorage.removeItem("auth-storage");
        localStorage.removeItem("belconnect_auth_token");
        sessionStorage.clear();
      } catch (_) {}
      router.push("/?deleted=true");
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete account. Please try again.");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const themeOptions = [
    { id: "light" as const, label: t("jobprovider.lightMode"), subtitle: t("jobprovider.highContrast"), icon: Sun, color: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
    { id: "dark" as const, label: t("jobprovider.darkMode"), subtitle: t("jobprovider.sleekLowLight"), icon: Moon, color: "text-blue-500 bg-blue-500/10 border-blue-500/30" },
    { id: "system" as const, label: t("jobprovider.systemMode"), subtitle: t("jobprovider.syncsOS"), icon: Laptop, color: "text-purple-500 bg-purple-500/10 border-purple-500/30" }
  ];

  const currentTheme = mounted ? theme : "system";

  return (
    <motion.div {...panelVariants} className="space-y-4">
      <div>
        <h3 className="font-semibold text-xl text-foreground">{t("jobprovider.accountSettings")}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t("jobprovider.manageAccount")}</p>
      </div>

      {[
        {
          title: t("jobprovider.themeSelection"),
          content: (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = currentTheme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTheme(opt.id)}
                    className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20"
                        : "border-border bg-muted/20 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`p-2 rounded-xl border ${opt.color}`}>
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                          ✓
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-bold text-foreground text-sm">{opt.label}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ),
        },
        {
          title: t("jobprovider.notifications"),
          content: (
            <div className="space-y-3">
              {["New application received", "Applicant sends a message", "Job listing expiring soon", "Promotional emails"].map(item => (
                <label key={item} className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-foreground">{item}</span>
                  <div className="relative">
                    <input type="checkbox" className="sr-only peer" defaultChecked={!item.includes("Promotional")} />
                    <div className="w-10 h-5 bg-muted peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:bg-primary transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                  </div>
                </label>
              ))}
            </div>
          ),
        },
        {
          title: t("jobprovider.changePassword"),
          content: (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Current Password</label>
                <input type="password" className={inputCls} placeholder="••••••••" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>New Password</label>
                  <input type="password" className={inputCls} placeholder="••••••••" />
                </div>
                <div>
                  <label className={labelCls}>Confirm New Password</label>
                  <input type="password" className={inputCls} placeholder="••••••••" />
                </div>
              </div>
              <button className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                {t("jobprovider.updatePassword")}
              </button>
            </div>
          ),
        },
        {
          title: t("jobprovider.dangerZone"),
          content: (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-border/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("jobprovider.deactivateAccount")}</p>
                  <p className="text-xs text-muted-foreground">Temporarily hide your profile and listings</p>
                </div>
                <button className="px-4 py-2 text-sm font-semibold rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground transition-colors">
                  {t("jobprovider.deactivate")}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Employer Account</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Permanently remove business profile, job listings, and company data</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="px-4 py-2 text-sm font-bold rounded-xl border border-red-500 bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer shadow-sm"
                >
                  Delete Account
                </button>
              </div>
            </div>
          ),
        },
      ].map(section => (
        <div key={section.title} className="rounded-2xl border border-border bg-card shadow-sm p-6">
          <h4 className="font-semibold text-foreground mb-5 pb-4 border-b border-border">{section.title}</h4>
          {section.content}
        </div>
      ))}

      {/* Delete Account Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-red-500/30 bg-card p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Delete Employer Account?</h3>
                  <p className="text-xs text-muted-foreground">Permanent and irreversible</p>
                </div>
              </div>

              {deleteError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-2 leading-relaxed">
                <p>
                  This will permanently delete your employer profile, company details, active and closed job postings, and applicant tracking records.
                </p>
              </div>

              {/* Google Account OTP flow */}
              {(isGoogleAccount || (deleteError && (deleteError.includes("verification code") || deleteError.includes("Google-authenticated")))) ? (
                <div className="space-y-3 p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs">
                  <div>
                    <p className="font-bold text-foreground">Google Account Verification Code</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      A 6-digit verification code sent to <span className="font-semibold text-foreground">{currentUser?.email}</span> is required to confirm deletion.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSendingOtp}
                      onClick={handleSendOtp}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSendingOtp ? "Sending Code..." : (otpSentMessage ? "Resend Code" : "Send Verification Code")}
                    </button>
                    {otpSentMessage && (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Code sent! Check inbox
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="text-[11px] font-bold text-foreground">
                      Enter 6-Digit Verification Code (OTP):
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="e.g. 123456"
                      value={deleteOtp}
                      onChange={(e) => setDeleteOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="w-full px-3.5 py-2 text-sm font-mono tracking-widest rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>

                  <div className="space-y-1.5 pt-1 border-t border-blue-500/10">
                    <label className="text-[10px] font-medium text-muted-foreground">
                      Enter password to confirm deletion:
                    </label>
                    <input
                      type="password"
                      placeholder="Optional for Google accounts"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-border bg-background/50 focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Enter password to confirm deletion:
                  </label>
                  <input
                    type="password"
                    placeholder="Enter current password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-red-500/30"
                  />
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setIsGoogleAccount(true)}
                      className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                    >
                      Signed in with Google? Use email verification code
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
                <button
                  type="button"
                  disabled={isDeletingAccount}
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingAccount}
                  onClick={handleDeleteAccount}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all cursor-pointer shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isDeletingAccount ? "Deleting..." : "Yes, Delete Employer Account"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
