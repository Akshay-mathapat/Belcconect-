"use client";

import { useState } from "react";
import { ArrowRight, Check, Eye, EyeOff, Lock, Mail, User, Wrench, Briefcase } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GoogleButton } from "./GoogleButton";
import { AuthHeader } from "./AuthHeader";
import { useAuthStore, UserRole } from "@/store/useAuthStore";
import { useTranslation } from "@/lib/i18n";
import { registerAndSubscribeUser } from "@/lib/registerSW";
import { getSafeReturnUrl } from "@/lib/urlUtils";
import { OAuthAccountType } from "@/lib/oauthAccountType";

interface LoginFormProps {
  onSwitchToSignup: () => void;
  onForgotPassword?: () => void;
  accountType: OAuthAccountType;
}

export function LoginForm({ onSwitchToSignup, onForgotPassword, accountType: initialAccountType }: LoginFormProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawReturnTo = searchParams?.get("returnTo");
  const safeReturnTo = getSafeReturnUrl(rawReturnTo);

  const [selectedAccountType, setSelectedAccountType] = useState<OAuthAccountType>(
    initialAccountType || "customer"
  );
  const { loginUser, currentUser } = useAuthStore();
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setIsLoading(true);
    
    try {
      const res = await loginUser({ email: emailOrPhone, password });
      setIsLoading(false);

      if (!res.success) {
        setErrorMessage(res.error || "Login failed. Please check your credentials.");
        return;
      }

      // Register Service Worker & Subscribe to Web Push Notifications upon login
      if (res.user?.id) {
        registerAndSubscribeUser(res.user.id).catch(() => {});
      }

      setIsSubmitted(true);
      
      const userRole = res.user?.role || "user";
      // Auto-redirect based on detected role after 800ms
      setTimeout(() => {
        if (userRole === "provider") {
          router.push("/provider");
        } else if (userRole === "job_provider") {
          router.push("/jobprovider");
        } else {
          router.push(safeReturnTo);
        }
      }, 800);
    } catch (err) {
      setIsLoading(false);
      setErrorMessage("An unexpected error occurred during login.");
    }
  };

  const getRedirectPath = () => {
    if (currentUser?.role === "provider") return "/provider";
    if (currentUser?.role === "job_provider") return "/jobprovider";
    return safeReturnTo;
  };

  if (isSubmitted) {
    const targetUrl = getRedirectPath();

    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 text-center space-y-4">
        <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
          <Check className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-200">
          {currentUser?.role === "provider" 
            ? "Logged In as Service Provider!" 
            : currentUser?.role === "job_provider" 
            ? "Logged In as Job Provider!" 
            : "Logged In Successfully!"}
        </h3>
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          {currentUser?.role === "provider" 
            ? "Welcome back! Redirecting to your Provider Dashboard..."
            : currentUser?.role === "job_provider"
            ? "Welcome back! Redirecting to your Job Provider Workspace..."
            : "Welcome back! Redirecting to the BelConnect Marketplace..."}
        </p>
        <Link
          href={targetUrl}
          className="inline-flex items-center justify-center w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md"
        >
          {currentUser?.role === "provider" 
            ? "Go to Provider Dashboard" 
            : currentUser?.role === "job_provider" 
            ? "Go to Job Provider Portal" 
            : "Go to Home"}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <AuthHeader
        title={t("auth.welcomeBack")}
        subtitle={t("auth.welcomeBackDesc")}
      />

      {/* 3 Role Switcher Buttons on Top */}
      <div className="mb-6 p-1 bg-muted/70 dark:bg-zinc-800/70 rounded-xl grid grid-cols-3 gap-1 border border-border/50">
        <button
          type="button"
          onClick={() => setSelectedAccountType("customer")}
          className={`py-2 px-1 sm:px-2 text-[10px] sm:text-xs md:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
            selectedAccountType === "customer"
              ? "bg-background text-blue-600 dark:text-blue-400 shadow-sm border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          }`}
          suppressHydrationWarning
        >
          <User className="w-3.5 h-3.5" />
          {t("auth.createGroupUser")}
        </button>

        <button
          type="button"
          onClick={() => setSelectedAccountType("service_provider")}
          className={`py-2 px-1 sm:px-2 text-[10px] sm:text-xs md:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
            selectedAccountType === "service_provider"
              ? "bg-background text-blue-600 dark:text-blue-400 shadow-sm border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          }`}
          suppressHydrationWarning
        >
          <Wrench className="w-3.5 h-3.5" />
          {t("auth.createGroupProvider")}
        </button>

        <button
          type="button"
          onClick={() => setSelectedAccountType("job_provider")}
          className={`py-2 px-1 sm:px-2 text-[10px] sm:text-xs md:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
            selectedAccountType === "job_provider"
              ? "bg-background text-blue-600 dark:text-blue-400 shadow-sm border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          }`}
          suppressHydrationWarning
        >
          <Briefcase className="w-3.5 h-3.5" />
          {t("auth.createGroupEmployer")}
        </button>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold">
          ⚠️ {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" suppressHydrationWarning>
        {/* Email or Phone Input */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t("auth.emailOrPhone")}
          </label>
          <div className="relative">
            <Mail className="w-5 h-5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              required
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              placeholder={t("auth.emailPlaceholder")}
              className="w-full pl-11 pr-4 py-3 bg-muted/30 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-all text-sm outline-none placeholder:text-muted-foreground/60 text-foreground"
              suppressHydrationWarning
            />
          </div>
        </div>

        {/* Password Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-foreground">
              {t("auth.password")}
            </label>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (onForgotPassword) {
                  onForgotPassword();
                }
              }}
              className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
            >
              {t("auth.forgotPassword")}
            </button>
          </div>
          <div className="relative">
            <Lock className="w-5 h-5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-11 pr-11 py-3 bg-muted/30 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-all text-sm outline-none placeholder:text-muted-foreground/60 text-foreground"
              suppressHydrationWarning
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
              suppressHydrationWarning
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Remember Me Checkbox */}
        <div className="flex items-center justify-between pt-0.5">
          <label htmlFor="remember" className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              id="remember"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-600 accent-blue-600 cursor-pointer"
              suppressHydrationWarning
            />
            <span>{t("auth.rememberMe")}</span>
          </label>
        </div>

        {/* Sign In CTA Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/25 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          suppressHydrationWarning
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            t("auth.signInButton")
          )}
        </button>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-0.5">
          <span>🔒</span>
          <span>{t("auth.securityNote")}</span>
        </div>

        {/* Or continue with Divider */}
        <div className="relative py-1.5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-3 text-muted-foreground font-medium">
              {t("auth.orContinueWith")}
            </span>
          </div>
        </div>

        {/* Google SSO Button */}
        <GoogleButton accountType={selectedAccountType} />
      </form>

      {/* Switch to Signup Link */}
      <div className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <button
          type="button"
          onClick={onSwitchToSignup}
          className="text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer transition-colors"
          suppressHydrationWarning
        >
          {t("auth.createAccountLink")}
        </button>
      </div>
    </div>
  );
}
