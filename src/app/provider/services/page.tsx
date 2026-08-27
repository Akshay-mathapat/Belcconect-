"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  PlusCircle, 
  Search, 
  Wrench, 
  Star, 
  Clock, 
  MapPin, 
  Tag, 
  Trash2, 
  Edit3, 
  Copy, 
  Eye, 
  Power,
  Zap,
  CheckCircle2,
  X,
  Handshake,
  Award
} from "lucide-react";
import { useProviderStore } from "@/store/useProviderStore";
import { SERVICE_CATEGORIES } from "@/constants/site";
import { useTranslation } from "@/lib/i18n";

export default function ServicesManagementPage() {
  const { services, toggleServiceAvailability, deleteService, addService, fetchProviderServices } = useProviderStore();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPreviewService, setSelectedPreviewService] = useState<any | null>(null);

  useEffect(() => {
    fetchProviderServices();
  }, [fetchProviderServices]);

  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDuplicate = (serviceId: string) => {
    const s = services.find((x) => x.id === serviceId);
    if (s) {
      addService({
        ...s,
        name: `${s.name} (Copy)`
      });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {t("serviceProvider.myOfferedServices")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {t("serviceProvider.myOfferedServicesDesc")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("serviceProvider.searchPlaceholder")}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-card border border-border focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map((s, idx) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className={`rounded-2xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
              s.isAvailable ? "border-border" : "border-border/60 opacity-75"
            }`}
          >
            <div>
              {/* Header Badge & Toggle Row */}
              <div className="p-5 pb-0 flex items-center justify-between gap-3">
                {/* Category Badge */}
                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                  {SERVICE_CATEGORIES.find(c => c.id === s.category)?.name || s.category}
                </span>

                {/* Status Toggle */}
                <button
                  onClick={() => toggleServiceAvailability(s.id)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1.5 transition-all ${
                    s.isAvailable 
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" 
                      : "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  <Power className="h-3 w-3" />
                  <span>{s.isAvailable ? t("serviceProvider.active") : t("serviceProvider.disabled")}</span>
                </button>
              </div>

              {/* Service Info Content */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1F5F5B] flex items-center gap-1">
                    <Star className={`h-3.5 w-3.5 text-[#D4A017] ${s.rating > 0 ? "fill-[#D4A017]" : ""}`} />
                    <span>{s.rating > 0 ? s.rating : t("serviceProvider.noRatings")} ({s.bookingsCount} {t("serviceProvider.bookingsCountLabel")})</span>
                  </span>
                </div>

                <h3 className="font-heading text-base font-bold text-foreground line-clamp-1">
                  {s.name}
                </h3>

                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {s.description}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">{t("serviceProvider.pricing")}</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1">
                      {t("serviceProvider.mutuallyAgreed")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Toolbar */}
            <div className="p-3 bg-muted/30 border-t border-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDuplicate(s.id)}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title={t("serviceProvider.duplicateService")}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deleteService(s.id)}
                  className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-colors"
                  title={t("serviceProvider.deleteService")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPreviewService(s)}
                  className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>{t("serviceProvider.preview")}</span>
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Service Preview Modal Dialog */}
      <AnimatePresence>
        {selectedPreviewService && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-heading text-sm font-bold text-foreground">{t("serviceProvider.servicePreview")}</h3>
                    <span className="text-[9px] font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-full capitalize border border-blue-500/20">
                      {SERVICE_CATEGORIES.find(c => c.id === selectedPreviewService.category)?.name || selectedPreviewService.category}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPreviewService(null)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Service details content */}
              <div className="space-y-3.5 text-xs">
                
                {/* Title and stats */}
                <div className="space-y-1">
                  <h4 className="font-heading text-base font-bold text-foreground leading-tight">
                    {selectedPreviewService.name}
                  </h4>
                  
                  <div className="flex items-center gap-2 font-medium">
                    <span className="text-[#1F5F5B] flex items-center gap-1 text-[11px]">
                      <Star className="h-3 w-3 fill-[#D4A017] text-[#D4A017]" />
                      <span>{selectedPreviewService.rating > 0 ? selectedPreviewService.rating : t("serviceProvider.noRatings")} ({selectedPreviewService.bookingsCount} {t("serviceProvider.bookingsCountLabel")})</span>
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground font-bold">{t("serviceProvider.serviceStatus")}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide border ${
                    selectedPreviewService.isAvailable 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                      : "bg-muted border-border text-muted-foreground"
                  }`}>
                    {selectedPreviewService.isAvailable ? t("serviceProvider.activeAndVisible") : t("serviceProvider.disabledOffline")}
                  </span>
                </div>

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Description */}
                <div className="space-y-1">
                  <h5 className="font-bold text-foreground uppercase tracking-wider text-[9px] text-muted-foreground">
                    {t("serviceProvider.serviceDescription")}
                  </h5>
                  <p className="text-foreground leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-border/50 text-[11px] font-medium max-h-[80px] overflow-y-auto whitespace-pre-line scrollbar-thin">
                    {selectedPreviewService.description || "No description provided for this service offering."}
                  </p>
                </div>

                {/* Pricing block */}
                <div className="space-y-1">
                  <h5 className="font-bold text-foreground uppercase tracking-wider text-[9px] text-muted-foreground">
                    {t("serviceProvider.pricingModel")}
                  </h5>
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex gap-2.5">
                    <Handshake className="h-4.5 w-4.5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-blue-600 dark:text-blue-400 text-[11px]">{t("serviceProvider.directMutualPricingModel")}</p>
                      <p className="text-muted-foreground text-[10px] leading-relaxed mt-0.5 font-medium">
                        {t("serviceProvider.directMutualPricingModalDesc")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Service Agreement terms */}
                {selectedPreviewService.terms && (
                  <div className="space-y-1">
                    <h5 className="font-bold text-foreground uppercase tracking-wider text-[9px] text-muted-foreground">
                      {t("serviceProvider.serviceAgreementTerms")}
                    </h5>
                    <p className="text-muted-foreground text-[10px] font-medium leading-normal line-clamp-2">
                      {selectedPreviewService.terms}
                    </p>
                  </div>
                )}

              </div>

              {/* Close action */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedPreviewService(null)}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  {t("serviceProvider.closePreview")}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
