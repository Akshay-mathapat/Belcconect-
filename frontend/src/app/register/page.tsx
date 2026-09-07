"use client";

import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm font-medium">Loading...</div>}>
      <AuthLayout initialMode="signup" />
    </Suspense>
  );
}
