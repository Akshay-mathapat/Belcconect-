import Link from "next/link";
import Footer from "@/components/sections/Footer";
import { SITE_NAME } from "@/constants/site";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-muted/10 text-foreground flex flex-col">
      <div className="flex-1 pt-8 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-heading font-bold tracking-tight mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: October 2026</p>
          </div>
          
          <div className="rounded-[2rem] border border-border bg-card p-8 sm:p-12 shadow-sm prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-bold text-foreground">1. Introduction</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                Welcome to {SITE_NAME}. We respect your privacy and are committed to protecting your personal data. 
                This privacy policy informs you about how we handle your personal data when you use our platform, 
                your privacy rights, and the legal protections afforded to you under applicable laws, including the 
                Information Technology Act, 2000 and Digital Personal Data Protection Act.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground">2. Data We Collect</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                We only collect minimal personal data strictly necessary to facilitate local service discovery and job connections:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5 mt-2">
                <li><strong>Identity & Account Data:</strong> Mobile phone number, full name, profile photo, and password credentials.</li>
                <li><strong>Service & Booking Data:</strong> Service categories requested, booking descriptions, preferred time slots, and general service locality.</li>
                <li><strong>Location Data:</strong> Device geographic coordinates (only collected with your explicit in-app consent for matching nearby providers or during active booking execution).</li>
                <li><strong>Provider Verification Data:</strong> Government ID details (masked to the last 4 digits) strictly for KYC safety verification.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground">3. No In-App Payments & No Financial Data</h2>
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-foreground space-y-2 mt-2">
                <p className="font-bold text-blue-600 dark:text-blue-400">
                  Zero Payment Data Collection:
                </p>
                <p>
                  <strong>{SITE_NAME} does NOT collect, store, or process any payment, banking, or financial data.</strong>
                </p>
                <p className="text-muted-foreground">
                  There are no digital payment gateways, wallets, credit card processors, or UPI collection mechanisms on {SITE_NAME}. 
                  All remuneration and service charges are settled directly between customer and provider offline (via cash or direct peer-to-peer UPI) upon satisfactory job completion.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground">4. Analytics & Tracking Policy</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                {SITE_NAME} prioritizes user privacy. <strong>We do not utilize third-party analytics trackers, advertising pixels, or behavioral profiling tools</strong> (such as Google Analytics or Facebook Pixel). 
                Essential system logs are maintained solely for platform stability, rate limiting, and security compliance.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground">5. Data Retention & Account Deletion</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                You retain full ownership and control over your personal data. You may request permanent deletion of your account and all associated personal data at any time directly through the app settings or via our public{" "}
                <Link href="/delete-account" className="text-primary font-medium underline">
                  Account Deletion Portal
                </Link>.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                Upon submitting a deletion request, your profile, contact details, KYC documents, and personal identifiers are expunged within 48 hours, retaining only non-identifiable audit logs required by statutory law.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground">6. Grievance Redressal & Contact Officer</h2>
              <div className="p-4 rounded-xl bg-muted/50 border border-border text-xs text-foreground space-y-2 mt-2">
                <p className="font-bold text-foreground">
                  Grievance Redressal Mechanism (Rule 3(2) of Information Technology Rules, 2021):
                </p>
                <div className="space-y-1 text-muted-foreground">
                  <p><strong>Grievance Officer:</strong> Akshay Mathapati</p>
                  <p><strong>Email:</strong> <a href="mailto:grievance@belconnect.in" className="text-primary underline">grievance@belconnect.in</a></p>
                  <p><strong>Support Email:</strong> <a href="mailto:support@belconnect.in" className="text-primary underline">support@belconnect.in</a></p>
                  <p><strong>Postal Address:</strong> Belagavi, Karnataka, India - 590001</p>
                  <p><strong>Response & Resolution SLA:</strong> Initial acknowledgement within 24 hours; complete dispute/inquiry resolution within 48 hours of receipt.</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
