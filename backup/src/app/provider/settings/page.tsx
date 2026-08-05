"use client";

import { useTheme } from "@/components/providers/ThemeProvider";
import { Sun, Moon, Laptop, Bell, HelpCircle } from "lucide-react";

export default function SettingsPage() {
  const { theme, setTheme, mounted } = useTheme();

  const themeOptions = [
    {
      id: "light" as const,
      label: "Light Mode",
      subtitle: "Clean, high-contrast surface",
      icon: Sun,
      color: "text-amber-500 bg-amber-500/10 border-amber-500/30"
    },
    {
      id: "dark" as const,
      label: "Dark Mode",
      subtitle: "Sleek, low-light workspace",
      icon: Moon,
      color: "text-blue-500 bg-blue-500/10 border-blue-500/30"
    },
    {
      id: "system" as const,
      label: "System Mode",
      subtitle: "Syncs with OS preferences",
      icon: Laptop,
      color: "text-purple-500 bg-purple-500/10 border-purple-500/30"
    }
  ];

  const currentTheme = mounted ? theme : "system";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Portal Settings & Preferences
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Customize interface theme preferences, notification alerts, privacy policies, and support channels.
        </p>
      </div>

      <div className="space-y-6 text-xs">
        
        {/* Interface Theme Selection */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="font-heading text-base font-bold text-foreground flex items-center gap-2">
                <Sun className="h-4 w-4 text-amber-500" />
                Interface Theme Selection
              </h2>
              <p className="text-muted-foreground text-[11px] mt-0.5">
                Choose your preferred display appearance across the dashboard
              </p>
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-600/20">
              Active: {currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = currentTheme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTheme(opt.id)}
                  className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between space-y-3 cursor-pointer ${
                    isSelected
                      ? "border-blue-600 bg-blue-600/10 shadow-md ring-2 ring-blue-600/20"
                      : "border-border bg-muted/20 hover:bg-muted/50 hover:border-border/80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-2.5 rounded-xl border ${opt.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                        ✓
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                      {opt.label}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {opt.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Notifications Preference */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <h2 className="font-heading text-base font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
            <Bell className="h-4 w-4 text-[#1F5F5B]" />
            Push & SMS Notifications
          </h2>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-xl bg-muted/20 cursor-pointer">
              <div>
                <span className="font-bold text-foreground block">Instant Booking SMS Alerts</span>
                <span className="text-muted-foreground text-[11px]">Receive instant SMS when a customer requests a service</span>
              </div>
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-[#1F5F5B]" />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-muted/20 cursor-pointer">
              <div>
                <span className="font-bold text-foreground block">Payout Deposit Notifications</span>
                <span className="text-muted-foreground text-[11px]">Email & push notification when funds enter your bank</span>
              </div>
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-[#1F5F5B]" />
            </label>
          </div>
        </div>

        {/* Help & Support */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
          <h2 className="font-heading text-base font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
            <HelpCircle className="h-4 w-4 text-purple-600" />
            BelConnect Partner Support
          </h2>

          <p className="text-muted-foreground leading-relaxed">
            Need assistance with customer disputes, payout delays, or app technical issues? Our Belagavi provider hotline is available 24/7.
          </p>

          <a
            href="tel:+918001234567"
            className="inline-block text-xs font-bold text-[#1F5F5B] bg-[#1F5F5B]/10 px-4 py-2 rounded-xl border border-[#1F5F5B]/20"
          >
            Call Provider Hotline: +91 1800 123 4567
          </a>
        </div>

      </div>

    </div>
  );
}
