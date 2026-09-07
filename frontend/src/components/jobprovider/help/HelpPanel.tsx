"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  HelpCircle,
  MessageSquare,
  Mail,
  Phone,
  FileText,
  Briefcase,
  Users,
  Building2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { panelVariants } from "../mockData";

export function HelpPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [ticketSubmitted, setTicketSubmitted] = useState(false);

  const faqCategories = [
    {
      title: "Job Listings & Posting",
      icon: Briefcase,
      color: "text-blue-600 bg-blue-50 dark:bg-blue-950/50",
      faqs: [
        {
          q: "How do I post a new job listing?",
          a: "Click the '+ Post a New Job' button on your sidebar or header. Fill in the job details including title, location, salary range, and job description, then click 'Publish Job'.",
        },
        {
          q: "Can I edit or pause an active job listing?",
          a: "Yes! Navigate to 'Job Listings', locate the job card, and click 'Pause' or 'Edit'. Paused jobs hide your listing from public search without deleting applicant data.",
        },
        {
          q: "How long do posted jobs remain active?",
          a: "By default, listings stay active for 30 days unless closed manually or extended by your account manager.",
        },
      ],
    },
    {
      title: "Candidate Management & Hiring",
      icon: Users,
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50",
      faqs: [
        {
          q: "How do I contact shortlisted candidates?",
          a: "Go to the 'Candidates' tab, click on an applicant to view their profile, and use the 'Message' or 'Call' button to connect directly.",
        },
        {
          q: "What does the 'Hire Candidate' button do?",
          a: "Marking a candidate as 'Hired' updates their status in your hiring pipeline, sends them an offer confirmation, and updates your overall fulfillment statistics.",
        },
        {
          q: "How do candidate match scores work?",
          a: "Match scores are calculated based on candidate experience, skills matching your job requirements, location proximity, and availability.",
        },
      ],
    },
    {
      title: "Account & Company Verification",
      icon: Building2,
      color: "text-violet-600 bg-violet-50 dark:bg-violet-950/50",
      faqs: [
        {
          q: "How do I get the 'Verified Employer' badge?",
          a: "Complete your company profile under 'Business Profile' with your registered business address, company logo, and GST/PAN details for verification.",
        },
        {
          q: "Can multiple team members access one account?",
          a: "Yes, account admin settings allow inviting team recruiters with custom access permissions.",
        },
      ],
    },
  ];

  const filteredCategories = faqCategories.map(cat => ({
    ...cat,
    faqs: cat.faqs.filter(f =>
      f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.a.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(cat => cat.faqs.length > 0);

  return (
    <motion.div {...panelVariants} className="space-y-6 sm:space-y-8">
      {/* ── Page Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Employer Help & Support Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Find quick answers to job posting, candidate hiring, and account questions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="tel:18001234567"
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-card text-slate-900 dark:text-white font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-2"
          >
            <Phone className="h-4 w-4 text-blue-600" /> Helpline: 1800-JOB-CONNECT
          </a>
        </div>
      </div>

      {/* ── Search Bar ────────────────────────────────────────────────── */}
      <div className="relative max-w-2xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search help articles, job posting guides, or candidate FAQs..."
          className="w-full pl-12 pr-4 py-3.5 text-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-card text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm"
        />
      </div>

      {/* ── Quick Support Channels ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-card shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Employer Live Chat</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Average response time: 2 mins</p>
          </div>
          <button className="w-full py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer">
            Start Live Chat
          </button>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-card shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Email Support</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">employers@belconnect.com</p>
          </div>
          <button className="w-full py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-100 transition-colors cursor-pointer">
            Send Email Ticket
          </button>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-card shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Priority Recruiter Desk</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">For Enterprise Employers</p>
          </div>
          <button className="w-full py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-100 transition-colors cursor-pointer">
            Request Callback
          </button>
        </div>
      </div>

      {/* ── FAQ Categories & Accordions ───────────────────────────────── */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Frequently Asked Questions
        </h2>

        {filteredCategories.map((cat, catIdx) => (
          <div key={cat.title} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${cat.color}`}>
                <cat.icon className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {cat.title}
              </h3>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-card divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-sm">
              {cat.faqs.map((faq, faqIdx) => {
                const globalIndex = catIdx * 10 + faqIdx;
                const isOpen = openFaq === globalIndex;
                return (
                  <div key={faq.q} className="p-4 sm:p-5">
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : globalIndex)}
                      className="w-full flex items-center justify-between text-left gap-4 font-bold text-sm text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-blue-600 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
                    </button>

                    {isOpen && (
                      <p className="mt-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        {faq.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
