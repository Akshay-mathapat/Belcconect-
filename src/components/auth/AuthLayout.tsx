"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Building2 } from "lucide-react";
import Link from "next/link";
import { SITE_NAME } from "@/constants/site";
import { LeftBrandPanel } from "./LeftBrandPanel";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";

interface AuthLayoutProps {
  initialMode?: "login" | "signup";
}

export function AuthLayout({ initialMode = "login" }: AuthLayoutProps) {
  const [authMode, setAuthMode] = useState<"login" | "signup">(initialMode);

  return (
    <div className="min-h-[calc(100vh-4rem)] lg:min-h-[calc(100vh-7rem)] w-full bg-background text-foreground flex overflow-hidden">
      {/* ════════════════ LEFT BRAND PANEL (STATIC) ════════════════ */}
      <LeftBrandPanel />

      {/* ════════════════ RIGHT AUTH PANEL (DYNAMIC) ════════════════ */}
      <main className="w-full md:w-[55%] lg:w-[60%] min-h-[calc(100vh-4rem)] lg:min-h-[calc(100vh-7rem)] overflow-y-auto flex flex-col justify-between p-6 sm:p-10 lg:p-14 xl:p-16 relative">
        <div className="w-full max-w-md mx-auto my-auto py-4">
          {/* Mobile Only Header Logo */}
          <div className="flex md:hidden items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold font-heading text-foreground">
                {SITE_NAME || "BelConnect"}
              </span>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Home
            </Link>
          </div>

          {/* Desktop Back to Home Link */}
          <Link
            href="/"
            className="hidden md:inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 font-medium group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Back to Home
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
                <LoginForm onSwitchToSignup={() => setAuthMode("signup")} />
              ) : (
                <SignupForm onSwitchToLogin={() => setAuthMode("login")} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
