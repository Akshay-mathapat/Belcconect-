"use client";

import Link from "next/link";
import { ArrowUp, Sun, Moon, Monitor, MapPin } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { SITE_NAME } from "@/constants/site";
import { useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";

export default function Footer() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const columns = [
    {
      title: t("footer.company") !== "footer.company" ? t("footer.company") : "Company",
      links: [
        { label: t("footer.aboutUs") !== "footer.aboutUs" ? t("footer.aboutUs") : "About Us", href: "/about" },
        { label: t("footer.careers") !== "footer.careers" ? t("footer.careers") : "Careers", href: "/careers" },
        { label: t("footer.blog") !== "footer.blog" ? t("footer.blog") : "Blog", href: "/blog" },
        { label: t("footer.contactUs") !== "footer.contactUs" ? t("footer.contactUs") : "Contact Us", href: "/contact" },
      ],
    },
    {
      title: t("footer.servicesTitle") !== "footer.servicesTitle" ? t("footer.servicesTitle") : "Services",
      links: [
        { label: t("footer.allServices") !== "footer.allServices" ? t("footer.allServices") : "All Services", href: "/services" },
        { label: t("services.cleaning") !== "services.cleaning" ? t("services.cleaning") : "Cleaning", href: "/services/cleaning" },
        { label: t("services.salon") !== "services.salon" ? t("services.salon") : "Salon at Home", href: "/services/salon" },
        { label: t("services.acRepair") !== "services.acRepair" ? t("services.acRepair") : "AC Repair", href: "/services/ac-repair" },
      ],
    },
    {
      title: t("footer.providersTitle") !== "footer.providersTitle" ? t("footer.providersTitle") : "For Providers",
      links: [
        { label: t("footer.registerPro") !== "footer.registerPro" ? t("footer.registerPro") : "Register as a Pro", href: "/register/provider" },
        { label: t("footer.dashboard") !== "footer.dashboard" ? t("footer.dashboard") : "Provider Dashboard", href: "/provider/dashboard" },
      ],
    },
    {
      title: t("footer.support") !== "footer.support" ? t("footer.support") : "Support",
      links: [
        { label: t("footer.helpCenter") !== "footer.helpCenter" ? t("footer.helpCenter") : "Help Center", href: "/help" },
        { label: t("footer.privacy") !== "footer.privacy" ? t("footer.privacy") : "Privacy Policy", href: "/privacy" },
        { label: t("footer.terms") !== "footer.terms" ? t("footer.terms") : "Terms of Service", href: "/terms" },
        { label: t("footer.cancellation") !== "footer.cancellation" ? t("footer.cancellation") : "Cancellation Policy", href: "/cancellation" },
      ],
    },
  ];

  const socials = [
    { label: "Twitter", path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" },
    { label: "Instagram", path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" },
    { label: "LinkedIn", path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" },
  ];

  return (
    <footer id="contact" className="border-t border-border bg-card dark:bg-card/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 py-16">
          {/* Brand column — spans 2 */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden shadow-md group-hover:scale-105 transition-transform duration-200">
                <img src="/belconnect.png" alt="BelConnect" className="h-full w-full object-contain p-1 rounded-lg" />
              </div>
              <span className="font-heading text-lg font-bold text-foreground">{SITE_NAME}</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-sm">
              Connecting Belagavi with trusted local professionals for all your home and business needs.
            </p>

            {/* Social links */}
            <div className="flex items-center gap-2">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d={s.path} /></svg>
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-foreground mb-4">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} {SITE_NAME}. All rights reserved.</span>
            <span className="hidden sm:inline">·</span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Proudly made in Belagavi
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            {mounted && (
              <div className="flex items-center rounded-lg border border-border overflow-hidden">
                {[
                  { val: "light" as const, Icon: Sun },
                  { val: "dark" as const, Icon: Moon },
                  { val: "system" as const, Icon: Monitor },
                ].map(({ val, Icon }) => (
                  <button
                    key={val}
                    onClick={() => setTheme(val)}
                    className={`p-1.5 transition-colors ${theme === val ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    aria-label={`${val} theme`}
                    suppressHydrationWarning
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            )}

            {/* Back to top */}
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
              aria-label="Back to top"
              suppressHydrationWarning
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}