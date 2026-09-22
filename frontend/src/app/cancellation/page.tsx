import Footer from "@/components/sections/Footer";

export default function CancellationPage() {
  return (
    <main className="min-h-screen bg-muted/10 text-foreground flex flex-col">
      <div className="flex-1 pt-8 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-heading font-bold tracking-tight mb-4">Cancellation Policy</h1>
            <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>

          <div className="rounded-[2rem] border border-border bg-card p-8 sm:p-12 shadow-sm prose prose-slate dark:prose-invert max-w-none">
            <h2>1. Service Request Cancellation</h2>
            <p>
              Customers can cancel an eligible BelConnect service request through the application. Cancelling the booking cancels the BelConnect service request.
            </p>

            <h2>2. Direct Settlement</h2>
            <p>
              BelConnect does not collect or process service payments. Service charges are decided and settled directly between the customer and the service provider.
            </p>

            <h2>3. Payments and Refunds</h2>
            <p>
              Because BelConnect does not collect service payments, BelConnect does not process refunds, payment reversals, wallet credits, or service payment reimbursements.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
