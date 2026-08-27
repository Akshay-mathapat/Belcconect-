"use client";

import { 
  CheckCircle2, 
  Inbox,
  Clock,
  TrendingUp,
  CreditCard,
  Download
} from "lucide-react";
import { useProviderStore } from "@/store/useProviderStore";

export default function PaymentsPage() {
  const { transactions } = useProviderStore();

  // Calculate real metrics from user transactions (starts at 0)
  const totalEarnings = transactions.reduce((acc, t) => acc + t.amount, 0);
  const thisMonthRevenue = transactions
    .filter(t => t.date?.includes("2026") || t.date?.includes("Today") || t.date?.includes("Just now"))
    .reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Financials & Payouts
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Track earnings, view completed service transaction payouts, and monitor revenue history.
        </p>
      </div>

      {/* Financial Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
          <span className="text-xs text-muted-foreground font-semibold">Total Completed Services</span>
          <div className="font-heading text-2xl font-bold text-foreground">{transactions.length} Jobs</div>
          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">Real Customer Fulfillment</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-1">
          <span className="text-xs text-muted-foreground font-semibold">This Month Jobs</span>
          <div className="font-heading text-2xl font-bold text-blue-600 dark:text-blue-400">{transactions.length} Jobs</div>
          <span className="text-[10px] text-muted-foreground font-medium">Verified service delivery</span>
        </div>
      </div>

      {/* Transaction History (Full Width) */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h3 className="font-heading text-base font-bold text-foreground">Completed Service History</h3>
            <p className="text-xs text-muted-foreground">List of fulfilled customer service requests</p>
          </div>
          <span className="text-xs font-bold text-blue-600 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
            {transactions.length} Completed
          </span>
        </div>

        {transactions.length > 0 ? (
          <div className="space-y-3">
            {transactions.map((t) => (
              <div
                key={t.id}
                className="p-4 rounded-xl border border-border/80 bg-muted/20 flex items-center justify-between gap-4 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground">{t.serviceName}</h4>
                    <span className="text-[11px] text-muted-foreground">{t.customerName} • {t.date}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-heading font-bold text-xs text-foreground block">Fulfilled</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" />
                    {t.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center rounded-2xl border border-dashed border-border bg-muted/10">
            <Inbox className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-foreground mb-1">No Payout Transactions Yet</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Once you complete booking requests from customers in Belagavi, your earnings and transaction records will automatically populate here.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
