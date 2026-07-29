"use client";

import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { BELAGAVI_AREAS } from "@/constants/site";

export function LocalFocus() {
  const { t } = useTranslation();

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              {t("local.label")}
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-4">
              {t("local.title")}
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-md">
              {t("local.subtitle")}
            </p>

            {/* Area chips */}
            <div className="flex flex-wrap gap-2.5">
              {BELAGAVI_AREAS.map((area, i) => (
                <motion.span
                  key={area.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.08 }}
                  viewport={{ once: true }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all cursor-default"
                >
                  <MapPin className="h-3 w-3 text-primary" />
                  {area.name}
                </motion.span>
              ))}
            </div>
          </motion.div>

          {/* Right: Map-style visual */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="relative h-80 sm:h-96 rounded-3xl border border-border bg-muted/30 dark:bg-muted/10 overflow-hidden"
          >
            {/* Grid background */}
            <div className="absolute inset-0 grid-dots opacity-40" />

            {/* Area pins */}
            {BELAGAVI_AREAS.map((area, i) => (
              <motion.div
                key={area.name}
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
                viewport={{ once: true }}
                className="absolute group"
                style={{ left: `${area.x}%`, top: `${area.y}%` }}
              >
                {/* Pulse ring */}
                <span className="absolute -inset-2 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: `${3 + i * 0.5}s` }} />
                {/* Pin */}
                <div className="relative w-4 h-4 rounded-full bg-primary shadow-lg shadow-primary/30 border-2 border-card" />
                {/* Label */}
                <span className="absolute left-6 top-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-semibold text-foreground bg-card/80 backdrop-blur-sm px-2 py-0.5 rounded-md border border-border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  {area.name}
                </span>
              </motion.div>
            ))}

            {/* Connection lines */}
            <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
              {BELAGAVI_AREAS.slice(0, -1).map((area, i) => {
                const next = BELAGAVI_AREAS[i + 1];
                return (
                  <motion.line
                    key={`line-${i}`}
                    x1={`${area.x}%`}
                    y1={`${area.y}%`}
                    x2={`${next.x}%`}
                    y2={`${next.y}%`}
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    className="text-primary/20"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    transition={{ duration: 1, delay: 0.5 + i * 0.15 }}
                    viewport={{ once: true }}
                  />
                );
              })}
            </svg>

            {/* Center label */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-card/90 backdrop-blur-sm border border-border px-4 py-2 shadow-lg text-sm font-semibold text-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                Belagavi (IXG)
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
