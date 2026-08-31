import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { I18nProvider } from "@/lib/i18n";
import Navigation from "@/components/sections/Navigation";
import { CallProvider } from "@/components/calls/CallProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BelConnect — Trusted Services, On Demand",
  description:
    "Book verified professionals for electrical, plumbing, cleaning, painting, AC repair, salon, tutoring, and more in Belagavi. Fast, reliable, affordable services marketplace.",
  keywords: [
    "services",
    "Belagavi",
    "electrician",
    "plumber",
    "cleaning",
    "salon",
    "AC repair",
    "verified professionals",
    "book services online",
  ],
  openGraph: {
    title: "BelConnect — Trusted Services, On Demand",
    description:
      "Book verified professionals for any service in Belagavi. Fast, reliable, and affordable.",
    type: "website",
    locale: "en_IN",
  },
  icons: {
    icon: "/BelConnect-logo.png",
  },
  manifest: "/manifest.json",
};

import { AppTour } from "@/components/onboarding/AppTour";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full antialiased", inter.variable, outfit.variable)}
    >
      <head />
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <I18nProvider>
          <ThemeProvider>
            <CallProvider>
              <Navigation />
              <AppTour />
              {children}
            </CallProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
