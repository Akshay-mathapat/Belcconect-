"use client";

import { useEffect, useState } from "react";
import { Joyride, EventData, STATUS, Step } from "react-joyride";
import { useAuthStore } from "@/store/useAuthStore";

export function ProviderTour() {
  const { currentUser, dismissTour } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !currentUser || currentUser.isFirstLogin === false) {
    return null;
  }

  const steps: Step[] = [
    {
      target: '[data-tour="add-service"]',
      title: "Add Your First Service",
      content: "Click here to list a new service, specify category details, and configure options.",
    },
    {
      target: '[data-tour="provider-availability"]',
      title: "Set Your Availability",
      content: "Configure the working days and hours you are available to receive customer bookings.",
    },
    {
      target: '[data-tour="provider-bookings"]',
      title: "View & Manage Bookings",
      content: "Track customer requests, accept jobs, and update job execution statuses in real time.",
    },
    {
      target: '[data-tour="provider-calendar"]',
      title: "View Calendar",
      content: "Check your scheduled upcoming appointments and timeline at a glance.",
    },
  ];

  const handleJoyrideCallback = (data: EventData) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    if (finishedStatuses.includes(status)) {
      dismissTour();
    }
  };

  return (
    <Joyride
      steps={steps}
      run={true}
      onEvent={handleJoyrideCallback}
      locale={{
        back: "Back",
        close: "Close",
        last: "Finish",
        next: "Next",
        skip: "Skip",
      }}
      options={{
        arrowColor: "#18181b",
        backgroundColor: "#18181b",
        overlayColor: "rgba(0, 0, 0, 0.75)",
        primaryColor: "#2563eb",
        textColor: "#f4f4f5",
        zIndex: 10000,
        skipBeacon: true,
        showProgress: true,
        buttons: ["back", "skip", "primary"],
        overlayClickAction: false,
      }}
      styles={{
        tooltip: {
          borderRadius: "16px",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          padding: "20px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
        },
        tooltipContainer: {
          textAlign: "left",
        },
        tooltipTitle: {
          fontSize: "16px",
          fontWeight: "700",
          color: "#ffffff",
          marginBottom: "8px",
        },
        tooltipContent: {
          fontSize: "13px",
          color: "#a1a1aa",
          lineHeight: "1.5",
          padding: "4px 0 12px 0",
        },
        buttonPrimary: {
          backgroundColor: "#2563eb",
          borderRadius: "10px",
          color: "#ffffff",
          fontSize: "12px",
          fontWeight: "700",
          padding: "8px 16px",
          outline: "none",
        },
        buttonBack: {
          color: "#a1a1aa",
          fontSize: "12px",
          fontWeight: "600",
          marginRight: "8px",
        },
        buttonSkip: {
          color: "#71717a",
          fontSize: "12px",
          fontWeight: "600",
        },
      }}
    />
  );
}
