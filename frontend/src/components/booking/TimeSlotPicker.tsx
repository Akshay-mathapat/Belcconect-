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

// Check if a time slot is already booked
function isSlotBooked(slot: string, bookedSlots: string[]): boolean {
  if (!bookedSlots || bookedSlots.length === 0) return false;

  const normSlot = slot.toLowerCase().replace(/\s+/g, "").replace(/–/g, "-");

  return bookedSlots.some((b) => {
    if (!b) return false;
    const normB = b.toLowerCase().replace(/\s+/g, "").replace(/–/g, "-");
    if (normSlot === normB) return true;

    // Match start time e.g. "10:00am" matching "10:00am-11:00am"
    const slotStart = normSlot.split("-")[0];
    const bStart = normB.split("-")[0];
    if (slotStart && bStart && slotStart === bStart) return true;

    return false;
  });
}

// Check if a time slot has already passed for the selected date
function isSlotInPast(slot: string, selectedDateStr: string): boolean {
  if (!selectedDateStr) return false;

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  // If selected date is in the future, it's not in the past
  if (selectedDateStr > todayStr) return false;

  // If selected date is before today (yesterday or earlier), all slots are in the past
  if (selectedDateStr < todayStr) return true;

  // Selected date IS today! Parse slot start time e.g. "9:00 AM – 10:00 AM" or "09:00 AM - 10:00 AM"
  const startPart = slot.split(/–|-/)[0]?.trim();
  if (!startPart) return false;

  const match = startPart.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return false;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();

  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  const slotStartMinutes = hour * 60 + minute;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Slot has passed if slot start time is less than or equal to current time
  return slotStartMinutes <= currentMinutes;
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
      dayOfWeek: fullDayName,
    });
  }

  return days;
}

