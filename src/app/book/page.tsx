"use client";

import Navigation from "@/components/sections/Navigation";
import Footer from "@/components/sections/Footer";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { useAuthStore } from "@/store/useAuthStore";

function BookingFlow() {
  const { currentUser } = useAuthStore();
  const searchParams = useSearchParams();
  const service = searchParams.get("service") || "Service";
  const proId = searchParams.get("pro");
  const priceParam = searchParams.get("price");

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [address, setAddress] = useState("home");
  const [newAddressText, setNewAddressText] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [payment, setPayment] = useState("online");

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const getProviderName = (id: string | null) => {
    const proNameParam = searchParams.get("proName");
    if (proNameParam) return decodeURIComponent(proNameParam);
    switch (id) {
      case "1": return "Ramesh Sharma";
      case "2": return "Suresh Kumar";
      case "3": return "Anil Desai";
      case "4": return "Priya Patil";
      default: return "Rohan Electrician";
    }
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const customerId = currentUser?.id || "customer-1";
      const customerName = currentUser?.name || "Akshay Mathapati";
      const customerPhone = currentUser?.phone || "+91 98765 43210";
      const customerPhoto = currentUser?.avatar || "";

      // For mock providers, fallback to provider-1 Rohan. Otherwise use custom provider ID.
      const resolvedProviderId = proId && proId !== "1" && proId !== "2" && proId !== "3" && proId !== "4" 
        ? proId 
        : "provider-1";

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
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
          time: time || "10:00 AM",
          address: address === "home" ? "123 Main St, Tilakwadi, Belagavi, 590006" : (newAddressText || "New Address"),
          price: priceParam ? Number(priceParam) : 299.00
        })
      });

      if (!res.ok) {
        throw new Error("Failed to create booking");
      }

      setIsSubmitting(false);
      setStep(6);
    } catch (e) {
      console.error("Booking submission error:", e);
      alert("Booking failed. Please check your server and database connection.");
      setIsSubmitting(false);
    }
  };


  return (
    <div className="flex-1 flex items-center justify-center pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="rounded-[2rem] border border-border bg-card p-8 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/50 to-primary" />
          
          {step < 6 && (
            <div className="flex justify-between items-center mb-8">
              {step > 1 ? (
                <button onClick={prevStep} className="text-sm font-medium text-muted-foreground hover:text-foreground">Back</button>
              ) : <div></div>}
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Step {step} of 5</span>
              <div></div>
            </div>
          )}

          {step === 1 && (
            <>
              <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground mb-6">Service Details</h1>
              <div className="space-y-4 mb-8">
                <div className="rounded-xl bg-muted/50 p-4 border border-border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Service</span>
                    <span className="text-sm font-semibold text-foreground capitalize">{service}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-muted-foreground">Professional ID</span>
                    <span className="text-sm font-semibold text-foreground">{proId || "Auto-assign"}</span>
                  </div>
                </div>
              </div>
              <button onClick={nextStep} className="w-full py-3.5 rounded-xl shadow-sm text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-all">Continue</button>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground mb-6">Service Address</h1>
              <div className="space-y-3 mb-8">
                <label className={`block border rounded-xl p-4 cursor-pointer transition-all ${address === "home" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block font-semibold text-foreground mb-1">Home</span>
                      <span className="text-sm text-muted-foreground">123 Main St, Tilakwadi, Belagavi</span>
                    </div>
                    <input type="radio" name="address" checked={address === "home"} onChange={() => setAddress("home")} className="text-primary focus:ring-primary" />
                  </div>
                </label>
                <label className={`block border rounded-xl p-4 cursor-pointer transition-all ${address === "new" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block font-semibold text-foreground mb-1">Add New Address</span>
                      <span className="text-sm text-muted-foreground">Enter a different location</span>
                    </div>
                    <input type="radio" name="address" checked={address === "new"} onChange={() => setAddress("new")} className="text-primary focus:ring-primary" />
                  </div>
                </label>
                {address === "new" && (
                  <input type="text" value={newAddressText} onChange={(e) => setNewAddressText(e.target.value)} placeholder="Full Address" className="w-full mt-3 px-4 py-3 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary focus:border-transparent text-sm" />
                )}
              </div>
              <button onClick={nextStep} className="w-full py-3.5 rounded-xl shadow-sm text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-all">Continue</button>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground mb-6">Date</h1>
              <div className="space-y-5 mb-8">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Select Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-3 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary focus:border-transparent text-sm" />
                </div>
              </div>
              <button onClick={nextStep} disabled={!date} className="w-full py-3.5 rounded-xl shadow-sm text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-all disabled:opacity-50">Continue</button>
            </>
          )}

          {step === 4 && (
            <>
              <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground mb-6">Order Summary</h1>
              <div className="space-y-4 mb-8">
                <div className="rounded-xl bg-muted/50 p-5 border border-border space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Service</span>
                    <span className="text-sm font-semibold text-foreground capitalize">{service}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Date</span>
                    <span className="text-sm font-semibold text-foreground">{date}</span>
                  </div>
                </div>
              </div>
              <button onClick={nextStep} className="w-full py-3.5 rounded-xl shadow-sm text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-all">Proceed to Booking</button>
            </>
          )}

          {step === 5 && (
            <>
              <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground mb-6">Payment Method</h1>
              <div className="space-y-3 mb-8">
                <label className={`block border rounded-xl p-4 cursor-pointer transition-all ${payment === "online" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block font-semibold text-foreground mb-1">Pay Online</span>
                      <span className="text-sm text-muted-foreground">UPI, Credit/Debit Card</span>
                    </div>
                    <input type="radio" name="payment" checked={payment === "online"} onChange={() => setPayment("online")} className="text-primary focus:ring-primary" />
                  </div>
                </label>
                <label className={`block border rounded-xl p-4 cursor-pointer transition-all ${payment === "cash" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block font-semibold text-foreground mb-1">Pay After Service</span>
                      <span className="text-sm text-muted-foreground">Cash on completion</span>
                    </div>
                    <input type="radio" name="payment" checked={payment === "cash"} onChange={() => setPayment("cash")} className="text-primary focus:ring-primary" />
                  </div>
                </label>
              </div>
              <button onClick={handleConfirm} disabled={isSubmitting} className="w-full flex justify-center py-3.5 rounded-xl shadow-sm text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-all">
                {isSubmitting ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  "Confirm Booking"
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
              <h2 className="text-2xl font-bold text-foreground mb-2">Booking Confirmed!</h2>
              <p className="text-muted-foreground mb-8">Your professional has been assigned and is on the way.</p>
              
              <Link 
                href="/account"
                className="inline-flex justify-center items-center py-3 px-6 rounded-xl border border-border bg-card text-foreground hover:bg-muted font-semibold transition-colors w-full"
              >
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
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
      <Navigation />
      <Suspense fallback={<div className="flex-1 flex items-center justify-center pt-24"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
        <BookingFlow />
      </Suspense>
      <Footer />
    </main>
  );
}
