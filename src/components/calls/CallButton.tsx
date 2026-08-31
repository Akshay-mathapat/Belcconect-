"use client";

import { useState } from "react";
import { Phone, Loader2 } from "lucide-react";
import { useCallContext } from "./CallProvider";
import { useTranslation } from "@/lib/i18n";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AuthRequiredDialog } from "@/components/auth/AuthRequiredDialog";

interface CallButtonProps {
  bookingId: string;
  receiverId?: string;
  bookingStatus?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
}

export default function CallButton({
  bookingId,
  bookingStatus,
  size = "md",
  className = "",
  title
}: CallButtonProps) {
  const { startCall, isCalling } = useCallContext();
  const { t } = useTranslation();
  const { requireAuth, authDialogProps } = useRequireAuth();
  const [loading, setLoading] = useState(false);

  const isInactive = ["Rejected", "Cancelled", "Declined"].includes(bookingStatus || "");
  const displayTitle = title
    ? (t(title) !== title
        ? t(title)
        : t(`common.${title.toLowerCase()}`) !== `common.${title.toLowerCase()}`
          ? t(`common.${title.toLowerCase()}`)
          : title)
    : isInactive
      ? `Calling unavailable: Booking is ${t(`account.statuses.${bookingStatus}`) || bookingStatus}`
      : t("common.call");

  const initiateCall = () => {
    if (loading || isCalling) return;
    setLoading(true);
    startCall(bookingId)
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isInactive) {
      alert(`Calling is unavailable because this booking has been ${bookingStatus?.toLowerCase() || "cancelled"}.`);
      return;
    }

    const returnToUrl = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
    requireAuth({
      action: initiateCall,
      returnTo: returnToUrl,
      title: "Log In to Make Call",
      description: "Sign in to start an in-app voice call with your service provider."
    });
  };

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  const paddingSize = size === "sm" ? "p-1.5 rounded-lg" : size === "lg" ? "p-3 rounded-2xl" : "p-2 rounded-xl";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || isInactive}
        className={`${paddingSize} border border-border bg-muted/40 hover:bg-muted text-foreground transition-all shadow-sm ${
          isInactive ? "opacity-40 cursor-not-allowed" : "hover:scale-105 active:scale-95 cursor-pointer"
        } flex items-center justify-center ${className}`}
        title={displayTitle}
      >
        {loading ? (
          <Loader2 className={`${iconSize} animate-spin text-blue-600`} />
        ) : (
          <Phone className={`${iconSize} ${isInactive ? "text-muted-foreground" : "text-foreground"}`} />
        )}
      </button>

      <AuthRequiredDialog {...authDialogProps} />
    </>
  );
}
