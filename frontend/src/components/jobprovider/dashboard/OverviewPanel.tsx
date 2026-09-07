"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Users,
  Plus,
  ChevronRight,
  Clock,
  Calendar,
  Building2,
  CheckCircle2,
  FileText,
  UserCheck,
  Award,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { panelVariants } from "../mockData";

export function OverviewPanel() {
  const router = useRouter();
  const { currentUser } = useAuthStore();
  const firstName = currentUser?.name ? currentUser.name.split(" ")[0] : "Employer";

  const employerMetrics = [
    { label: "ACTIVE JOB POSTS", value: "12", sub: "+2 this month", icon: Briefcase, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/50" },
    { label: "TOTAL APPLICANTS", value: "158", sub: "34 unreviewed", icon: Users, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/50" },
    { label: "INTERVIEWS SCHEDULED", value: "8", sub: "2 upcoming today", icon: Calendar, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/50" },
    { label: "CANDIDATES HIRED", value: "24", sub: "96% fulfillment rate", icon: Award, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/50" },
  ];

  const recentApplications = [
    {
      id: "app-1",
      name: "Marcus Thorne",
      appliedFor: "Senior Electrician",
      experience: "5 yrs exp",
      matchScore: "94% Match",
      time: "2h ago",
      status: "New",
      statusColor: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80",
    },
    {
      id: "app-2",
      name: "Elena Rodriguez",
      appliedFor: "HVAC Technician",
      experience: "7 yrs exp",
      matchScore: "88% Match",
      time: "5h ago",
      status: "Shortlisted",
      statusColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&q=80",
    },
    {
      id: "app-3",
      name: "Suresh Patil",
      appliedFor: "Plumbing Supervisor",
      experience: "4 yrs exp",
      matchScore: "91% Match",
      time: "1d ago",
      status: "Reviewed",
      statusColor: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80",
    },
  ];

  const activeJobListings = [
    { id: "J-001", title: "Senior Electrician", location: "Belagavi", salary: "Competitive", applicants: 18, status: "Active" },
    { id: "J-002", title: "Plumbing Supervisor", location: "Hubli", salary: "As per standards", applicants: 9, status: "Active" },
    { id: "J-003", title: "HVAC Technician", location: "Dharwad", salary: "Best in industry", applicants: 5, status: "Paused" },
  ];

  const upcomingInterviews = [
    {
      id: "int-1",
      candidate: "Marcus Thorne",
      jobTitle: "Senior Electrician",
      time: "Today, 11:30 AM",
      type: "Video Interview",
      actionLabel: "Join Call",
      isPrimary: true,
    },
    {
      id: "int-2",
      candidate: "Elena Rodriguez",
      jobTitle: "HVAC Technician",
      time: "Tomorrow, 02:00 PM",
      type: "Phone Interview",
      actionLabel: "Reschedule",
      isPrimary: false,
    },
  ];

  return (
    <motion.div {...panelVariants} className="space-y-6 sm:space-y-8">
      {/* ── Employer Welcome Header ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome back, {firstName}.
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Employer Dashboard · Manage job posts, review candidates, and conduct interviews.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/jobprovider/post-job")}
            className="px-5 py-2.5 sm:py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4 stroke-[3]" /> Post a New Job
          </button>
        </div>
      </div>

      {/* ── Key Employer Metrics Grid (4 KPI Cards) ──────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {employerMetrics.map((m) => (
          <div
            key={m.label}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-card p-4 sm:p-5 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-extrabold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                {m.label}
              </span>
              <div className={`p-2 rounded-xl ${m.bg} ${m.color}`}>
                <m.icon className="h-4 w-4" />
              </div>
            </div>

            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {m.value}
              </p>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {m.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── 3 Core Pillars Action Row ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => router.push("/jobprovider/post-job")}
          className="p-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-between group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/20 text-white">
              <Plus className="h-5 w-5 stroke-[3]" />
            </div>
            <div className="text-left">
              <span className="block text-xs font-medium text-blue-100 uppercase tracking-wider">Step 1</span>
              <span className="block text-sm font-bold">Post a New Job</span>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          onClick={() => router.push("/jobprovider/candidates")}
          className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-card text-slate-900 dark:text-white font-bold text-sm hover:border-violet-500/50 hover:bg-violet-50/30 dark:hover:bg-violet-950/20 transition-all flex items-center justify-between group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div className="text-left">
              <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Step 2</span>
              <span className="block text-sm font-bold">Interview Candidates</span>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          onClick={() => router.push("/jobprovider/candidates")}
          className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-card text-slate-900 dark:text-white font-bold text-sm hover:border-emerald-500/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-all flex items-center justify-between group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <UserCheck className="h-5 w-5" />
            </div>
            <div className="text-left">
              <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Step 3</span>
              <span className="block text-sm font-bold">Hire Top Talent</span>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* ── Main Employer Dashboard Grid ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left Column: Recent Applications & Active Listings */}
        <div className="lg:col-span-7 space-y-6">
          {/* Recent Applications Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  Recent Candidate Applications
                </h3>
              </div>
              <button
                onClick={() => router.push("/jobprovider/candidates")}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                View All <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentApplications.map((app) => (
                <div
                  key={app.id}
                  onClick={() => router.push("/jobprovider/candidates")}
                  className="flex items-center gap-3.5 px-4 sm:px-5 py-3.5 sm:py-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-base flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                    {app.name ? app.name.trim().charAt(0).toUpperCase() : "A"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {app.name}
                      </h4>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${app.statusColor}`}>
                        {app.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                        {app.appliedFor}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">•</span>
                      <span className="hidden sm:inline">{app.experience}</span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold shrink-0">
                        {app.matchScore}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Job Listings Summary */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  Active Job Listings Overview
                </h3>
              </div>
              <button
                onClick={() => router.push("/jobprovider/jobs")}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Manage Jobs <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {activeJobListings.map((job) => (
                <div
                  key={job.id}
                  onClick={() => router.push("/jobprovider/jobs")}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/40 bg-slate-50/40 dark:bg-slate-900/30 transition-all cursor-pointer space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {job.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {job.location} • {job.salary}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${job.status === "Active" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}>
                      {job.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
                    <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> {job.applicants} Candidate Applications
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-0.5">
                      Manage <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Upcoming Interviews & Hiring Funnel */}
        <div className="lg:col-span-5 space-y-6">
          {/* Upcoming Candidate Interviews */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  Upcoming Candidate Interviews
                </h3>
              </div>
            </div>

            <div className="space-y-3">
              {upcomingInterviews.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {item.candidate}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        Interview for <span className="font-medium text-slate-700 dark:text-slate-300">{item.jobTitle}</span>
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                      {item.type}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-blue-600 shrink-0" /> {item.time}
                    </span>
                    {item.isPrimary ? (
                      <button className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer shrink-0">
                        {item.actionLabel}
                      </button>
                    ) : (
                      <button className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shrink-0">
                        {item.actionLabel}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hiring Funnel & Company Status Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  BelTech Solutions Profile
                </h3>
              </div>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1 shrink-0">
                <CheckCircle2 className="h-3 w-3" /> Verified
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">Total Listing Views</span>
                <span className="font-extrabold text-slate-900 dark:text-white text-sm">1,420</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">Application Conversion</span>
                <span className="font-extrabold text-slate-900 dark:text-white text-sm">11.1%</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">Company Location</span>
                <span className="font-semibold text-slate-900 dark:text-white">Belagavi, Karnataka</span>
              </div>
            </div>

            <button
              onClick={() => router.push("/jobprovider/business-profile")}
              className="w-full py-2.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Manage Business Profile
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
