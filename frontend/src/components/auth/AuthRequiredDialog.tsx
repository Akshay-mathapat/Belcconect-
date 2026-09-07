"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, UserPlus, X, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { getSafeReturnUrl } from "@/lib/urlUtils";

export interface AuthRequiredDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  returnTo?: string;
}

export function AuthRequiredDialog({
  isOpen,
  onClose,
  title,
  description,
  returnTo = "/"
}: AuthRequiredDialogProps) {
  const { t } = useTranslation();
  const router = useRouter();

  if (!isOpen) return null;

  const safeReturn = getSafeReturnUrl(returnTo);
  const displayTitle = title || t("auth.loginRequiredTitle");
  const displayDesc = description || t("auth.loginRequiredDesc");

  const handleLogin = () => {
    onClose();
    router.push(`/auth?mode=login&returnTo=${encodeURIComponent(safeReturn)}`);
  };

  const handleSignup = () => {
    onClose();
    router.push(`/auth?mode=signup&returnTo=${encodeURIComponent(safeReturn)}`);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-md bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-2xl overflow-hidden text-foreground"
        >
          {/* Top Decorative Gradient Accent */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600" />

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/50 transition-colors"
            aria-label={t("auth.cancel")}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-heading font-extrabold text-foreground tracking-tight">
                {displayTitle}
              </h3>
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                BelConnect Account Required
              </span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            {displayDesc}
          </p>

          {/* Actions */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleLogin}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <LogIn className="w-4 h-4" />
              <span>{t("auth.login")}</span>
            </button>

            <button
              type="button"
              onClick={handleSignup}
              className="w-full py-3.5 px-4 bg-muted/60 hover:bg-muted text-foreground font-bold rounded-2xl border border-border transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <UserPlus className="w-4 h-4 text-muted-foreground" />
              <span>{t("auth.createAccount")}</span>
            </button>
          </div>

          {/* Footer note */}
          <div className="mt-5 text-center text-xs text-muted-foreground">
            {t("auth.securityNote")}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
