"use client";

import { useState } from "react";
import { Clock, Calendar, CheckCircle2, ShieldAlert, Zap, Sparkles, ChevronDown } from "lucide-react";
import { useProviderStore } from "@/store/useProviderStore";

// Generate 30-minute interval dropdown time options for optimal UX
const TIME_OPTIONS: { label: string; value: string }[] = [];

for (let hour = 6; hour <= 23; hour++) {
  for (let min of [0, 30]) {
    const isPM = hour >= 12;
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const formattedHour = displayHour.toString().padStart(2, "0");
    const formattedMin = min.toString().padStart(2, "0");
    const period = isPM ? "PM" : "AM";
    const label = `${formattedHour}:${formattedMin} ${period}`;
    
    // Convert to 24h string value for state
    const value24 = `${hour.toString().padStart(2, "0")}:${formattedMin}`;
    TIME_OPTIONS.push({ label, value: value24 });
  }
}

// Convert 24h format string (e.g. "09:00") to formatted label or fallback
function formatTimeLabel(val: string): string {
  if (!val) return "Select Time";
  const matched = TIME_OPTIONS.find(t => t.value === val);
  if (matched) return matched.label;
  
  const [hStr, mStr] = val.split(":");
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return val;
  const isPM = h >= 12;
  const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayHour.toString().padStart(2, "0")}:${mStr || "00"} ${isPM ? "PM" : "AM"}`;
}

export default function AvailabilityPage() {
  const { schedule, updateAvailabilitySchedule } = useProviderStore();
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("");

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleApplyPreset = (presetValue: string) => {
    setSelectedPreset(presetValue);
    if (!presetValue) return;

    let start = "09:00";
    let end = "19:00";
    let bStart = "13:00";
    let bEnd = "14:00";

    if (presetValue === "standard") {
      start = "09:00";
      end = "19:00";
      bStart = "13:00";
      bEnd = "14:00";
    } else if (presetValue === "morning") {
      start = "08:00";
      end = "16:00";
      bStart = "12:00";
      bEnd = "13:00";
    } else if (presetValue === "evening") {
      start = "12:00";
      end = "21:00";
      bStart = "16:00";
      bEnd = "17:00";
    } else if (presetValue === "fullday") {
      start = "08:00";
      end = "20:00";
      bStart = "13:00";
      bEnd = "14:00";
    }

    schedule.forEach(item => {
      if (item.isWorking) {
        updateAvailabilitySchedule(item.day, {
          startTime: start,
          endTime: end,
          breakStart: bStart,
          breakEnd: bEnd
        });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Weekly Working Hours & Availability
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Configure available slot timings so customers can easily book when you are on duty.
          </p>
        </div>

        {savedSuccess && (
          <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 self-start sm:self-auto">
            ✓ Schedule Saved!
          </span>
        )}
      </div>

      {/* Preset Dropdown Bar for Fast UX */}
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
          <div>
            <h3 className="text-xs font-bold text-foreground">Quick Hours Preset</h3>
            <p className="text-[11px] text-muted-foreground">Select a schedule template to instantly apply across all active working days</p>
          </div>
        </div>

        <div className="relative shrink-0 sm:w-72">
          <select
            value={selectedPreset}
            onChange={(e) => handleApplyPreset(e.target.value)}
            className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-card border border-border text-foreground appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-blue-600/30 cursor-pointer shadow-xs"
          >
            <option value="">-- Apply Quick Hours Preset --</option>
            <option value="standard">Standard Hours (09:00 AM to 07:00 PM)</option>
            <option value="morning">Morning Shift (08:00 AM to 04:00 PM)</option>
            <option value="evening">Evening Shift (12:00 PM to 09:00 PM)</option>
            <option value="fullday">Full Day Shift (08:00 AM to 08:00 PM)</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Days Table Configurator with UX Dropdowns */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="space-y-3">
          {schedule.map((item) => (
            <div
              key={item.day}
              className="p-4 rounded-xl border border-border/80 bg-muted/20 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors hover:bg-muted/40"
            >
              {/* Day Checkbox */}
              <div className="flex items-center gap-3 w-36 shrink-0">
                <input
                  type="checkbox"
                  checked={item.isWorking}
                  onChange={(e) => updateAvailabilitySchedule(item.day, { isWorking: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 border-border focus:ring-blue-600/30 cursor-pointer"
                />
                <span className={`text-xs font-bold ${item.isWorking ? "text-foreground" : "text-muted-foreground line-through"}`}>
                  {item.day}
                </span>
              </div>

              {item.isWorking ? (
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs flex-1">
                  
                  {/* Working Hours Dropdowns */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-muted-foreground text-[10px] font-bold uppercase shrink-0">Working Hours:</span>
                    
                    {/* Start Time Dropdown */}
                    <div className="relative">
                      <select
                        value={item.startTime}
                        onChange={(e) => updateAvailabilitySchedule(item.day, { startTime: e.target.value })}
                        className="px-2.5 py-1.5 pr-7 rounded-xl bg-card border border-border text-xs font-bold text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-blue-600/30 cursor-pointer"
                      >
                        {TIME_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    </div>

                    <span className="text-muted-foreground text-xs font-medium">to</span>

                    {/* End Time Dropdown */}
                    <div className="relative">
                      <select
                        value={item.endTime}
                        onChange={(e) => updateAvailabilitySchedule(item.day, { endTime: e.target.value })}
                        className="px-2.5 py-1.5 pr-7 rounded-xl bg-card border border-border text-xs font-bold text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-blue-600/30 cursor-pointer"
                      >
                        {TIME_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  {/* Break Hours Dropdowns */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-muted-foreground text-[10px] font-bold uppercase shrink-0">Break:</span>
                    
                    {/* Break Start Dropdown */}
                    <div className="relative">
                      <select
                        value={item.breakStart}
                        onChange={(e) => updateAvailabilitySchedule(item.day, { breakStart: e.target.value })}
                        className="px-2.5 py-1.5 pr-7 rounded-xl bg-card border border-border text-xs text-muted-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-blue-600/30 cursor-pointer"
                      >
                        {TIME_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    </div>

                    <span className="text-muted-foreground text-xs">-</span>

                    {/* Break End Dropdown */}
                    <div className="relative">
                      <select
                        value={item.breakEnd}
                        onChange={(e) => updateAvailabilitySchedule(item.day, { breakEnd: e.target.value })}
                        className="px-2.5 py-1.5 pr-7 rounded-xl bg-card border border-border text-xs text-muted-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-blue-600/30 cursor-pointer"
                      >
                        {TIME_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                </div>
              ) : (
                <span className="text-xs font-bold text-red-500 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                  Day Off / Closed
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-border flex justify-end">
          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            Save Weekly Schedule
          </button>
        </div>
      </div>

    </div>
  );
}
