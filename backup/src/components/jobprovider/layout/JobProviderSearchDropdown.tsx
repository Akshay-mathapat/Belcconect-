"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { 
  Briefcase, 
  FileText, 
  BookmarkCheck, 
  Megaphone, 
  MessageSquare, 
  Settings, 
  Building2, 
  PlusCircle, 
  ArrowRight,
  MapPin
} from "lucide-react";

interface JobProviderSearchDropdownProps {
  query: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectPanel?: (panel: string) => void;
}

const JOB_PROVIDER_PAGES = [
  { panel: "post-job", label: "Post a New Job", keywords: ["post job", "create job", "hiring", "opening"], desc: "Publish new job openings for local candidates", icon: PlusCircle },
  { panel: "my-jobs", label: "My Job Listings", keywords: ["my jobs", "listings", "active jobs", "vacancies"], desc: "Manage your active and paused job posts", icon: Briefcase },
  { panel: "applications", label: "Candidate Applications", keywords: ["applications", "resumes", "candidates", "applicants"], desc: "Review incoming resumes and job applications", icon: FileText },
  { panel: "shortlisted", label: "Shortlisted Candidates", keywords: ["shortlisted", "saved candidates", "favorites"], desc: "View bookmarked and top candidates", icon: BookmarkCheck },
  { panel: "messages", label: "Employer Messages", keywords: ["messages", "chat", "interviews", "candidates"], desc: "Direct messaging with job applicants", icon: MessageSquare },
  { panel: "business-profile", label: "Business Profile Settings", keywords: ["business profile", "company profile", "settings"], desc: "Update company logo, description & contact info", icon: Building2 },
  { panel: "settings", label: "Account Settings", keywords: ["settings", "preferences", "account"], desc: "Notification and account preferences", icon: Settings },
];

const MOCK_JOBS = [
  { id: "J-001", panel: "my-jobs", title: "Senior Electrician", location: "Belagavi", salary: "₹25,000–35,000/mo", applicants: 18, status: "Active" },
  { id: "J-002", panel: "my-jobs", title: "Plumbing Supervisor", location: "Hubli", salary: "₹20,000–28,000/mo", applicants: 9, status: "Active" },
  { id: "J-003", panel: "my-jobs", title: "HVAC Technician", location: "Dharwad", salary: "₹15,000–20,000/mo", applicants: 5, status: "Paused" },
  { id: "J-004", panel: "my-jobs", title: "Cleaning Team Lead", location: "Belagavi", salary: "₹18,000–22,000/mo", applicants: 24, status: "Closed" },
];

const MOCK_APPLICANTS = [
  { id: "A-001", panel: "applications", name: "Ramesh Kumar", role: "Electrician", jobTitle: "Senior Electrician", experience: "6 yrs", location: "Belagavi", status: "New" },
  { id: "A-002", panel: "shortlisted", name: "Priya Nair", role: "Team Lead", jobTitle: "Cleaning Team Lead", experience: "4 yrs", location: "Belgaum", status: "Shortlisted" },
  { id: "A-003", panel: "applications", name: "Suresh Patil", role: "Plumber", jobTitle: "Plumbing Supervisor", experience: "8 yrs", location: "Hubli", status: "Reviewed" },
  { id: "A-004", panel: "applications", name: "Kavita Desai", role: "HVAC Tech", jobTitle: "HVAC Technician", experience: "3 yrs", location: "Dharwad", status: "New" },
];

export function JobProviderSearchDropdown({ query, isOpen, onClose, onSelectPanel }: JobProviderSearchDropdownProps) {
  const router = useRouter();

  if (!isOpen || !query.trim()) return null;

  const queryTrimmed = query.trim().toLowerCase();

  // 1. Filter Job Openings
  const matchingJobs = MOCK_JOBS.filter((j) =>
    j.title.toLowerCase().includes(queryTrimmed) ||
    j.location.toLowerCase().includes(queryTrimmed) ||
    j.salary.toLowerCase().includes(queryTrimmed)
  );

  // 2. Filter Applicants
  const matchingApplicants = MOCK_APPLICANTS.filter((a) =>
    a.name.toLowerCase().includes(queryTrimmed) ||
    a.role.toLowerCase().includes(queryTrimmed) ||
    a.jobTitle.toLowerCase().includes(queryTrimmed) ||
    a.location.toLowerCase().includes(queryTrimmed)
  );

  // 3. Filter Job Provider Tools
  const matchingPages = JOB_PROVIDER_PAGES.filter((p) =>
    p.label.toLowerCase().includes(queryTrimmed) ||
    p.keywords.some((k) => k.includes(queryTrimmed))
  );

  const handleItemClick = (panelKey: string) => {
    if (onSelectPanel) {
      onSelectPanel(panelKey);
    } else {
      router.push("/jobprovider");
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-border bg-card shadow-2xl p-3 z-50 max-h-[80vh] overflow-y-auto space-y-3"
      >
        {/* ── Section A: Matching Job Openings ─────────────────────────── */}
        {matchingJobs.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider">
                Job Openings ({matchingJobs.length})
              </span>
              <button onClick={() => handleItemClick("my-jobs")} className="text-[10px] text-muted-foreground hover:text-blue-600 font-bold">
                View All →
              </button>
            </div>

            {matchingJobs.map((j) => (
              <div
                key={j.id}
                onClick={() => handleItemClick(j.panel)}
                className="p-3 rounded-xl border border-border/80 bg-card hover:bg-muted/30 transition-all flex items-center justify-between gap-3 text-xs cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-foreground">{j.title}</h5>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <MapPin className="h-3 w-3 text-muted-foreground inline" />
                      {j.location} • {j.salary} • {j.applicants} applicants
                    </span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                  j.status === "Active" 
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                }`}>
                  {j.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Section B: Matching Candidate Applications ─────────────────── */}
        {matchingApplicants.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-extrabold text-purple-600 uppercase tracking-wider">
                Candidate Resumes ({matchingApplicants.length})
              </span>
              <button onClick={() => handleItemClick("applications")} className="text-[10px] text-muted-foreground hover:text-purple-600 font-bold">
                Review Resumes →
              </button>
            </div>

            {matchingApplicants.map((a) => (
              <div
                key={a.id}
                onClick={() => handleItemClick(a.panel)}
                className="p-3 rounded-xl border border-border/80 bg-card hover:bg-muted/30 transition-all flex items-center justify-between gap-3 text-xs cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0 font-bold text-xs">
                    {a.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h5 className="font-bold text-foreground">{a.name}</h5>
                    <span className="text-[11px] text-muted-foreground">{a.role} for {a.jobTitle} • {a.experience} exp</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-violet-600 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20 shrink-0">
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Section C: Matching Employer Tools ────────────────────────── */}
        {matchingPages.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider px-2 block">
              Job Provider Tools & Shortcuts
            </span>
            {matchingPages.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.label}
                  onClick={() => handleItemClick(p.panel)}
                  className="p-2.5 rounded-xl border border-border/70 bg-card hover:bg-blue-500/10 hover:border-blue-500/30 flex items-center justify-between text-xs font-bold text-foreground cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 text-blue-600 shrink-0" />
                    <div>
                      <div>{p.label}</div>
                      <div className="text-[10px] font-normal text-muted-foreground">{p.desc}</div>
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              );
            })}
          </div>
        )}

        {matchingJobs.length === 0 && matchingApplicants.length === 0 && matchingPages.length === 0 && (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No job provider postings, applications, or tools matched "<span className="font-bold text-foreground">{query}</span>".
          </div>
        )}

      </motion.div>
    </AnimatePresence>
  );
}
