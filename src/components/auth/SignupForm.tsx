"use client";

import { useState } from "react";
import { ArrowRight, Briefcase, Building2, Check, Eye, EyeOff, Lock, Mail, Phone, User, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoogleButton } from "./GoogleButton";
import { AuthHeader } from "./AuthHeader";
import { PasswordStrength } from "./PasswordStrength";
import { useAuthStore, UserRole } from "@/store/useAuthStore";

interface SignupFormProps {
  onSwitchToLogin: () => void;
}

export function SignupForm({ onSwitchToLogin }: SignupFormProps) {
  const router = useRouter();
  const { registerUser } = useAuthStore();
  const [signupRole, setSignupRole] = useState<UserRole>("user");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!agreedToTerms) return;
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      const res = registerUser({
        email,
        name: fullName,
        phone,
        role: signupRole
      });

      if (!res.success) {
        setErrorMessage(res.error || "Registration failed.");
        return;
      }

      setIsSubmitted(true);

      // Auto-redirect based on selected role after 800ms
      setTimeout(() => {
        if (signupRole === "provider") {
          router.push("/provider");
        } else if (signupRole === "job_provider") {
          router.push("/jobprovider");
        } else {
          router.push("/");
        }
      }, 800);
    }, 600);
  };

  const getRoleTitle = () => {
    switch (signupRole) {
      case "provider":
        return "Service Provider Account Created!";
      case "job_provider":
        return "Job Provider Account Created!";
      default:
        return "User Account Created!";
    }
  };

  const getRoleDescription = () => {
    switch (signupRole) {
      case "provider":
        return "Welcome! Your Service Provider account is ready. Redirecting to your Provider Dashboard...";
      case "job_provider":
        return "Welcome! Your Job Provider account is ready. Redirecting to your Job Provider Workspace...";
      default:
        return "Welcome! Your User account is ready. Redirecting to the BelConnect Marketplace...";
    }
  };

  const getTargetUrl = () => {
    if (signupRole === "provider") return "/provider";
    if (signupRole === "job_provider") return "/jobprovider";
    return "/";
  };

  if (isSubmitted) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 text-center space-y-4">
        <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
          <Check className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-200">
          {getRoleTitle()}
        </h3>
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          {getRoleDescription()}
        </p>
        <Link
          href={getTargetUrl()}
          className="inline-flex items-center justify-center w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md cursor-pointer"
        >
          {signupRole === "provider" 
            ? "Proceed to Provider Dashboard" 
            : signupRole === "job_provider"
            ? "Proceed to Job Provider Portal"
            : "Proceed to Marketplace"}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <AuthHeader
        title="Create Account"
        subtitle="Join thousands of users simplifying city life with one unified platform."
      />

      {/* 3 Role Switcher Buttons on Top */}
      <div className="mb-6 p-1 bg-muted/70 dark:bg-zinc-800/70 rounded-xl grid grid-cols-3 gap-1 border border-border/50">
        <button
          type="button"
          onClick={() => setSignupRole("user")}
          className={`py-2 px-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            signupRole === "user"
              ? "bg-background text-blue-600 dark:text-blue-400 shadow-sm border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="w-3.5 h-3.5" />
          User
        </button>

        <button
          type="button"
          onClick={() => setSignupRole("provider")}
          className={`py-2 px-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            signupRole === "provider"
              ? "bg-background text-blue-600 dark:text-blue-400 shadow-sm border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          Provider
        </button>

        <button
          type="button"
          onClick={() => setSignupRole("job_provider")}
          className={`py-2 px-2 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            signupRole === "job_provider"
              ? "bg-background text-blue-600 dark:text-blue-400 shadow-sm border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          Job Provider
        </button>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name / Company Name Input */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {signupRole === "job_provider"
              ? "Full Name / Company Name"
              : signupRole === "provider"
              ? "Full Name / Business Name"
              : "Full Name"}
          </label>
          <div className="relative">
            {signupRole === "job_provider" ? (
              <Building2 className="w-5 h-5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            ) : signupRole === "provider" ? (
              <Wrench className="w-5 h-5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            ) : (
              <User className="w-5 h-5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            )}
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={
                signupRole === "job_provider"
                  ? "Jane Doe (Acme Corp)"
                  : signupRole === "provider"
                  ? "Jane Doe (Certified Technician)"
                  : "Jane Doe"
              }
              className="w-full pl-11 pr-4 py-3 bg-muted/30 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-all text-sm outline-none placeholder:text-muted-foreground/60 text-foreground"
            />
          </div>
        </div>

        {/* Phone Number */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Phone Number
          </label>
          <div className="relative">
            <Phone className="w-5 h-5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full pl-11 pr-4 py-3 bg-muted/30 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-all text-sm outline-none placeholder:text-muted-foreground/60 text-foreground"
            />
          </div>
        </div>

        {/* Email Address */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-5 h-5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className="w-full pl-11 pr-4 py-3 bg-muted/30 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-all text-sm outline-none placeholder:text-muted-foreground/60 text-foreground"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="w-5 h-5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-11 pr-11 py-3 bg-muted/30 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-all text-sm outline-none placeholder:text-muted-foreground/60 text-foreground"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Password Strength Meter */}
          <PasswordStrength password={password} />
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="w-5 h-5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type={showConfirmPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full pl-11 pr-11 py-3 bg-muted/30 border rounded-xl focus:bg-background focus:ring-2 transition-all text-sm outline-none placeholder:text-muted-foreground/60 text-foreground ${
                confirmPassword && confirmPassword !== password
                  ? "border-rose-500 focus:ring-rose-500/40"
                  : "border-border focus:ring-blue-600/40 focus:border-blue-600"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {confirmPassword && confirmPassword !== password && (
            <p className="text-xs text-rose-500 mt-1 font-medium">
              Passwords do not match
            </p>
          )}
        </div>

        {/* Terms Checkbox */}
        <div className="flex items-start gap-3 pt-1">
          <input
            id="terms"
            type="checkbox"
            required
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded border-border text-blue-600 focus:ring-blue-600 accent-blue-600 cursor-pointer"
          />
          <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none">
            I agree to the{" "}
            <Link href="/terms" className="text-blue-600 hover:underline font-semibold">
              Terms & Conditions
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-blue-600 hover:underline font-semibold">
              Privacy Policy
            </Link>
            .
          </label>
        </div>

        {/* Create Account CTA Button */}
        <button
          type="submit"
          disabled={isLoading || !agreedToTerms}
          className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/25 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : signupRole === "job_provider" ? (
            "Create Employer Account"
          ) : signupRole === "provider" ? (
            "Create Provider Account"
          ) : (
            "Create User Account"
          )}
        </button>

        {/* Encrypted Security Badge */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-0.5">
          <span>🔒</span>
          <span>Your information is securely encrypted and protected.</span>
        </div>

        {/* Or continue with Divider */}
        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-3 text-muted-foreground font-medium">
              Or continue with
            </span>
          </div>
        </div>

        {/* Google SSO Button */}
        <GoogleButton />
      </form>

      {/* Switch to Login Link */}
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer transition-colors"
        >
          Sign In →
        </button>
      </div>
    </div>
  );
}
