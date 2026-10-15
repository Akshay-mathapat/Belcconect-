"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { SERVICE_CATEGORIES } from "@/constants/site";

interface MetricItem {
  value: number;
  suffix: string;
  label: string;
  isDecimal?: boolean;
}

function AnimatedCounter({ target, isDecimal, suffix }: { target: number; isDecimal?: boolean; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (!isInView) return;
    const duration = 1500;
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      setCount(current);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [isInView, target]);

  return (
    <span ref={ref} className="tabular-nums">
      {isDecimal ? count.toFixed(1) : Math.floor(count).toLocaleString()}
      {suffix}
    </span>
  );
}

export function TrustMetrics() {
  const [metrics, setMetrics] = useState<MetricItem[]>([
    { value: SERVICE_CATEGORIES.length, suffix: "+", label: "Service Categories" },
    { value: 100, suffix: "%", label: "Direct In-App Booking" },
    { value: 100, suffix: "%", label: "Belagavi Local Focus" },
    { value: 100, suffix: "%", label: "ID Verification Required" },
  ]);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/platform/metrics")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;

        const dynamicMetrics: MetricItem[] = [];

        // 1. Service categories count (factual)
        dynamicMetrics.push({
          value: data.categoryCount || SERVICE_CATEGORIES.length,
          suffix: "+",
          label: "Service Categories",
        });

        // 2. Verified active professionals
        if (data.verifiedProviders > 0) {
          dynamicMetrics.push({
            value: data.verifiedProviders,
            suffix: "+",
            label: "Verified Professionals",
          });
        } else {
          dynamicMetrics.push({
            value: 100,
            suffix: "%",
            label: "Belagavi Local Focus",
          });
        }

        // 3. Completed bookings
        if (data.completedBookings > 0) {
          dynamicMetrics.push({
            value: data.completedBookings,
            suffix: "+",
            label: "Bookings Completed",
          });
        } else {
          dynamicMetrics.push({
            value: 100,
            suffix: "%",
            label: "Direct In-App Booking",
          });
        }

        // 4. Real customer rating or ID verification standard
        if (data.avgRating && data.reviewCount > 0) {
          dynamicMetrics.push({
            value: data.avgRating,
            suffix: "",
            label: "Average Rating",
            isDecimal: true,
          });
        } else {
          dynamicMetrics.push({
            value: 100,
            suffix: "%",
            label: "ID Verification Required",
          });
        }

        setMetrics(dynamicMetrics);
      })
      .catch(() => {
        // Fallback to truthful static baseline
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="relative border-y border-border bg-muted/30 dark:bg-muted/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {metrics.map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true, margin: "-50px" }}
              className="text-center"
            >
              <p className="text-3xl sm:text-4xl lg:text-5xl font-bold font-heading text-foreground tracking-tight">
                <AnimatedCounter target={metric.value} isDecimal={metric.isDecimal} suffix={metric.suffix} />
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground font-medium">
                {metric.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
