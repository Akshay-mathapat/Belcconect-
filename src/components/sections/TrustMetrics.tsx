"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

const METRICS = [
  { value: 10000, suffix: "+", label: "Bookings Completed" },
  { value: 500, suffix: "+", label: "Verified Professionals" },
  { value: 4.8, suffix: "", label: "Average Rating", isDecimal: true },
  { value: 15, suffix: "+", label: "Service Categories" },
];

function AnimatedCounter({ target, isDecimal, suffix }: { target: number; isDecimal?: boolean; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (!isInView) return;
    const duration = 2000;
    const steps = 60;
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
  return (
    <section className="relative border-y border-border bg-muted/30 dark:bg-muted/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {METRICS.map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true, margin: "-50px" }}
              className="text-center"
            >
              <p className="text-3xl sm:text-4xl lg:text-5xl font-bold font-heading text-foreground tracking-tight">
                <AnimatedCounter target={metric.value} isDecimal={"isDecimal" in metric} suffix={metric.suffix} />
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
