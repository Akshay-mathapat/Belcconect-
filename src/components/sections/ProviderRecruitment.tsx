"use client";

import { motion } from "framer-motion";
import { ArrowRight, Clock, Wallet, Users, Rocket } from "lucide-react";

const perks = [
  { icon: Clock, title: "Flexible Working Hours", desc: "Choose your own schedule. Work when you want, where you want." },
  { icon: Wallet, title: "Reliable Payouts", desc: "Get paid securely and on time, every time you complete a job." },
  { icon: Users, title: "Consistent Customers", desc: "We bring the customers to you, so you can focus on what you do best." },
  { icon: Rocket, title: "Easy Onboarding", desc: "Sign up, verify your skills, and start earning in a matter of days." },
];

export function ProviderRecruitment() {
  return (
    <section id="providers" className="py-20 sm:py-28 relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-accent/[0.03]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: Content */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
                Join our network
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-4">
                Grow your business with CityConnect
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-md">
                Are you a skilled professional? Partner with us to reach more customers, earn consistently, and manage your bookings effortlessly.
              </p>
            </motion.div>

            <motion.a
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              href="/register/provider"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-xl shadow-primary/25 hover:shadow-primary/40 transition-shadow"
            >
              Become a Provider
              <ArrowRight className="h-4 w-4" />
            </motion.a>
          </div>

          {/* Right: Perks grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {perks.map((perk, i) => (
              <motion.div
                key={perk.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="rounded-2xl border border-border bg-card p-5 transition-all hover:shadow-lg hover:border-primary/20"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <perk.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground text-sm mb-1">
                  {perk.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {perk.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