// Compute slots based on provider schedule
function getSlotsForDay(dayOfWeek: string, schedule: AvailabilitySchedule[]) {
  const daySchedule = schedule.find((s) => s.day.toLowerCase() === dayOfWeek.toLowerCase()) || {
    day: dayOfWeek,
    isWorking: true,
    startTime: "09:00",
    endTime: "19:00",
    breakStart: "13:00",
    breakEnd: "14:00",
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
  providerId,
}: TimeSlotPickerProps) {
  const { schedule } = useProviderStore();
  const days = getNext7Days();

  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // If no date selected yet, default to today
  useEffect(() => {
    if (!selectedDate && days.length > 0) {
      onDateChange(days[0].dateStr);
    }
  }, [selectedDate, days, onDateChange]);

  // Fetch already booked slots for the selected date
  useEffect(() => {
    if (!selectedDate) return;

    let isMounted = true;
    setIsLoadingSlots(true);

    const url = `/api/bookings/booked-slots?date=${encodeURIComponent(selectedDate)}${
      providerId ? `&providerId=${encodeURIComponent(providerId)}` : ""
    }`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.bookedSlots && Array.isArray(data.bookedSlots)) {
          setBookedSlots(data.bookedSlots);
        }
      })
      .catch((err) => {
        console.error("Error loading booked slots:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingSlots(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDate, providerId]);

  // Reset selected time if it becomes booked or has passed
  useEffect(() => {
    if (selectedTime && (isSlotBooked(selectedTime, bookedSlots) || isSlotInPast(selectedTime, selectedDate))) {
      onTimeChange("");
    }
  }, [selectedTime, bookedSlots, selectedDate, onTimeChange]);

  // Determine current day info
  const selectedDayObj = days.find((d) => d.dateStr === selectedDate) || {
    dateStr: selectedDate,
    fullDayName: new Date(selectedDate || Date.now()).toLocaleDateString("en-US", { weekday: "long" }),
    displayTitle: new Date(selectedDate || Date.now()).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    }),
    shortLabel: new Date(selectedDate || Date.now()).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    badge: "",
    dayOfWeek: new Date(selectedDate || Date.now()).toLocaleDateString("en-US", { weekday: "long" }),
  };

  const rawSlotData = getSlotsForDay(selectedDayObj.dayOfWeek, schedule);

  // Filter out already-booked or past time slots so earlier/passed timings are NOT shown/selectable
  const slotData = {
    isOff: rawSlotData.isOff,
    morning: rawSlotData.morning.filter((slot) => !isSlotBooked(slot, bookedSlots) && !isSlotInPast(slot, selectedDate)),
    afternoon: rawSlotData.afternoon.filter((slot) => !isSlotBooked(slot, bookedSlots) && !isSlotInPast(slot, selectedDate)),
    evening: rawSlotData.evening.filter((slot) => !isSlotBooked(slot, bookedSlots) && !isSlotInPast(slot, selectedDate)),
    totalBooked: rawSlotData.morning.concat(rawSlotData.afternoon, rawSlotData.evening).filter((slot) => isSlotBooked(slot, bookedSlots)).length,
    totalPassed: rawSlotData.morning.concat(rawSlotData.afternoon, rawSlotData.evening).filter((slot) => isSlotInPast(slot, selectedDate)).length,
  };

  const totalAvailableCount = slotData.morning.length + slotData.afternoon.length + slotData.evening.length;

  // Compute current today string for date comparison
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const getEmptySlotMessage = () => {
    const isPastDate = Boolean(selectedDate && selectedDate < todayStr);
    const isToday = Boolean(selectedDate && selectedDate === todayStr);

    if (isPastDate) {
      return {
        title: "Selected Date Has Passed",
        description: `The selected date (${selectedDayObj.displayTitle}) is in the past. Please choose today or an upcoming date to view available time slots.`,
        variant: "amber" as const,
      };
    }

    if (isToday && slotData.totalPassed > 0 && slotData.totalBooked === 0) {
      return {
        title: "Today's Time Slots Have Passed",
        description: `All time slots for today (${selectedDayObj.displayTitle}) have already passed. Please select tomorrow or another upcoming date to book your service.`,
        variant: "amber" as const,
      };
    }

    if (slotData.totalPassed > 0 && slotData.totalBooked > 0) {
      return {
        title: "No Available Slots For Today",
        description: `Time slots for today (${selectedDayObj.displayTitle}) are either fully booked or have already passed. Please choose another date.`,
        variant: "rose" as const,
      };
    }

    return {
      title: "All Slots Fully Booked",
      description: `All time slots on ${selectedDayObj.displayTitle} have already been booked by other customers. Please choose another date.`,
      variant: "rose" as const,
    };
  };

  return (
    <div className="space-y-6">
      {/* 1. Date Selection Header & Chips */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <CalendarIcon className="w-4 h-4 text-primary" />
            Select Service Date
          </label>
          <span className="text-xs font-semibold text-primary">{selectedDayObj.displayTitle}</span>
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
                  onTimeChange("");
                }}
                className={`flex-shrink-0 px-4 py-3 rounded-2xl border text-left transition-all cursor-pointer min-w-[120px] flex flex-col justify-between ${
                  isSelected
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-md"
                    : "border-border bg-card hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      isSelected ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
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
            min={todayStr}
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
            <p className="font-bold text-sm text-foreground">Provider Off Duty</p>
            <p className="text-[11px] opacity-90 mt-0.5">
              The service provider is not on duty on {selectedDayObj.fullDayName}s according to their weekly availability. Please choose another date.
            </p>
          </div>
        </div>
      ) : totalAvailableCount === 0 ? (() => {
        const emptyInfo = getEmptySlotMessage();
        const isAmber = emptyInfo.variant === "amber";
        return (
          <div className={`p-5 rounded-2xl text-xs font-semibold flex items-start gap-3 border ${
            isAmber
              ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
              : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
          }`}>
            <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${isAmber ? "text-amber-500" : "text-rose-500"}`} />
            <div>
              <p className="font-bold text-sm text-foreground">{emptyInfo.title}</p>
              <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
                {emptyInfo.description}
              </p>
            </div>
          </div>
        );
      })() : (
        <div className="space-y-5 border-t border-border/80 pt-5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary" />
              Available Time Slots
            </label>
            <div className="flex items-center gap-2">
              {slotData.totalBooked > 0 && (
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  {slotData.totalBooked} slot{slotData.totalBooked > 1 ? "s" : ""} booked
                </span>
              )}
              {slotData.totalPassed > 0 && (
                <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {slotData.totalPassed} slot{slotData.totalPassed > 1 ? "s" : ""} passed
                </span>
              )}
              {selectedTime ? (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                  Selected: {selectedTime}
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground font-medium">Select an available slot</span>
              )}
            </div>
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
                      <span
                        className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? "border-white bg-white" : "border-muted-foreground/60"
                        }`}
                      >
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
                      <span
                        className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? "border-white bg-white" : "border-muted-foreground/60"
                        }`}
                      >
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
                      <span
                        className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? "border-white bg-white" : "border-muted-foreground/60"
                        }`}
                      >
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
