import Footer from "@/components/sections/Footer";

export default function CancellationPage() {
  return (
    <main className="min-h-screen bg-muted/10 text-foreground flex flex-col">
      <div className="flex-1 pt-8 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-heading font-bold tracking-tight mb-4">Cancellation & Refund Policy</h1>
            <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          
          <div className="rounded-[2rem] border border-border bg-card p-8 sm:p-12 shadow-sm prose prose-slate dark:prose-invert max-w-none">
            <h2>1. Booking Cancellation</h2>
            <p>
              We understand that plans can change. Customers may cancel a scheduled service booking subject to the following conditions:
            </p>
            <ul>
              <li><strong>Free Cancellation:</strong> Bookings can be cancelled without any charge up to 4 hours before the scheduled service time.</li>
              <li><strong>Late Cancellation:</strong> Cancellations made within 4 hours of the scheduled service time may incur a cancellation fee of ₹150 to compensate the professional for their blocked time.</li>
              <li><strong>On-Arrival Cancellation:</strong> If a cancellation is made after the professional has arrived at the location, a minimum visiting charge of ₹299 will be applicable.</li>
            </ul>

            <h2>2. Rescheduling</h2>
            <p>
              You can reschedule your booking free of cost up to 4 hours before the original scheduled time. Rescheduling requests made within 4 hours of the service time will be treated on a case-by-case basis and may be subject to provider availability.
            </p>

            <h2>3. Refunds</h2>
            <p>
              If you are eligible for a refund, the following terms apply:
            </p>
            <ul>
              <li>Refunds for cancelled bookings will be processed to the original method of payment.</li>
              <li>Please allow 5-7 business days for the refund amount to reflect in your bank account or credit card statement.</li>
              <li>If you paid via cash, any eligible refunds will be credited to your CityConnect Wallet for future use.</li>
            </ul>

            <h2>4. Service Quality Guarantee</h2>
            <p>
              If you are unsatisfied with the quality of service provided, please report the issue within 24 hours of service completion. We will arrange for a re-work or provide a partial/full refund based on our investigation of the issue.
            </p>

            <h2>5. Provider Cancellations</h2>
            <p>
              In the rare event that a professional cancels a booking or fails to arrive, we will prioritize assigning a replacement professional. If we are unable to fulfill the service, a full refund (if prepaid) will be issued immediately.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
