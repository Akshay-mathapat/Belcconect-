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

import {
  SITE_URL,
  SITE_NAME,
  DEFAULT_DESCRIPTION,
  GOOGLE_SITE_VERIFICATION,
  BING_SITE_VERIFICATION
} from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "BelConnect - Book Trusted Home Services in Belagavi",
    template: "%s | BelConnect Belagavi",
  },
  description: DEFAULT_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "BelConnect - Book Trusted Home Services in Belagavi",
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "BelConnect - Belagavi Local Home Services & Verified Professionals",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BelConnect - Book Trusted Home Services in Belagavi",
    description: DEFAULT_DESCRIPTION,
    creator: "@BelConnect",
    images: ["/opengraph-image"],
  },
  verification: {
    google: GOOGLE_SITE_VERIFICATION || undefined,
    other: BING_SITE_VERIFICATION
      ? {
          "msvalidate.01": [BING_SITE_VERIFICATION],
        }
      : undefined,
  },
  icons: {
    icon: "/belconnect.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: SITE_NAME,
  },
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
      <head>
        <script src="https://accounts.google.com/gsi/client" async defer />
      </head>
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
