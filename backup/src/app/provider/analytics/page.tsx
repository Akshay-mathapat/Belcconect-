"use client";

import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Users, Clock, Zap, Star, Inbox } from "lucide-react";
import { useProviderStore } from "@/store/useProviderStore";

export default function AnalyticsPage() {
  const { services, bookings } = useProviderStore();

  const totalBookings = bookings.length;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Performance Analytics & Insights
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Deep-dive analysis on booking conversion, peak customer demand hours, and service volume.
        </p>
      </div>

      {/* Top Metric Highlights (Initial state reset to 0) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
          <span className="text-xs text-muted-foreground font-semibold">Booking Conversion Rate</span>
          <div className="font-heading text-2xl font-bold text-blue-600 dark:text-blue-400">0%</div>
          <span className="text-[10px] text-muted-foreground font-medium">Initial Status in Belagavi</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
          <span className="text-xs text-muted-foreground font-semibold">Returning Customers</span>
          <div className="font-heading text-2xl font-bold text-blue-600 dark:text-blue-400">0%</div>
          <span className="text-[10px] text-muted-foreground font-medium">0 Repeat Customers</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
          <span className="text-xs text-muted-foreground font-semibold">Avg Job Response Time</span>
          <div className="font-heading text-2xl font-bold text-amber-500">0 Mins</div>
          <span className="text-[10px] text-emerald-600 font-bold">Fast response badge</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
          <span className="text-xs text-muted-foreground font-semibold">Job Cancellation Rate</span>
          <div className="font-heading text-2xl font-bold text-emerald-600">0%</div>
          <span className="text-[10px] text-muted-foreground font-medium">Zero cancellations</span>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Performing Services Breakdown */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-heading text-base font-bold text-foreground flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-600" />
              Top Performing Services
            </h3>
            <span className="text-xs font-bold text-muted-foreground">By Volume</span>
          </div>

          {services.length > 0 ? (
            <div className="space-y-4">
              {services.map((s) => (
                <div key={s.id} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-foreground truncate max-w-xs">{s.name}</span>
                    <span className="text-blue-600 font-bold">{s.bookingsCount || 0} bookings</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 rounded-full" 
                      style={{ width: `${s.bookingsCount ? Math.min((s.bookingsCount / 50) * 100, 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-xs">
              <Inbox className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              No active services added.
            </div>
          )}
        </div>

        {/* Peak Demand Working Hours Heatmap */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-heading text-base font-bold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Peak Customer Booking Times
            </h3>
            <span className="text-xs font-bold text-muted-foreground">Belagavi Zone</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
              <span className="font-bold text-foreground">Morning (09:00 AM - 12:00 PM)</span>
              <span className="font-bold text-blue-600">0% of total bookings</span>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
              <span className="font-bold text-foreground">Afternoon (02:00 PM - 05:00 PM)</span>
              <span className="font-bold text-amber-600">0% of total bookings</span>
            </div>

            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between">
              <span className="font-bold text-foreground">Evening (06:00 PM - 08:00 PM)</span>
              <span className="font-bold text-purple-600">0% of total bookings</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
