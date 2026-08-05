"use client";

import Navigation from "@/components/sections/Navigation";
import Footer from "@/components/sections/Footer";
import { Search, MessageSquare, PhoneCall, Mail } from "lucide-react";
import { useState } from "react";

export default function HelpPage() {
  const [search, setSearch] = useState("");

  const faqs = [
    { q: "How do I book a service?", a: "You can book a service by browsing our categories, selecting the required service, and choosing a suitable date and time slot." },
    { q: "What if the professional doesn't show up?", a: "In the rare event of a no-show, we will arrange a replacement professional immediately or issue a full refund." },
    { q: "How can I cancel my booking?", a: "You can cancel your booking from the 'My Bookings' section in your account. Free cancellation is available up to 4 hours before the service time." },
    { q: "Are the professionals verified?", a: "Yes, all professionals undergo a background check and skill verification process before joining the platform." }
  ];

  return (
    <main className="min-h-screen bg-muted/10 text-foreground flex flex-col">
      <Navigation />
      
      <div className="flex-1 pt-32 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          
          <div className="text-center mb-12">
            <h1 className="text-4xl font-heading font-bold tracking-tight mb-4">How can we help you?</h1>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Search our knowledge base or browse frequently asked questions to find the answers you need.
            </p>
            
            <div className="mt-8 max-w-xl mx-auto relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-full pl-12 pr-4 py-4 border border-border rounded-2xl bg-card focus:bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm text-foreground placeholder-muted-foreground"
                placeholder="Search for answers..."
              />
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <div className="rounded-2xl border border-border bg-card p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Live Chat</h3>
              <p className="text-sm text-muted-foreground">Chat with our support team in real-time.</p>
            </div>
            
            <div className="rounded-2xl border border-border bg-card p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary">
                <PhoneCall className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Call Us</h3>
              <p className="text-sm text-muted-foreground">+91 98765 43210<br/>Mon-Sun, 8am-8pm</p>
            </div>
            
            <div className="rounded-2xl border border-border bg-card p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary">
                <Mail className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Email Us</h3>
              <p className="text-sm text-muted-foreground">support@cityconnect.in<br/>We reply within 24 hrs</p>
            </div>
          </div>
          
          <div>
            <h2 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
            <div className="grid gap-4 max-w-3xl mx-auto">
              {faqs.map((faq, i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-6">
                  <h3 className="font-semibold text-lg mb-2 text-foreground">{faq.q}</h3>
                  <p className="text-muted-foreground">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </div>
      
      <Footer />
    </main>
  );
}
