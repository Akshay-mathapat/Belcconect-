"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, MapPin, Globe, Mail, BadgeCheck } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { panelVariants } from "../mockData";

export function BusinessProfilePanel() {
  const { t } = useTranslation();
  const [saved, setSaved] = useState(false);
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const inputCls = "block w-full px-3 py-3 border border-border rounded-xl bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm text-foreground placeholder-muted-foreground";
  const labelCls = "block text-sm font-medium text-foreground mb-2";

  return (
    <motion.div {...panelVariants}>
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border">
          <h3 className="font-semibold text-xl text-foreground">{t("jobprovider.businessProfile")}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t("jobprovider.businessProfileSubtitle")}</p>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          {/* Logo upload */}
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center text-muted-foreground hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer">
              <Upload className="h-6 w-6 mb-1" />
              <span className="text-[10px] font-medium">Logo</span>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">{t("jobprovider.companyLogo")}</p>
              <p className="text-xs text-muted-foreground mb-2">{t("jobprovider.logoRecommendation")}</p>
              <button type="button" className="px-4 py-2 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors">
                {t("jobprovider.uploadLogo")}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>{t("jobprovider.companyName")} *</label>
              <input type="text" className={inputCls} placeholder="e.g. BelTech Solutions" defaultValue="BelTech Solutions Pvt. Ltd." />
            </div>
            <div>
              <label className={labelCls}>{t("jobprovider.industry")} *</label>
              <select className={inputCls} defaultValue="services">
                <option value="">{t("jobprovider.selectIndustry")}</option>
                <option value="services">Professional Services</option>
                <option value="construction">Construction</option>
                <option value="manufacturing">Manufacturing</option>
                <option value="retail">Retail</option>
                <option value="it">IT & Technology</option>
                <option value="healthcare">Healthcare</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{t("jobprovider.cityLocation")} *</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" className={`${inputCls} pl-9`} placeholder="e.g. Belagavi, Karnataka" defaultValue="Belagavi, Karnataka" />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t("jobprovider.companySize")}</label>
              <select className={inputCls} defaultValue="11-50">
                <option value="1-10">1–10 employees</option>
                <option value="11-50">11–50 employees</option>
                <option value="51-200">51–200 employees</option>
                <option value="201+">201+ employees</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{t("jobprovider.website")}</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="url" className={`${inputCls} pl-9`} placeholder="https://yourcompany.com" />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t("jobprovider.contactEmail")} *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="email" className={`${inputCls} pl-9`} placeholder="hr@yourcompany.com" defaultValue="hr@beltech.in" />
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>{t("jobprovider.aboutCompany")}</label>
            <textarea
              rows={4}
              className={`${inputCls} resize-none`}
              placeholder="Describe your company, culture, and what makes it a great place to work..."
              defaultValue="BelTech Solutions is a leading professional services company based in Belagavi with over 5 years of experience connecting skilled professionals across North Karnataka."
            />
          </div>

          <div>
            <label className={labelCls}>{t("jobprovider.officeAddress")}</label>
            <input type="text" className={inputCls} placeholder="Full address" defaultValue="12, Tilakwadi, Belagavi – 590006" />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BadgeCheck className="h-4 w-4 text-emerald-500" />
              {t("jobprovider.profileVerified")}
            </div>
            <button
              type="submit"
              className={`px-6 py-2.5 text-sm font-semibold rounded-xl transition-all ${saved ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
            >
              {saved ? `✓ ${t("jobprovider.saved")}` : t("jobprovider.saveProfile")}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
