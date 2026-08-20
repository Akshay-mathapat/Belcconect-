"use client";

import { useState } from "react";
import { Phone, Loader2 } from "lucide-react";
import { useCallContext } from "./CallProvider";

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
  const [loading, setLoading] = useState(false);

  const isInactive = ["Rejected", "Cancelled", "Declined"].includes(bookingStatus || "");
  const defaultTitle = isInactive
    ? `Calling unavailable: Booking is ${bookingStatus}`
    : "Call Provider/Customer";

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isInactive) {
      alert(`Calling is unavailable because this booking has been ${bookingStatus?.toLowerCase() || "cancelled"}.`);
      return;
    }

    if (loading || isCalling) return;

    setLoading(true);
    try {
      await startCall(bookingId);
    } catch (err: any) {
      // Handled in CallProvider
    } finally {
      setLoading(false);
    }
  };

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  const paddingSize = size === "sm" ? "p-1.5 rounded-lg" : size === "lg" ? "p-3 rounded-2xl" : "p-2 rounded-xl";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || isInactive}
      className={`${paddingSize} border border-border bg-muted/40 hover:bg-muted text-foreground transition-all shadow-sm ${
        isInactive ? "opacity-40 cursor-not-allowed" : "hover:scale-105 active:scale-95 cursor-pointer"
      } flex items-center justify-center ${className}`}
      title={title || defaultTitle}
    >
      {loading ? (
        <Loader2 className={`${iconSize} animate-spin text-blue-600`} />
      ) : (
        <Phone className={`${iconSize} ${isInactive ? "text-muted-foreground" : "text-foreground"}`} />
      )}
    </button>
  );
}
