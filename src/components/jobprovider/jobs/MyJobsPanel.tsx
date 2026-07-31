"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  PlusCircle,
  MapPin,
  Clock,
  DollarSign,
  AlertCircle,
  Eye,
  Pause,
  Play,
  Megaphone,
  Trash2,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { Job } from "../types";
import { MOCK_JOBS, statusColors, panelVariants } from "../mockData";

export function MyJobsPanel() {
  const { t } = useTranslation();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>(MOCK_JOBS);

  const toggleStatus = (id: string) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: j.status === "active" ? "paused" : "active" } : j));
  };

  return (
    <motion.div {...panelVariants} className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-xl text-foreground">{t("jobprovider.myJobListings")}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{t("jobprovider.managePostedJobs")}</p>
        </div>
        <button onClick={() => router.push("/jobprovider/post-job")} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          <PlusCircle className="h-4 w-4" /> {t("jobprovider.postNewJob")}
        </button>
      </div>

      {jobs.map((job) => (
        <div key={job.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusColors[job.status]}`}>
                  ● {job.status}
                </span>
                <span className="text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">{job.type}</span>
                <span className="text-xs text-muted-foreground">{job.id}</span>
              </div>
              <h4 className="text-lg font-bold text-foreground mb-1">{job.title}</h4>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>
                <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{job.salary}</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Posted {job.posted}</span>
                <span className="flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />Deadline: {job.deadline}</span>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-foreground">{job.applicants}</span>
                <span className="text-xs text-muted-foreground">{t("jobprovider.applicants")}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => router.push("/jobprovider/candidates")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" /> {t("jobprovider.viewApps")}
                </button>
                <button
                  onClick={() => toggleStatus(job.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors"
                >
                  {job.status === "active" ? <><Pause className="h-3.5 w-3.5" /> {t("jobprovider.pause")}</> : <><Play className="h-3.5 w-3.5" /> {t("jobprovider.activate")}</>}
                </button>
                <button
                  onClick={() => router.push("/jobprovider/post-job")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-600 hover:bg-amber-500/10 transition-colors"
                >
                  <Megaphone className="h-3.5 w-3.5" /> Boost Job
                </button>
                <button className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </motion.div>
  );
}
