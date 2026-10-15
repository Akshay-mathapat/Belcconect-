import { Metadata } from "next";
import Link from "next/link";
import { Home, Search, Briefcase, Wrench, HelpCircle, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Page Not Found (404) | BelConnect Belagavi",
  description: "The page you are looking for could not be found. Explore verified home services and jobs in Belagavi on BelConnect.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  const quickLinks = [
    { name: "Electrician", href: "/services/electrician" },
    { name: "Plumber", href: "/services/plumber" },
    { name: "Cleaning", href: "/services/cleaning" },
    { name: "AC Repair", href: "/services/ac-repair" },
    { name: "Painting", href: "/services/painting" },
    { name: "Pest Control", href: "/services/pest-control" },
  ];

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-16 bg-background text-foreground">
      <div className="max-w-2xl w-full text-center space-y-8">
        
        {/* 404 Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-600/10 border border-blue-600/20 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
          Error 404 • Page Not Found
        </div>

        {/* Heading */}
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-5xl font-heading font-extrabold tracking-tight text-foreground">
            Looking for something in Belagavi?
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto">
            The page you are looking for does not exist or has been moved. Use the quick links below to get back on track.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-md hover:bg-primary/90 transition-all"
          >
            <Home className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>

          <Link
            href="/services"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-border bg-card hover:bg-muted/60 text-foreground font-semibold text-sm transition-all"
          >
            <Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Browse Services</span>
          </Link>

          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-border bg-card hover:bg-muted/60 text-foreground font-semibold text-sm transition-all"
          >
            <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Explore Jobs</span>
          </Link>
        </div>

        {/* Popular Belagavi Services Quick Access */}
        <div className="pt-6 border-t border-border/60">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Popular Services in Belagavi
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3.5 py-1.5 rounded-full text-xs font-medium border border-border bg-muted/40 hover:bg-card hover:border-primary/40 hover:text-primary transition-all"
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Help / Contact */}
        <div className="pt-4 text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Need assistance?</span>
          <Link href="/contact" className="text-primary font-semibold hover:underline flex items-center gap-0.5">
            Contact Support <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

      </div>
    </div>
  );
}

