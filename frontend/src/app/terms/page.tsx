import Footer from "@/components/sections/Footer";
import { SITE_NAME } from "@/constants/site";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-muted/10 text-foreground flex flex-col">
      <div className="flex-1 pt-8 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-heading font-bold tracking-tight mb-4">Terms of Service</h1>
            <p className="text-muted-foreground">Last updated: October 2026</p>
          </div>
          
          <div className="rounded-[2rem] border border-border bg-card p-8 sm:p-12 shadow-sm prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-bold text-foreground">1. Acceptance of Terms</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                By accessing and using {SITE_NAME}, you accept and agree to be bound by the terms and provisions of this agreement. 
                In addition, when using particular features or services, you shall be subject to any posted guidelines or rules applicable to such services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground">2. Direct Platform Model & No In-App Payments</h2>
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-foreground space-y-2 mt-2">
                <p className="font-bold text-blue-600 dark:text-blue-400">
                  IMPORTANT: Zero Platform Commission & Direct Offline Settlement
                </p>
                <p>
                  {SITE_NAME} operates strictly as an intermediary technology discovery platform that connects customers with independent service professionals and local job opportunities across Belagavi.
                </p>
                <p>
                  <strong>There are NO in-app payments, escrow wallets, or payment gateway fees on {SITE_NAME}.</strong> All financial transactions and service remuneration occur directly between the customer and the service professional offline (via Cash, direct UPI, or bank transfer) upon physical inspection and satisfactory job completion.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground">3. User Responsibilities</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">Users of our platform agree to:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5 mt-2">
                <li>Provide accurate, truthful, and verified mobile numbers during registration.</li>
                <li>Maintain the strict confidentiality and security of their authentication credentials.</li>
                <li>Treat service professionals with dignity, respect, and provide a safe working environment.</li>
                <li>Settle service fees directly with the independent service professional upon satisfactory job completion.</li>
                <li>Never solicit illegal services or misuse platform communication channels.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground">4. Provider Responsibilities</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">Independent service professionals on our platform agree to:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5 mt-2">
                <li>Undergo identity verification and maintain authentic, valid government identification credentials.</li>
                <li>Provide services in a professional, timely, and workmanlike manner adhering to local trade standards.</li>
                <li>Accurately represent skills, experience, and hourly or task-based service rates without hidden fees.</li>
                <li>Maintain punctuality for scheduled booking slots and communicate status updates through the platform.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground">5. Limitation of Liability</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                {SITE_NAME} acts solely as a venue connecting independent parties. To the maximum extent permitted by applicable law, {SITE_NAME} and its operators shall not be liable for any direct, indirect, incidental, special, consequential, or exemplary damages, including personal injury, property damage, or service quality disputes arising from offline engagements between users and independent service providers.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground">6. Grievance Redressal Mechanism & Officer Details</h2>
              <div className="p-4 rounded-xl bg-muted/50 border border-border text-xs text-foreground space-y-2 mt-2">
                <p className="font-bold text-foreground">
                  Statutory Grievance Redressal (Information Technology Act, 2000 & Rules):
                </p>
                <div className="space-y-1 text-muted-foreground">
                  <p><strong>Grievance Officer:</strong> Akshay Mathapati</p>
                  <p><strong>Email:</strong> <a href="mailto:grievance@belconnect.in" className="text-primary underline">grievance@belconnect.in</a></p>
                  <p><strong>Support Email:</strong> <a href="mailto:support@belconnect.in" className="text-primary underline">support@belconnect.in</a></p>
                  <p><strong>Physical Address:</strong> Belagavi, Karnataka, India - 590001</p>
                  <p><strong>Statutory Response Time:</strong> Acknowledgement within 24 hours; complete resolution within 48 hours of receipt.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground">7. Changes to Terms</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                We reserve the right to modify or replace these Terms at any time. Changes will be posted to this page with an updated revision date.
              </p>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
