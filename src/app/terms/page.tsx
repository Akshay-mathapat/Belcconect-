import Navigation from "@/components/sections/Navigation";
import Footer from "@/components/sections/Footer";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-muted/10 text-foreground flex flex-col">
      <Navigation />
      <div className="flex-1 pt-32 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-heading font-bold tracking-tight mb-4">Terms of Service</h1>
            <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          
          <div className="rounded-[2rem] border border-border bg-card p-8 sm:p-12 shadow-sm prose prose-slate dark:prose-invert max-w-none">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using CityConnect, you accept and agree to be bound by the terms and provision of this agreement. 
              In addition, when using these particular services, you shall be subject to any posted guidelines or rules applicable to such services.
            </p>

            <h2>2. Provision of Services</h2>
            <p>
              CityConnect acts as a technology platform that connects customers with independent service providers. 
              We do not provide the services directly, but facilitate the booking and payment process. We strive to ensure 
              all professionals on our platform are verified and qualified.
            </p>

            <h2>3. User Responsibilities</h2>
            <p>Users of our platform agree to:</p>
            <ul>
              <li>Provide accurate and complete information during registration.</li>
              <li>Maintain the security of their account credentials.</li>
              <li>Treat service professionals with respect and provide a safe working environment.</li>
              <li>Pay for services rendered in a timely manner.</li>
            </ul>

            <h2>4. Provider Responsibilities</h2>
            <p>Independent professionals on our platform agree to:</p>
            <ul>
              <li>Maintain all necessary licenses, permits, and qualifications required for their services.</li>
              <li>Provide services in a professional, timely, and workmanlike manner.</li>
              <li>Accurately represent their skills and experience.</li>
              <li>Adhere to all platform guidelines and community standards.</li>
            </ul>

            <h2>5. Limitation of Liability</h2>
            <p>
              CityConnect shall not be liable for any indirect, incidental, special, consequential or punitive damages, 
              including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from 
              your access to or use of or inability to access or use the services.
            </p>

            <h2>6. Changes to Terms</h2>
            <p>
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time. What constitutes 
              a material change will be determined at our sole discretion.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
