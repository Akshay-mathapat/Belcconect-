"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  MapPin, 
  UserCheck,
  CheckCircle2
} from "lucide-react";
import { useProviderStore } from "@/store/useProviderStore";
import { useTranslation } from "@/lib/i18n";

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const { bookings } = useProviderStore();
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<number>(30); // 30th Jul

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {t("serviceProvider.scheduleAndJobCalendar")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {t("serviceProvider.scheduleCalendarDesc")}
          </p>
        </div>

        <Link
          href="/provider/availability"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border hover:bg-muted text-xs font-bold text-foreground self-start sm:self-auto"
        >
          <Clock className="h-4 w-4 text-[#1F5F5B]" />
          <span>{t("serviceProvider.configureWorkingHours")}</span>
        </Link>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Calendar Grid (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-2 font-heading font-bold text-base text-foreground">
              <CalendarIcon className="h-5 w-5 text-[#1F5F5B]" />
              <span>{t("serviceProvider.july2026")}</span>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded-lg border border-border hover:bg-muted text-foreground">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button className="p-1.5 rounded-lg border border-border hover:bg-muted text-foreground">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Days header */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-muted-foreground">
            {daysOfWeek.map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>

          {/* Date Cells */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {Array.from({ length: 31 }).map((_, i) => {
              const dayNum = i + 1;
              const isSelected = selectedDate === dayNum;
              const hasJobs = dayNum === 28 || dayNum === 29 || dayNum === 30;

              return (
                <button
                  key={dayNum}
                  onClick={() => setSelectedDate(dayNum)}
                  className={`h-14 sm:h-20 p-1 sm:p-2 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    isSelected 
                      ? "bg-blue-600/10 border-blue-600 text-blue-600 shadow-sm font-bold" 
                      : "bg-card border-border/70 hover:bg-muted/40 text-foreground"
                  }`}
                >
                  <span className="text-[10px] sm:text-xs font-bold">{dayNum}</span>

                  {hasJobs && (
                    <div className="space-y-0.5 sm:space-y-1">
                      {dayNum === 30 && (
                        <span className="block text-[8px] sm:text-[9px] font-bold px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded bg-blue-600 text-white truncate">
                          {t("serviceProvider.twoJobs")}
                        </span>
                      )}
                      {dayNum === 29 && (
                        <span className="block text-[8px] sm:text-[9px] font-bold px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded bg-emerald-600 text-white truncate">
                          {t("serviceProvider.completed")}
                        </span>
                      )}
                      {dayNum === 28 && (
                        <span className="block text-[8px] sm:text-[9px] font-bold px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded bg-amber-600 text-white truncate">
                          {t("serviceProvider.oneReview")}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Appointments Sidebar */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="border-b border-border pb-3 flex items-center justify-between">
            <h3 className="font-heading text-base font-bold text-foreground">
              {t("serviceProvider.bookingsOnDate").replace("{date}", String(selectedDate))}
            </h3>
            <span className="text-xs font-bold text-[#1F5F5B]">
              {selectedDate === 30 ? t("serviceProvider.twoJobsToday") : t("serviceProvider.oneCompletedJob")}
            </span>
          </div>

          <div className="space-y-3">
            {bookings.slice(0, 3).map((b) => (
              <div key={b.id} className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#1F5F5B]">{b.time}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1F5F5B]/10 text-[#1F5F5B]">
                    {t(`account.statuses.${b.status}`) || b.status}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-foreground">{b.serviceName}</h4>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5" />
                  {b.customerName}
                </p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{b.address}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
