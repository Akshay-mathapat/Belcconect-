"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Building2 } from "lucide-react";
import Link from "next/link";
import { SITE_NAME } from "@/constants/site";
import { useTranslation } from "@/lib/i18n";
import { LeftBrandPanel } from "./LeftBrandPanel";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";
import { ForgotPasswordModal } from "./ForgotPasswordModal";

interface AuthLayoutProps {
  initialMode?: "login" | "signup" | "forgot";
}

export function AuthLayout({ initialMode = "login" }: AuthLayoutProps) {
  const { t } = useTranslation();
  const [authMode, setAuthMode] = useState<"login" | "signup" | "forgot">(initialMode);

  useEffect(() => {
    // Save original styles
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlHeight = document.documentElement.style.height;
    const originalBodyHeight = document.body.style.height;

    // Force hidden overflow to prevent window scrolling
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.documentElement.style.height = "100%";
    document.body.style.height = "100%";

    return () => {
      // Revert original styles on unmount
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.height = originalHtmlHeight;
      document.body.style.height = originalBodyHeight;
    };
  }, []);

  return (
    <div className="h-[calc(100vh-4rem)] lg:-mt-12 w-full bg-background text-foreground flex overflow-hidden">
      {/* ════════════════ LEFT BRAND PANEL (STATIC) ════════════════ */}
      <LeftBrandPanel />

      {/* ════════════════ RIGHT AUTH PANEL (DYNAMIC) ════════════════ */}
      <main
        onScroll={(e) => {
          const scrollTop = e.currentTarget.scrollTop;
          window.dispatchEvent(new CustomEvent("auth-scroll", { detail: { scrollTop } }));
        }}
        className="w-full md:w-[55%] lg:w-[60%] h-full overflow-y-auto flex flex-col justify-between p-6 sm:p-10 lg:p-14 xl:p-16 lg:pt-14 relative"
      >
        <div className="w-full max-w-md mx-auto my-auto py-4">
          {/* Mobile Only Header Logo */}
          <div className="flex md:hidden items-center justify-end gap-3 mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t("auth.backToHome")}
            </Link>
          </div>

          {/* Desktop Back to Home Link */}
          <Link
            href="/"
            className="hidden md:inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 font-medium group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            {t("auth.backToHome")}
          </Link>

          {/* Smooth Framer Motion Transition Container */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={authMode}
              initial={{ opacity: 0, x: 25 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -25 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="w-full"
            >
              {authMode === "login" ? (
                <LoginForm
                  onSwitchToSignup={() => setAuthMode("signup")}
                  onForgotPassword={() => setAuthMode("forgot")}
                />
              ) : authMode === "signup" ? (
                <SignupForm onSwitchToLogin={() => setAuthMode("login")} />
              ) : (
                <ForgotPasswordModal onBackToLogin={() => setAuthMode("login")} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}