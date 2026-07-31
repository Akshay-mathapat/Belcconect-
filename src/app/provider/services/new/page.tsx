"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  Upload, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Wrench, 
  Clock, 
  Camera,
  Image as ImageIcon,
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
    basePrice: 0,
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

  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>([
    { question: "How is pricing finalized?", answer: "Price is discussed and agreed upon mutually between provider and customer after site review." }
  ]);

  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          thumbnail: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddFaq = () => {
    setFaqs([...faqs, { question: "", answer: "" }]);
  };

  const handleRemoveFaq = (idx: number) => {
    setFaqs(faqs.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category || !formData.subcategory || !formData.description) {
      alert("Please fill in all required fields (Name, Category, Subcategory, and Description).");
      return;
    }

    addService({
      ...formData,
      thumbnail: formData.thumbnail || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=400&q=80",
      faqs,
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
            Your service has been published and saved to local storage. Redirecting to your service list...
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
              <div className="space-y-1">
                <label className="font-bold text-foreground">Category *</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full p-3 rounded-xl bg-muted/30 border border-border focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                >
                  <option value="" disabled>Select Service Category</option>
                  {SERVICE_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                  <option value="Other Service">Other Service</option>
                </select>
              </div>

              {/* Subcategory (REQUIRED) */}
              <div className="space-y-1">
                <label className="font-bold text-foreground">Subcategory *</label>
                <input
                  type="text"
                  required
                  value={formData.subcategory}
                  onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                  placeholder="e.g. Panel Upgrade, Circuit Fix"
                  className="w-full p-3 rounded-xl bg-muted/30 border border-border focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="font-bold text-foreground">Service Description *</label>
                <textarea
                  rows={3}
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what is included in this service package..."
                  className="w-full p-3 rounded-xl bg-muted/30 border border-border focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Image Upload */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <h2 className="font-heading text-base font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
              <ImageIcon className="h-4 w-4 text-purple-600" />
              Service Cover Photo (Upload Image) *
            </h2>

            <div className="space-y-3">
              <div className="border-2 border-dashed border-border hover:border-blue-600 rounded-2xl p-6 text-center bg-muted/20 flex flex-col items-center justify-center transition-colors">
                {formData.thumbnail && (
                  <img
                    src={formData.thumbnail}
                    alt="Thumbnail Preview"
                    className="w-40 h-28 rounded-xl object-cover border border-border mb-3 shadow-md"
                  />
                )}
                
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md hover:bg-blue-700 transition-all">
                  <Camera className="h-4 w-4" />
                  <span>Choose Image File to Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
                <span className="text-[10px] text-muted-foreground mt-2">Supports PNG, JPG or WEBP image files</span>
              </div>
            </div>
          </div>

          {/* Section 3: Service Agreement (Pricing Removed) */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <h2 className="font-heading text-base font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
              <Handshake className="h-4 w-4 text-emerald-600" />
              Mutual Price Agreement & Service Area
            </h2>

            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-2">
              <p className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <span>Direct Mutual Pricing Model</span>
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Pricing is decided directly between customer and service provider based on job scope, materials required, and inspection.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
              <div className="space-y-1">
                <label className="font-bold text-foreground">Estimated Job Duration (Mins)</label>
                <input
                  type="number"
                  value={formData.durationMinutes}
                  onChange={(e) => setFormData({ ...formData, durationMinutes: Number(e.target.value) })}
                  className="w-full p-3 rounded-xl bg-muted/30 border border-border focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">Service Radius (km)</label>
                <input
                  type="number"
                  value={formData.serviceRadiusKm}
                  onChange={(e) => setFormData({ ...formData, serviceRadiusKm: Number(e.target.value) })}
                  className="w-full p-3 rounded-xl bg-muted/30 border border-border focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 4: FAQs */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-heading text-base font-bold text-foreground">Frequently Asked Questions</h2>
              <button
                type="button"
                onClick={handleAddFaq}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add FAQ
              </button>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-2 relative">
                  <button
                    type="button"
                    onClick={() => handleRemoveFaq(idx)}
                    className="absolute top-3 right-3 text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="text"
                    placeholder="Question"
                    value={faq.question}
                    onChange={(e) => {
                      const updated = [...faqs];
                      updated[idx].question = e.target.value;
                      setFaqs(updated);
                    }}
                    className="w-full p-2 text-xs rounded-lg bg-card border border-border focus:outline-none font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Answer"
                    value={faq.answer}
                    onChange={(e) => {
                      const updated = [...faqs];
                      updated[idx].answer = e.target.value;
                      setFaqs(updated);
                    }}
                    className="w-full p-2 text-xs rounded-lg bg-card border border-border focus:outline-none"
                  />
                </div>
              ))}
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
