"use client";

import { memo } from "react";

interface AuthHeaderProps {
  title: string;
  subtitle: string;
}

export const AuthHeader = memo(function AuthHeader({
  title,
  subtitle,
}: AuthHeaderProps) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-heading mb-1.5">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {subtitle}
      </p>
    </div>
  );
});
