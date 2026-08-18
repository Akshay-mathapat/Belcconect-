"use client";

import { useState, useEffect } from "react";
import { Sun, Sunset, Moon, Calendar as CalendarIcon, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { useProviderStore } from "@/store/useProviderStore";
import { AvailabilitySchedule } from "@/types/provider";

interface TimeSlotPickerProps {
  selectedDate: string; // YYYY-MM-DD format
  onDateChange: (date: string) => void;
  selectedTime: string; // e.g. "09:00 AM – 10:00 AM"
  onTimeChange: (time: string) => void;
  providerId?: string | null;
}

// Format 24-hour number to 12-hour AM/PM string
function format12Hour(hour: number): string {
  const isPM = hour >= 12;
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:00 ${isPM ? "PM" : "AM"}`;
}

// Generate next 7 days for quick date selection
function getNext7Days() {
  const days = [];
  const today = new Date();
  
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(today.getDate() + i);
    
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    const fullDayName = d.toLocaleDateString("en-US", { weekday: "long" });
    const monthName = d.toLocaleDateString("en-US", { month: "short" });
    const dayNum = d.getDate();

    let displayTitle = `${fullDayName}, ${monthName} ${dayNum}`;
    let badge = i === 0 ? "Today" : i === 1 ? "Tomorrow" : dayName;

    days.push({
      dateStr,
      fullDayName,
      displayTitle,
      shortLabel: `${dayName}, ${monthName} ${dayNum}`,
      badge,
      dayOfWeek: fullDayName
    });
  }

  return days;
}

// Compute slots based on provider schedule
function getSlotsForDay(dayOfWeek: string, schedule: AvailabilitySchedule[]) {
  const daySchedule = schedule.find(s => s.day.toLowerCase() === dayOfWeek.toLowerCase()) || {
    day: dayOfWeek,
    isWorking: true,
    startTime: "09:00",
    endTime: "19:00",
    breakStart: "13:00",
    breakEnd: "14:00"
  };

  if (!daySchedule.isWorking) {
    return { isOff: true, morning: [], afternoon: [], evening: [] };
  }

  const start = parseInt((daySchedule.startTime || "09:00").split(":")[0], 10);
  const end = parseInt((daySchedule.endTime || "19:00").split(":")[0], 10);
  const bStart = parseInt((daySchedule.breakStart || "13:00").split(":")[0], 10);
  const bEnd = parseInt((daySchedule.breakEnd || "14:00").split(":")[0], 10);

  const morning: string[] = [];
  const afternoon: string[] = [];
  const evening: string[] = [];

  for (let h = start; h < end; h++) {
    // Skip slots during provider break time
    if (h >= bStart && h < bEnd) continue;

    const label = `${format12Hour(h)} – ${format12Hour(h + 1)}`;
    if (h < 12) {
      morning.push(label);
    } else if (h < 17) {
      afternoon.push(label);
    } else {
      evening.push(label);
    }
  }

  return { isOff: false, morning, afternoon, evening };
}

export default function TimeSlotPicker({
  selectedDate,
  onDateChange,
  selectedTime,
  onTimeChange,
  providerId
}: TimeSlotPickerProps) {
  const { schedule } = useProviderStore();
  const days = getNext7Days();

  // If no date selected yet, default to today
  useEffect(() => {
    if (!selectedDate && days.length > 0) {
      onDateChange(days[0].dateStr);
    }
  }, [selectedDate, days, onDateChange]);

  // Determine current day info
  const selectedDayObj = days.find(d => d.dateStr === selectedDate) || {
    dateStr: selectedDate,
    fullDayName: new Date(selectedDate || Date.now()).toLocaleDateString("en-US", { weekday: "long" }),
    displayTitle: new Date(selectedDate || Date.now()).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
    shortLabel: new Date(selectedDate || Date.now()).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    badge: "",
    dayOfWeek: new Date(selectedDate || Date.now()).toLocaleDateString("en-US", { weekday: "long" })
  };

  const slotData = getSlotsForDay(selectedDayObj.dayOfWeek, schedule);

  return (
    <div className="space-y-6">
      
      {/* 1. Date Selection Header & Chips */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <CalendarIcon className="w-4 h-4 text-primary" />
            Select Service Date
          </label>
          <span className="text-xs font-semibold text-primary">
            {selectedDayObj.displayTitle}
          </span>
        </div>

        {/* Scrollable Horizontal Date Chips */}
        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
          {days.map((d) => {
            const isSelected = selectedDate === d.dateStr;
            return (
              <button
                key={d.dateStr}
                type="button"
                onClick={() => {
                  onDateChange(d.dateStr);
                  // Reset selected time when switching date if previous slot not available
                  onTimeChange("");
                }}
                className={`flex-shrink-0 px-4 py-3 rounded-2xl border text-left transition-all cursor-pointer min-w-[120px] flex flex-col justify-between ${
                  isSelected
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-md"
                    : "border-border bg-card hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                    {d.badge || d.fullDayName.slice(0, 3)}
                  </span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                </div>
                <span className={`text-xs font-extrabold ${isSelected ? "text-foreground" : "text-foreground/80"}`}>
                  {d.shortLabel}
                </span>
              </button>
            );
          })}
        </div>

        {/* Custom Calendar Picker fallback */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground font-medium">Or pick another date:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) {
                onDateChange(e.target.value);
                onTimeChange("");
              }
            }}
            className="px-3 py-1.5 rounded-xl border border-border bg-card text-xs text-foreground font-medium focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* 2. Provider Working Hours & Slots Status */}
      {slotData.isOff ? (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-500" />
          <div>
            <p className="font-bold">Provider Off Duty</p>
            <p className="text-[11px] opacity-90 mt-0.5">
              The service provider is not on duty on {selectedDayObj.fullDayName}s according to their weekly availability. Please choose another date.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5 border-t border-border/80 pt-5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary" />
              Available Time Slots
            </label>
            {selectedTime ? (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                Selected: {selectedTime}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground font-medium">
                Select an available slot below
              </span>
            )}
          </div>

          {/* Morning Section */}
          {slotData.morning.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Morning</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {slotData.morning.map((slot) => {
                  const isSelected = selectedTime === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => onTimeChange(slot)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-start gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-md ring-2 ring-primary/40 font-bold"
                          : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5"
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? "border-white bg-white" : "border-muted-foreground/60"
                      }`}>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </span>
                      <span className="truncate">{slot}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Afternoon Section */}
          {slotData.afternoon.length > 0 && (
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Sunset className="w-4 h-4 text-orange-500" />
                <span>Afternoon</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {slotData.afternoon.map((slot) => {
                  const isSelected = selectedTime === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => onTimeChange(slot)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-start gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-md ring-2 ring-primary/40 font-bold"
                          : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5"
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? "border-white bg-white" : "border-muted-foreground/60"
                      }`}>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </span>
                      <span className="truncate">{slot}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Evening Section */}
          {slotData.evening.length > 0 && (
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Moon className="w-4 h-4 text-indigo-400" />
                <span>Evening</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {slotData.evening.map((slot) => {
                  const isSelected = selectedTime === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => onTimeChange(slot)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-start gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-md ring-2 ring-primary/40 font-bold"
                          : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5"
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? "border-white bg-white" : "border-muted-foreground/60"
                      }`}>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </span>
                      <span className="truncate">{slot}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
