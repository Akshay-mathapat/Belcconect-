"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, Lock, Mail, RefreshCw, Eye, EyeOff, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthHeader } from "./AuthHeader";
import { PasswordStrength } from "./PasswordStrength";

interface ForgotPasswordModalProps {
  onBackToLogin: () => void;
}

export function ForgotPasswordModal({ onBackToLogin }: ForgotPasswordModalProps) {
  const router = useRouter();

  // Multi-step state: 1 = Email Input, 2 = 6-digit OTP, 3 = New Password Input, 4 = Success
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form Fields
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI & Loading States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(60);
  const [isResendDisabled, setIsResendDisabled] = useState(true);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown timer for OTP Resend (60s)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 2 && isResendDisabled && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            setIsResendDisabled(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, isResendDisabled, resendCooldown]);

  // Focus first OTP input on step 2 load
  useEffect(() => {
    if (step === 2) {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    }
  }, [step]);

  // Step 1: Send Forgot Password OTP Code
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      setIsLoading(false);

      if (res.ok && data.success) {
        setStep(2);
        setResendCooldown(60);
        setIsResendDisabled(true);
      } else {
        setErrorMessage(data.error || data.message || "Unable to send verification code. Please try again.");
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage("Network error. Please check your connection.");
    }
  };

  // Step 2: Verify 6-digit OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const fullOtp = otp.join("");
    if (fullOtp.length !== 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    setErrorMessage("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/verify-reset-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: fullOtp })
      });
      const data = await res.json();
      setIsLoading(false);

      if (res.ok && data.success && data.resetToken) {
        setResetToken(data.resetToken);
        setStep(3);
      } else {
        setErrorMessage(data.message || "Invalid or expired verification code.");
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage("Network error. Please check your connection.");
    }
  };

  // Handle Resend OTP Code
  const handleResendOtp = async () => {
    if (isResendDisabled) return;
    setErrorMessage("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      setIsLoading(false);

      if (res.ok && data.success) {
        setSuccessMessage("A new verification code has been sent.");
        setOtp(["", "", "", "", "", ""]);
        setResendCooldown(60);
        setIsResendDisabled(true);
        setTimeout(() => setSuccessMessage(""), 4000);
      } else {
        setErrorMessage(data.error || data.message || "Unable to resend code.");
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage("Network error. Please check your connection.");
    }
  };

  // OTP Input Keyboard Handlers
  const handleOtpChange = (index: number, value: string) => {
    const cleanValue = value.replace(/\D/g, "");
    if (!cleanValue && value !== "") return;

    const newOtp = [...otp];

    if (cleanValue.length > 1) {
      // Handle Paste of full code
      const pastedDigits = cleanValue.slice(0, 6).split("");
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pastedDigits[i] || "";
      }
      setOtp(newOtp);
      const nextFocus = Math.min(pastedDigits.length, 5);
      otpInputRefs.current[nextFocus]?.focus();
      return;
    }

    newOtp[index] = cleanValue;
    setOtp(newOtp);

    if (cleanValue && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (!resetToken) {
      setErrorMessage("Session expired. Please restart the password reset process.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resetToken,
          newPassword,
          confirmPassword
        })
      });
      const data = await res.json();
      setIsLoading(false);

      if (res.ok && data.success) {
        setStep(4);
      } else {
        setErrorMessage(data.message || data.error || "Unable to reset password. Please try again.");
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage("Network error. Please check your connection.");
    }
  };

  return (
    <div className="w-full">
      {/* Back Button */}
      {step !== 4 && (
        <button
          type="button"
          onClick={onBackToLogin}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Login
        </button>
      )}

      {/* Error / Success Notifications */}
      {errorMessage && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* STEP 1: Enter Email */}
      {step === 1 && (
        <div>
          <AuthHeader
            title="Forgot Password?"
            subtitle="Enter your registered email address and we'll send you a 6-digit verification code."
          />

          <form onSubmit={handleSendCode} className="space-y-4 sm:space-y-5">
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
                  placeholder="name@example.com"
                  className="w-full pl-11 pr-4 py-3 bg-muted/30 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-all text-sm outline-none placeholder:text-muted-foreground/60 text-foreground"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/25 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  Sending Code...
                </>
              ) : (
                "Send Verification Code"
              )}
            </button>
          </form>
        </div>
      )}

      {/* STEP 2: Enter 6-digit OTP */}
      {step === 2 && (
        <div>
          <AuthHeader
            title="Verify Code"
            subtitle={`Enter the 6-digit verification code sent to ${email}.`}
          />

          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="flex justify-between gap-2 max-w-xs mx-auto">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => { otpInputRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  className="w-11 h-12 text-center text-lg font-bold bg-muted/30 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 text-foreground transition-all outline-none"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={isLoading || otp.join("").length !== 6}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/25 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  Verifying Code...
                </>
              ) : (
                "Verify Code"
              )}
            </button>

            {/* Resend Countdown */}
            <div className="text-center text-xs text-muted-foreground pt-2">
              Didn't receive the code?{" "}
              {isResendDisabled ? (
                <span className="font-semibold text-foreground">
                  Resend in {resendCooldown}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isLoading}
                  className="text-blue-600 hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Resend Code
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* STEP 3: Create New Password */}
      {step === 3 && (
        <div>
          <AuthHeader
            title="Create New Password"
            subtitle="Your identity has been verified. Create a new strong password for your account."
          />

          <form onSubmit={handleResetPassword} className="space-y-4 sm:space-y-5">
            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showNewPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-11 py-3 bg-muted/30 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-all text-sm outline-none placeholder:text-muted-foreground/60 text-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrength password={newPassword} />
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-11 py-3 bg-muted/30 border border-border rounded-xl focus:bg-background focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 transition-all text-sm outline-none placeholder:text-muted-foreground/60 text-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !newPassword || newPassword !== confirmPassword}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/25 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  Updating Password...
                </>
              ) : (
                "Reset Password"
              )}
            </button>
          </form>
        </div>
      )}

      {/* STEP 4: Success Screen */}
      {step === 4 && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 text-center space-y-4 my-auto">
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-200">
            Password Reset Successfully
          </h3>
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            Your password has been updated. You can now sign in with your new password.
          </p>
          <button
            type="button"
            onClick={onBackToLogin}
            className="inline-flex items-center justify-center w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md cursor-pointer"
          >
            Sign In
          </button>
        </div>
      )}
    </div>
  );
}
