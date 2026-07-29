import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { I18nProvider } from "@/lib/i18n";
import Navigation from "@/components/sections/Navigation";

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
  title: "BelConnect — Trusted Home Services, On Demand",
  description:
    "Book verified professionals for electrical, plumbing, cleaning, painting, AC repair, salon, and more in Belagavi. Fast, reliable, affordable home services marketplace.",
  keywords: [
    "home services",
    "Belagavi",
    "electrician",
    "plumber",
    "cleaning",
    "salon at home",
    "AC repair",
    "verified professionals",
    "book services online",
  ],
  openGraph: {
    title: "BelConnect — Trusted Home Services, On Demand",
    description:
      "Book verified professionals for any home service in Belagavi. Fast, reliable, and affordable.",
    type: "website",
    locale: "en_IN",
  },
  icons: {
    icon: "/BelConnect-logo.png",
  },
};

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
      <body className="min-h-full flex flex-col font-sans">
        <I18nProvider>
          <ThemeProvider>
            <Navigation />
            {children}
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
