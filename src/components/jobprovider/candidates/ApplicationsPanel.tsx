"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Search,
  Filter,
  FileText,
  MapPin,
  Briefcase,
  Clock,
  Mail,
  Phone,
  MessageSquare,
  BookmarkCheck,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  ArrowLeft,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { Applicant, AppStatus } from "../types";
import { MOCK_APPLICANTS, appStatusColors, panelVariants } from "../mockData";
import { AvatarCircle } from "../common/AvatarCircle";

export function ApplicationsPanel() {
  const { t } = useTranslation();
  const router = useRouter();
  const [applicants, setApplicants] = useState<Applicant[]>(MOCK_APPLICANTS);
  const [filter, setFilter] = useState<AppStatus | "all">("all");
  const [selected, setSelected] = useState<Applicant | null>(null);

  const updateStatus = (id: string, status: AppStatus) => {
    setApplicants(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
  };

  const filtered = filter === "all" ? applicants : applicants.filter(a => a.status === filter);
  const filterOptions: { label: string; value: AppStatus | "all" }[] = [
    { label: t("jobprovider.all"), value: "all" },
    { label: t("jobprovider.new"), value: "new" },
    { label: t("jobprovider.reviewed"), value: "reviewed" },
    { label: t("jobprovider.shortlisted"), value: "shortlisted" },
    { label: "Hired", value: "hired" },
    { label: t("jobprovider.rejected"), value: "rejected" },
  ];

  return (
    <motion.div {...panelVariants}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-xl text-foreground">{t("jobprovider.applicationsReceived")}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{applicants.length} {t("jobprovider.totalAppsAcrossJobs")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Filter className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap mb-5 overflow-x-auto pb-1 scrollbar-none">
        {filterOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all shrink-0 ${filter === opt.value ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
          >
            {opt.label}
            <span className="ml-1.5 opacity-70">{opt.value === "all" ? applicants.length : applicants.filter(a => a.status === opt.value).length}</span>
          </button>
        ))}
      </div>

      <div className={`grid gap-4 ${selected ? "grid-cols-1 lg:grid-cols-5" : "grid-cols-1"}`}>
        {/* Applicant list */}
        <div className={`space-y-3 ${selected ? "hidden lg:block lg:col-span-2" : "block"}`}>
          {filtered.map(app => (
            <div
              key={app.id}
              onClick={() => setSelected(app)}
              className={`rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-md ${selected?.id === app.id ? "border-primary bg-primary/5" : "border-border bg-card"}`}
            >
              <div className="flex items-start gap-3">
                <AvatarCircle initials={app.avatar} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-sm font-bold text-foreground truncate">{app.name}</p>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${appStatusColors[app.status]}`}>
                      {app.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{app.jobTitle}</p>
                  <div className="flex flex-wrap gap-2.5 sm:gap-3 mt-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{app.location}</span>
                    <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{app.experience}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{app.appliedOn}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="p-10 text-center border-2 border-dashed border-border rounded-2xl">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No applications with this status</p>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <AnimatePresence mode="wait">
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="lg:col-span-3 rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-6"
            >
              <div className="flex items-start justify-between mb-5 gap-3">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1.5 rounded-lg border border-border text-muted-foreground lg:hidden shrink-0"
                    title="Back to list"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <AvatarCircle initials={selected.avatar} size="lg" />
                  <div className="min-w-0">
                    <h4 className="text-lg sm:text-xl font-bold text-foreground truncate">{selected.name}</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{selected.role} · {selected.experience} experience</p>
                    <p className="text-xs text-primary font-medium mt-0.5 truncate">Applied for: {selected.jobTitle}</p>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3 text-xs sm:text-sm text-foreground">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />{selected.location}
                </div>
                <div className="flex items-center gap-3 text-xs sm:text-sm text-foreground">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />{selected.email}
                </div>
                <div className="flex items-center gap-3 text-xs sm:text-sm text-foreground">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />{selected.phone}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-muted/50 text-xs sm:text-sm text-muted-foreground mb-5">
                <p className="font-medium text-foreground mb-1">Resume / Cover Note</p>
                <p className="leading-relaxed">Experienced {selected.role.toLowerCase()} with {selected.experience} of hands-on field experience. Familiar with safety protocols and modern equipment. Available to start within 2 weeks notice period.</p>
              </div>

              {/* Status update */}
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("jobprovider.updateStatus")}</p>
                <div className="flex flex-wrap gap-2">
                  {(["reviewed", "shortlisted", "hired", "rejected"] as AppStatus[]).map(s => (
                    <button
                      key={s}
                      onClick={() => updateStatus(selected.id, s)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border capitalize transition-all ${selected.status === s ? appStatusColors[s] : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
                    >
                      {s === "shortlisted" ? <><BookmarkCheck className="inline h-3 w-3 mr-1" />{t("jobprovider.shortlisted")}</> : s === "hired" ? <><CheckCircle2 className="inline h-3 w-3 mr-1 text-emerald-500" />Hire Candidate</> : s === "rejected" ? <><XCircle className="inline h-3 w-3 mr-1" />{t("jobprovider.rejected")}</> : <><Eye className="inline h-3 w-3 mr-1" />{t("jobprovider.reviewed")}</>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-border">
                <button onClick={() => router.push("/jobprovider/messages")} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  <MessageSquare className="h-4 w-4" /> {t("jobprovider.contact")}
                </button>
                <button className="flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors">
                  <Phone className="h-4 w-4" /> {t("jobprovider.call")}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
