"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  MapPin,
  DollarSign,
  Clock,
  Rocket,
  CheckCircle2,
  PlusCircle,
  Tag,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { panelVariants } from "../mockData";

export function PostJobPanel() {
  const { t } = useTranslation();
  const router = useRouter();
  const [posted, setPosted] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [selectedJobType, setSelectedJobType] = useState("");
  const [customJobType, setCustomJobType] = useState("");

  const inputCls = "block w-full px-3 py-3 border border-border rounded-xl bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm text-foreground placeholder-muted-foreground";
  const labelCls = "block text-sm font-medium text-foreground mb-2";

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    setPosted(true);
    setTimeout(() => { setPosted(false); router.push("/jobprovider/jobs"); }, 1500);
  };

  return (
    <motion.div {...panelVariants}>
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border">
          <h3 className="font-semibold text-xl text-foreground">{t("jobprovider.postNewJob")}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t("jobprovider.postJobSubtitle")}</p>
        </div>

        <form onSubmit={handlePost} className="p-6 space-y-6">
          <div>
            <label className={labelCls}>{t("jobprovider.jobTitle")} *</label>
            <input type="text" required className={inputCls} placeholder="e.g. Senior Electrician, Plumbing Technician…" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Job Type Dropdown */}
            <div>
              <label className={labelCls}>{t("jobprovider.jobType")} *</label>
              <select
                required
                className={inputCls}
                value={selectedJobType}
                onChange={(e) => setSelectedJobType(e.target.value)}
              >
                <option value="" disabled>Select type</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Freelance">Freelance</option>
                <option value="Internship">Internship</option>
                <option value="Other">Other</option>
              </select>

              {/* Custom Job Type Input when 'Other' is selected */}
              <AnimatePresence>
                {selectedJobType === "Other" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2.5"
                  >
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        required
                        value={customJobType}
                        onChange={(e) => setCustomJobType(e.target.value)}
                        className={`${inputCls} pl-9`}
                        placeholder="Type custom job type..."
                        autoFocus
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Category Dropdown */}
            <div>
              <label className={labelCls}>{t("jobprovider.category")} *</label>
              <select
                required
                className={inputCls}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="" disabled>Select category</option>
                <option value="Electrical">Electrical</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Cleaning">Cleaning</option>
                <option value="HVAC / AC">HVAC / AC</option>
                <option value="Carpentry">Carpentry</option>
                <option value="Painting">Painting</option>
                <option value="Salon">Salon</option>
                <option value="Security">Security</option>
                <option value="Delivery">Delivery</option>
                <option value="Other">Other</option>
              </select>

              {/* Custom Category Typing Input when 'Other' is selected */}
              <AnimatePresence>
                {selectedCategory === "Other" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2.5"
                  >
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                      <input
                        type="text"
                        required
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className={`${inputCls} pl-9 border-primary/50 bg-primary/5`}
                        placeholder="Type custom category name..."
                        autoFocus
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Work Mode */}
            <div>
              <label className={labelCls}>{t("jobprovider.workMode")}</label>
              <select className={inputCls} defaultValue="on-site">
                <option value="on-site">{t("jobprovider.onSite")}</option>
                <option value="remote">{t("jobprovider.remote")}</option>
                <option value="hybrid">{t("jobprovider.hybrid")}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>{t("jobprovider.cityLocation")} *</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" required className={`${inputCls} pl-9`} placeholder="e.g. Belagavi" />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t("jobprovider.salaryCompensation")}</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" className={`${inputCls} pl-9`} placeholder="e.g. ₹20,000–30,000/mo" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>{t("jobprovider.openings")}</label>
              <input type="number" min={1} className={inputCls} defaultValue={1} />
            </div>
            <div>
              <label className={labelCls}>{t("jobprovider.applicationDeadline")} *</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="date" required className={`${inputCls} pl-9`} />
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>{t("jobprovider.jobDescription")} *</label>
            <textarea required rows={5} className={`${inputCls} resize-none`} placeholder="Describe the role, day-to-day responsibilities, what success looks like…" />
          </div>

          <div>
            <label className={labelCls}>{t("jobprovider.requirementsSkills")}</label>
            <textarea rows={3} className={`${inputCls} resize-none`} placeholder="• Minimum 3 years experience&#10;• ITI / Diploma preferred&#10;• Must own basic tools" />
          </div>

          <div>
            <label className={labelCls}>{t("jobprovider.perksBenefits")}</label>
            <input type="text" className={inputCls} placeholder="e.g. PF, ESI, Uniform, Weekly off, Overtime pay…" />
          </div>

          {/* Boost option */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-4">
            <Rocket className="h-7 w-7 text-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{t("jobprovider.boostListing")}</p>
              <p className="text-xs text-muted-foreground">{t("jobprovider.boostDesc")}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-10 h-5 bg-muted peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:bg-primary transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
            </label>
          </div>

          <div className="flex gap-3 pt-2 border-t border-border">
            <button type="button" onClick={() => router.push("/jobprovider/jobs")} className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors">
              {t("jobprovider.saveDraft")}
            </button>
            <button
              type="submit"
              className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${posted ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
            >
              {posted ? <><CheckCircle2 className="h-4 w-4" /> {t("jobprovider.jobPublished")}</> : <><PlusCircle className="h-4 w-4" /> {t("jobprovider.publishJob")}</>}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
