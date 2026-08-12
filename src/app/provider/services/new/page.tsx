"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  CheckCircle2, 
  Wrench, 
  Handshake
} from "lucide-react";
import { useProviderStore } from "@/store/useProviderStore";
import { SERVICE_CATEGORIES } from "@/constants/site";

export default function NewServicePage() {
  const router = useRouter();
  const { addService } = useProviderStore();

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    subcategory: "",
    description: "",
    discountPercentage: 0,
    durationMinutes: 60,
    experienceYears: 1,
    isAvailable: true,
    serviceArea: "Belagavi City",
    serviceRadiusKm: 15,
    travelCharges: 0,
    emergencyService: false,
    thumbnail: "",
    galleryImages: [] as string[],
    terms: "Mutual agreement on scope and requirements prior to start.",
    status: "Active" as const
  });

  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category) {
      alert("Please fill in all required fields (Name and Category).");
      return;
    }

    await addService({
      ...formData,
      thumbnail: formData.thumbnail || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=400&q=80",
      faqs: [], // pass empty FAQs array since FAQs section is removed
    });

    setIsSubmitted(true);
    setTimeout(() => {
      router.push("/provider/services");
    }, 1500);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/provider/services"
          className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Services</span>
        </Link>
        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Creating New Service</span>
      </div>

      {isSubmitted ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-12 text-center space-y-4"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Service Published Successfully!</h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Your service has been published and saved. Redirecting to your service list...
          </p>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section 1: Basic Info */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <h2 className="font-heading text-base font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
              <Wrench className="h-4 w-4 text-blue-600" />
              Basic Service Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2 space-y-1">
                <label className="font-bold text-foreground">Service Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Electrical Safety Inspection & Wiring"
                  className="w-full p-3 rounded-xl bg-muted/30 border border-border focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </div>

              {/* Category (REQUIRED) */}
              <div className="sm:col-span-2 space-y-1">
                <label className="font-bold text-foreground">Category *</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full p-3 rounded-xl bg-muted/30 border border-border focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                >
                  <option value="" disabled>Select Service Category</option>
                  {SERVICE_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                  <option value="Other Service">Other Service</option>
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="font-bold text-foreground">Service Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what is included in this service package..."
                  className="w-full p-3 rounded-xl bg-muted/30 border border-border focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Service Agreement */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <h2 className="font-heading text-base font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
              <Handshake className="h-4 w-4 text-emerald-600" />
              Mutual Price Agreement
            </h2>

            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-2">
              <p className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <span>Direct Mutual Pricing Model</span>
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Pricing is decided directly between customer and service provider based on job scope, materials required, and inspection.
              </p>
            </div>
          </div>

          {/* Submit Action Bar */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Link
              href="/provider/services"
              className="px-5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all"
            >
              Publish Service
            </button>
          </div>

        </form>
      )}

    </div>
  );
}
