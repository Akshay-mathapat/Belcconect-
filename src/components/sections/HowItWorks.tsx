"use client";

import { motion } from "framer-motion";
import { Search, CalendarCheck, CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function HowItWorks() {
  const { t } = useTranslation();

  const steps = [
    { num: "01", icon: Search, titleKey: "howItWorks.step1Title", descKey: "howItWorks.step1Desc", fallbackTitle: "Choose a Service", fallbackDesc: "Browse categories and select the exact service you need for your home.", color: "from-primary/20 to-primary/5", iconColor: "text-primary" },
    { num: "02", icon: CalendarCheck, titleKey: "howItWorks.step2Title", descKey: "howItWorks.step2Desc", fallbackTitle: "Pick a Date", fallbackDesc: "Select a convenient date that works best for your schedule.", color: "from-amber-500/20 to-amber-500/5", iconColor: "text-amber-500" },
    { num: "03", icon: CheckCircle2, titleKey: "howItWorks.step3Title", descKey: "howItWorks.step3Desc", fallbackTitle: "Get it Done", fallbackDesc: "Our verified professional arrives on time and completes the job perfectly.", color: "from-accent/20 to-accent/5", iconColor: "text-accent" },
  ];

  return (
    <section className="py-20 sm:py-28 bg-muted/30 dark:bg-muted/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
            {t("howItWorks.label")}
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            {t("howItWorks.title")}
          </h2>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto text-lg">
            {t("howItWorks.subtitle")}
          </p>
        </motion.div>

        {/* Steps */}
        <div className="relative max-w-4xl mx-auto">
          {/* Connecting line — desktop */}
          <div className="hidden md:block absolute top-16 left-[16.66%] right-[16.66%] h-[2px] bg-gradient-to-r from-primary/20 via-amber-500/20 to-accent/20" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                viewport={{ once: true }}
                className="text-center relative"
              >
                {/* Step number + icon */}
                <div className="relative inline-flex flex-col items-center mb-6">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}>
                    <step.icon className={`h-7 w-7 ${step.iconColor}`} />
                  </div>
                  {/* Step badge */}
                  <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-card border-2 border-border flex items-center justify-center text-[10px] font-bold text-foreground shadow-sm">
                    {step.num}
                  </span>
                </div>

                <h3 className="font-heading text-lg font-bold text-foreground mb-2">
                  {t(step.titleKey) !== step.titleKey ? t(step.titleKey) : step.fallbackTitle}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  {t(step.descKey) !== step.descKey ? t(step.descKey) : step.fallbackDesc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}