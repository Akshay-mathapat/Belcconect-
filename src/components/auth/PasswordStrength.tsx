"use client";

import { memo } from "react";
import { Check } from "lucide-react";

interface PasswordStrengthProps {
  password: string;
}

export const PasswordStrength = memo(function PasswordStrength({
  password,
}: PasswordStrengthProps) {
  if (!password) return null;

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  const passedChecksCount = [hasMinLength, hasUppercase, hasNumber].filter(Boolean).length;

  let strengthLabel = "Weak";
  let strengthColor = "bg-rose-500";
  let strengthWidth = "w-1/3";

  if (passedChecksCount === 2) {
    strengthLabel = "Medium";
    strengthColor = "bg-amber-500";
    strengthWidth = "w-2/3";
  } else if (passedChecksCount === 3) {
    strengthLabel = "Strong";
    strengthColor = "bg-emerald-500";
    strengthWidth = "w-full";
  }

  return (
    <div className="mt-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${strengthColor} ${strengthWidth}`}
          />
        </div>
        <span className="text-xs font-semibold text-muted-foreground">
          {strengthLabel}
        </span>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground pt-1">
        <div className="flex items-center gap-2">
          <div
            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
              hasMinLength
                ? "bg-emerald-500 border-emerald-500 text-white"
                : "border-muted-foreground/40"
            }`}
          >
            {hasMinLength && <Check className="w-2.5 h-2.5 stroke-[3]" />}
          </div>
          <span className={hasMinLength ? "text-foreground font-medium" : ""}>
            Minimum 8 characters
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
              hasUppercase
                ? "bg-emerald-500 border-emerald-500 text-white"
                : "border-muted-foreground/40"
            }`}
          >
            {hasUppercase && <Check className="w-2.5 h-2.5 stroke-[3]" />}
          </div>
          <span className={hasUppercase ? "text-foreground font-medium" : ""}>
            One uppercase letter
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border ${
              hasNumber
                ? "bg-emerald-500 border-emerald-500 text-white"
                : "border-muted-foreground/40"
            }`}
          >
            {hasNumber && <Check className="w-2.5 h-2.5 stroke-[3]" />}
          </div>
          <span className={hasNumber ? "text-foreground font-medium" : ""}>
            One number
          </span>
        </div>
      </div>
    </div>
  );
});
