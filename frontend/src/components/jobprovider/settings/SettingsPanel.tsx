"use client";

import { motion } from "framer-motion";
import { Sun, Moon, Laptop } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useTranslation } from "@/lib/i18n";
import { panelVariants } from "../mockData";

export function SettingsPanel() {
  const { theme, setTheme, mounted } = useTheme();
  const { t } = useTranslation();
  const inputCls = "block w-full px-3 py-3 border border-border rounded-xl bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm text-foreground placeholder-muted-foreground";
  const labelCls = "block text-sm font-medium text-foreground mb-2";

  const themeOptions = [
    { id: "light" as const, label: t("jobprovider.lightMode"), subtitle: t("jobprovider.highContrast"), icon: Sun, color: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
    { id: "dark" as const, label: t("jobprovider.darkMode"), subtitle: t("jobprovider.sleekLowLight"), icon: Moon, color: "text-blue-500 bg-blue-500/10 border-blue-500/30" },
    { id: "system" as const, label: t("jobprovider.systemMode"), subtitle: t("jobprovider.syncsOS"), icon: Laptop, color: "text-purple-500 bg-purple-500/10 border-purple-500/30" }
  ];

  const currentTheme = mounted ? theme : "system";

  return (
    <motion.div {...panelVariants} className="space-y-4">
      <div>
        <h3 className="font-semibold text-xl text-foreground">{t("jobprovider.accountSettings")}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t("jobprovider.manageAccount")}</p>
      </div>

      {[
        {
          title: t("jobprovider.themeSelection"),
          content: (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = currentTheme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTheme(opt.id)}
                    className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20"
                        : "border-border bg-muted/20 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`p-2 rounded-xl border ${opt.color}`}>
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                          ✓
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-bold text-foreground text-sm">{opt.label}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ),
        },
        {
          title: t("jobprovider.notifications"),
          content: (
            <div className="space-y-3">
              {["New application received", "Applicant sends a message", "Job listing expiring soon", "Promotional emails"].map(item => (
                <label key={item} className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-foreground">{item}</span>
                  <div className="relative">
                    <input type="checkbox" className="sr-only peer" defaultChecked={!item.includes("Promotional")} />
                    <div className="w-10 h-5 bg-muted peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:bg-primary transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                  </div>
                </label>
              ))}
            </div>
          ),
        },
        {
          title: t("jobprovider.changePassword"),
          content: (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Current Password</label>
                <input type="password" className={inputCls} placeholder="••••••••" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>New Password</label>
                  <input type="password" className={inputCls} placeholder="••••••••" />
                </div>
                <div>
                  <label className={labelCls}>Confirm New Password</label>
                  <input type="password" className={inputCls} placeholder="••••••••" />
                </div>
              </div>
              <button className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                {t("jobprovider.updatePassword")}
              </button>
            </div>
          ),
        },
        {
          title: t("jobprovider.dangerZone"),
          content: (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{t("jobprovider.deactivateAccount")}</p>
                <p className="text-xs text-muted-foreground">Temporarily hide your profile and listings</p>
              </div>
              <button className="px-4 py-2 text-sm font-semibold rounded-xl border border-red-500/30 bg-red-500/5 text-red-500 hover:bg-red-500/10 transition-colors">
                {t("jobprovider.deactivate")}
              </button>
            </div>
          ),
        },
      ].map(section => (
        <div key={section.title} className="rounded-2xl border border-border bg-card shadow-sm p-6">
          <h4 className="font-semibold text-foreground mb-5 pb-4 border-b border-border">{section.title}</h4>
          {section.content}
        </div>
      ))}
    </motion.div>
  );
}
