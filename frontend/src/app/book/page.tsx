"use client";

import Footer from "@/components/sections/Footer";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ArrowRight, MapPin, Plus, Navigation, AlertCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { useAuthStore } from "@/store/useAuthStore";

import TimeSlotPicker from "@/components/booking/TimeSlotPicker";
import LocationPicker, { ConfirmedLocationData } from "@/components/location/LocationPicker";
import { useTranslation } from "@/lib/i18n";

function BookingFlow() {
  const router = useRouter();
  const { currentUser, addAddress } = useAuthStore();
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const service = searchParams.get("service") || "Service";
  const proId = searchParams.get("pro");

  const savedAddresses = currentUser?.addresses || [];

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-redirect to Customer Dashboard (/account) upon booking confirmation
  useEffect(() => {
    if (step === 6) {
      const timer = setTimeout(() => {
        router.push("/account");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [step, router]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>(() => {
    return savedAddresses.length > 0 ? savedAddresses[0].id : "new";
  });
  
  const [showLocationPickerModal, setShowLocationPickerModal] = useState(false);
  const [newLocationData, setNewLocationData] = useState<ConfirmedLocationData | null>(null);
  const [legacyAddressText, setLegacyAddressText] = useState("");
  
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [payment, setPayment] = useState("online");

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const getProviderName = (id: string | null) => {
    const proNameParam = searchParams.get("proName");
    if (proNameParam) return decodeURIComponent(proNameParam);
    return "Service Professional";
  };

  const handleLocationConfirmedFromPicker = async (location: ConfirmedLocationData) => {
    try {
      const created = await addAddress({
        type: location.type,
        text: location.text,
        latitude: location.latitude,
        longitude: location.longitude,
        placeId: location.placeId,
        locationAccuracy: location.locationAccuracy,
        houseNumber: location.houseNumber,
        buildingName: location.buildingName,
        floor: location.floor,
        landmark: location.landmark,
        locality: location.locality,
        city: location.city,
        state: location.state,
        pincode: location.pincode,
        deliveryInstructions: location.deliveryInstructions
      });

      if (created) {
        setSelectedAddressId(created.id);
        setNewLocationData(location);
      } else {
        setNewLocationData(location);
        setSelectedAddressId("custom_pinned");
      }
      setShowLocationPickerModal(false);
    } catch (e) {
      console.error("Error saving location:", e);
      setNewLocationData(location);
      setSelectedAddressId("custom_pinned");
      setShowLocationPickerModal(false);
    }
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const customerId = currentUser?.id;
      const customerName = currentUser?.name;
      const customerPhone = currentUser?.phone;
      const customerPhoto = currentUser?.avatar || "";
      const resolvedProviderId = proId;

      if (!customerId) {
        const currentPath = `/book?${searchParams.toString()}`;
        router.push(`/auth?mode=login&returnTo=${encodeURIComponent(currentPath)}`);
        setIsSubmitting(false);
        return;
      }

      if (!resolvedProviderId) {
        alert(t("booking.providerRequired"));
        setIsSubmitting(false);
        return;
      }

      let finalServiceAddressId: string | null = null;
      let finalDestLat: number | null = null;
      let finalDestLng: number | null = null;
      let finalDestPlaceId: string | null = null;
      let finalDestAddress: string = t("booking.noAddressProvided");
      let finalDestLandmark: string | null = null;
      let finalDestInstructions: string | null = null;

      if (selectedAddressId === "custom_pinned" && newLocationData) {
        finalDestLat = newLocationData.latitude;
        finalDestLng = newLocationData.longitude;
        finalDestPlaceId = newLocationData.placeId || null;
        finalDestAddress = newLocationData.text;
        finalDestLandmark = newLocationData.landmark || null;
        finalDestInstructions = newLocationData.deliveryInstructions || null;
      } else if (selectedAddressId === "new") {
        finalDestAddress = legacyAddressText || t("booking.newAddress");
      } else {
        const found = savedAddresses.find(a => a.id === selectedAddressId);
        if (found) {
          finalServiceAddressId = found.id;
          finalDestLat = found.latitude ?? null;
          finalDestLng = found.longitude ?? null;
          finalDestPlaceId = found.placeId ?? null;
          finalDestAddress = found.text;
          finalDestLandmark = found.landmark ?? null;
          finalDestInstructions = found.deliveryInstructions ?? null;
        } else {
          finalDestAddress = legacyAddressText || t("booking.newAddress");
        }
      }

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          providerId: resolvedProviderId,
          providerName: getProviderName(proId),
          serviceName: service,
          category: service.toLowerCase(),
          customerName,
          customerPhone,
          customerPhoto,
          date,
          time: time || t("booking.defaultTimeRange"),
          address: finalDestAddress,
          serviceAddressId: finalServiceAddressId,
          destinationLatitude: finalDestLat,
          destinationLongitude: finalDestLng,
          destinationPlaceId: finalDestPlaceId,
          destinationAddress: finalDestAddress,
          destinationLandmark: finalDestLandmark,
          destinationInstructions: finalDestInstructions
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || t("booking.createBookingError"));
      }

      try {
        const syncChannel = new BroadcastChannel("cityconnect-bookings-sync");
        syncChannel.postMessage({ type: "REFRESH_BOOKINGS" });
        syncChannel.close();
      } catch (e) {}

      setIsSubmitting(false);
      setStep(6);
    } catch (e: any) {
      console.error("Booking submission error:", e);
      alert(e?.message || t("booking.bookingFailed"));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center pt-8 pb-12 px-4 sm:px-6 lg:px-8">
      {/* Location Picker Modal */}
      <AnimatePresence>
        {showLocationPickerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-location-modal-open="true"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          >
            <div className="w-full max-w-2xl my-auto">
              <LocationPicker
                onConfirm={handleLocationConfirmedFromPicker}
                onCancel={() => setShowLocationPickerModal(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        key={step}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        data-booking-step={step}
        className="w-full max-w-[640px]"
      >
        <div className="rounded-[2rem] border border-border bg-card p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/50 to-primary" />
          
          {step < 6 && (
            <div className="flex justify-between items-center mb-6">
              {step > 1 ? (
                <button onClick={prevStep} className="text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer">{t("booking.back")}</button>
              ) : <div></div>}
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t("booking.stepOf")} {step} {t("booking.ofFive")}</span>
              <div></div>
            </div>
          )}

          {step === 1 && (
            <>
              <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground mb-6">{t("booking.serviceDetails")}</h1>
              <div className="space-y-4 mb-8">
                <div className="rounded-xl bg-muted/50 p-4 border border-border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-muted-foreground">{t("booking.service")}</span>
                    <span className="text-sm font-semibold text-foreground capitalize" suppressHydrationWarning>{service}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-muted-foreground">{t("booking.professionalId")}</span>
                    <span className="text-sm font-semibold text-foreground" suppressHydrationWarning>{proId || t("booking.autoAssign")}</span>
                  </div>
                </div>
              </div>
              <button onClick={nextStep} className="w-full py-3.5 rounded-xl shadow-sm text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-all cursor-pointer">{t("booking.continue")}</button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground">{t("booking.serviceAddress")}</h1>
                  <p className="text-xs text-muted-foreground">{t("booking.selectLocation")}</p>
                </div>
                <button
                  type="button"
                  data-tour="pin-map-location"
                  onClick={() => setShowLocationPickerModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Navigation className="w-4 h-4" />
                  <span>{t("booking.pinMapLocation")}</span>
                </button>
              </div>

              <div className="space-y-3 mb-8">
                {savedAddresses.map((addr) => {
                  const isPinned = typeof addr.latitude === "number" && typeof addr.longitude === "number";
                  const isSelected = selectedAddressId === addr.id;
                  return (
                    <label 
                      key={addr.id} 
                      className={`block border rounded-2xl p-4 cursor-pointer transition-all ${isSelected ? "border-blue-600 bg-blue-600/5 ring-1 ring-blue-600" : "border-border hover:border-blue-600/40"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground capitalize">{addr.type}</span>
                            {isPinned ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                                <Navigation className="w-3 h-3" /> Pinned Location
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                                <AlertCircle className="w-3 h-3" /> Text Address
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground block leading-relaxed">{addr.text}</span>
                          {addr.landmark && (
                            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium block">{t("booking.landmark")}: {addr.landmark}</span>
                          )}
                        </div>
                        <input 
                          type="radio" 
                          name="address" 
                          checked={isSelected} 
                          onChange={() => setSelectedAddressId(addr.id)} 
                          className="mt-1 text-blue-600 focus:ring-blue-600" 
                        />
                      </div>
                    </label>
                  );
                })}

                {/* Custom Pinned Location option if selected via picker */}
                {newLocationData && selectedAddressId === "custom_pinned" && (
                  <label className="block border border-blue-600 bg-blue-600/10 rounded-2xl p-4 cursor-pointer ring-1 ring-blue-600">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground capitalize">{newLocationData.type} (Newly Pinned)</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold">
                            <Navigation className="w-3 h-3" /> Pinned Coordinates
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground block">{newLocationData.text}</span>
                      </div>
                      <input type="radio" name="address" checked={true} readOnly className="mt-1 text-blue-600" />
                    </div>
                  </label>
                )}

                {/* Manual Text Address Option */}
                <label data-tour="manual-address" className={`block border rounded-2xl p-4 cursor-pointer transition-all ${selectedAddressId === "new" ? "border-blue-600 bg-blue-600/5" : "border-border hover:border-blue-600/40"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block font-semibold text-xs text-foreground mb-0.5">{t("booking.manualAddressPlaceholder")}</span>
                      <span className="text-[11px] text-muted-foreground">{t("booking.manualAddressHint")}</span>
                    </div>
                    <input type="radio" name="address" checked={selectedAddressId === "new"} onChange={() => setSelectedAddressId("new")} className="text-blue-600 focus:ring-blue-600" />
                  </div>
                </label>

                {selectedAddressId === "new" && (
                  <textarea
                    rows={2}
                    value={legacyAddressText}
                    onChange={(e) => setLegacyAddressText(e.target.value)}
                    placeholder={t("booking.manualAddressPlaceholder")}
                    className="w-full mt-2 p-3 border border-border rounded-xl bg-background focus:ring-2 focus:ring-blue-600 text-xs text-foreground outline-none cursor-text"
                  />
                )}
              </div>
              
              <button 
                onClick={nextStep} 
                disabled={selectedAddressId === "new" && !legacyAddressText.trim()}
                className="w-full py-3.5 rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-50 cursor-pointer"
              >
                {t("booking.continue")}
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground mb-4">{t("booking.dateTimeSlot")}</h1>
              <div className="mb-6">
                <TimeSlotPicker
                  selectedDate={date}
                  onDateChange={(d) => setDate(d)}
                  selectedTime={time}
                  onTimeChange={(t) => setTime(t)}
                  providerId={proId}
                />
              </div>
              <button onClick={nextStep} disabled={!date || !time} className="w-full py-3.5 rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-50 cursor-pointer">{t("booking.continue")}</button>
            </>
          )}

          {step === 4 && (
            <>
              <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground mb-6">{t("booking.orderSummary")}</h1>
              <div className="space-y-4 mb-8">
                <div className="rounded-xl bg-muted/50 p-5 border border-border space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t("booking.service")}</span>
                    <span className="text-sm font-semibold text-foreground capitalize">{service}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t("booking.dateLabel")}</span>
                    <span className="text-sm font-semibold text-foreground">{date}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t("booking.timeSlot")}</span>
                    <span className="text-sm font-semibold text-foreground">{time || t("booking.defaultTimeRange")}</span>
                  </div>
                </div>
              </div>
              <button onClick={nextStep} className="w-full py-3.5 rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all cursor-pointer">{t("booking.proceedToBooking")}</button>
            </>
          )}

          {step === 5 && (
            <>
              <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground mb-6">{t("booking.paymentMethod")}</h1>
              <div className="space-y-3 mb-8">
                <label className={`block border rounded-xl p-4 cursor-pointer transition-all ${payment === "online" ? "border-blue-600 bg-blue-600/5" : "border-border hover:border-blue-600/50"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block font-semibold text-foreground mb-1">{t("booking.payOnline")}</span>
                      <span className="text-sm text-muted-foreground">{t("booking.payOnlineDetails")}</span>
                    </div>
                    <input type="radio" name="payment" checked={payment === "online"} onChange={() => setPayment("online")} className="text-blue-600 focus:ring-blue-600" />
                  </div>
                </label>
                <label className={`block border rounded-xl p-4 cursor-pointer transition-all ${payment === "cash" ? "border-blue-600 bg-blue-600/5" : "border-border hover:border-blue-600/50"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block font-semibold text-foreground mb-1">{t("booking.payAfterService")}</span>
                      <span className="text-sm text-muted-foreground">{t("booking.payAfterServiceDetails")}</span>
                    </div>
                    <input type="radio" name="payment" checked={payment === "cash"} onChange={() => setPayment("cash")} className="text-blue-600 focus:ring-blue-600" />
                  </div>
                </label>
              </div>
              <button onClick={handleConfirm} disabled={isSubmitting} className="w-full flex justify-center py-3.5 rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all cursor-pointer">
                {isSubmitting ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  t("booking.confirmBooking")
                )}
              </button>
            </>
          )}

          {step === 6 && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-6"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">{t("booking.bookingConfirmed")}</h2>
              <p className="text-muted-foreground mb-4">{t("booking.professionalAssigned")}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-6 flex items-center justify-center gap-1.5 animate-pulse">
                <span>{t("booking.redirecting")}</span>
              </p>
              
              <button 
                type="button"
                onClick={() => router.push("/account")}
                className="inline-flex justify-center items-center py-3 px-6 rounded-xl border border-border bg-card text-foreground hover:bg-muted font-semibold transition-colors w-full cursor-pointer"
              >
                {t("booking.goToDashboard")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function BookPage() {
  return (
    <main className="min-h-screen bg-muted/10 text-foreground flex flex-col">
      <Suspense fallback={<div className="flex-1 flex items-center justify-center pt-8"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>}>
        <BookingFlow />
      </Suspense>
      <Footer />
    </main>
  );
}
