"use client";

import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Zap, Droplets, Sparkles, Bug, Wind, PaintBucket, Scissors, Hammer, GraduationCap, Monitor, PawPrint } from "lucide-react";
import Link from "next/link";
import { SERVICE_CATEGORIES } from "@/constants/site";
import { useTranslation } from "@/lib/i18n";

const iconMap: Record<string, any> = {
  Zap, Droplets, Sparkles, Bug, Wind, PaintBucket, Scissors, Hammer, GraduationCap, Monitor, PawPrint
};

export function ServiceCategories() {
  const { t } = useTranslation();

  return (
    <section id="services" className="py-20 sm:py-28 bg-muted/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
            {t("services.label")}
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            {t("services.title")}
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto text-lg">
            {t("services.subtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {SERVICE_CATEGORIES.map((category, index) => {
            const IconComponent = iconMap[category.icon] || Sparkles;

            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                viewport={{ once: true, margin: "-30px" }}
              >
                <Link href={`/services/${category.id}`} className="group block h-full">
                  <div className="rounded-[2rem] bg-card border border-border shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-xl h-full flex flex-col p-6 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                      <IconComponent className="w-24 h-24 text-foreground" />
                    </div>

                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${category.gradient} flex items-center justify-center mb-6 transition-transform group-hover:scale-110 shadow-sm relative z-10`}>
                      <IconComponent className={`h-6 w-6 ${category.iconColor}`} />
                    </div>

                    <div className="relative z-10 flex-1">
                      <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">{category.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{category.description}</p>
                    </div>

                    <div className="mt-6 flex items-center justify-end relative z-10 pt-4 border-t border-border/50">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
