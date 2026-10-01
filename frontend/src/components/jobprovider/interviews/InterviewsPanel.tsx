"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  Video,
  Phone,
  MapPin,
  CheckCircle2,
  XCircle,
  Users,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { panelVariants } from "../mockData";

interface InterviewItem {
  id: string;
  job_id: string;
  application_id: string;
  candidate_id: string;
  candidate_name: string;
  job_title: string;
  interview_date: string;
  interview_time: string;
  interview_mode: string;
  meeting_link: string | null;
  location_details: string | null;
  status: "scheduled" | "completed" | "rescheduled" | "cancelled";
  notes: string | null;
  candidate_email: string;
  candidate_phone: string | null;
}

export function InterviewsPanel() {
  const router = useRouter();
  const [interviews, setInterviews] = useState<InterviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<"all" | "scheduled" | "completed" | "cancelled">("all");

  useEffect(() => {
    fetchInterviews();
  }, [filterTab]);

  const fetchInterviews = async () => {
    setLoading(true);
    try {
      const url = filterTab === "all" ? "/api/jobprovider/interviews" : `/api/jobprovider/interviews?status=${filterTab}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setInterviews(data.interviews || []);
      }
    } catch (err) {
      console.error("Fetch interviews error:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (interviewId: string, status: string) => {
    try {
      const res = await fetch("/api/jobprovider/interviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId, status }),
      });
      if (res.ok) {
        setInterviews((prev) =>
          prev.map((i) => (i.id === interviewId ? { ...i, status: status as any } : i))
        );
      }
    } catch (err) {
      console.error("Update interview error:", err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "completed":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "cancelled":
        return "bg-rose-500/10 text-rose-500 border-rose-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <motion.div {...panelVariants} className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Interview Schedule
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Coordinate upcoming calls and in-person interviews with shortlisted candidates
          </p>
        </div>

        <button
          onClick={() => router.push("/jobprovider/candidates")}
          className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-colors shadow-sm self-start sm:self-auto cursor-pointer"
        >
          View Candidates to Schedule
        </button>
      </div>

      {/* ── Filter Tabs ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        {(["all", "scheduled", "completed", "cancelled"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-colors cursor-pointer shrink-0 ${
              filterTab === tab
                ? "bg-violet-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Interviews List ───────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-2xl border border-border bg-card p-5 animate-pulse space-y-3">
              <div className="h-4 w-1/3 bg-muted rounded" />
              <div className="h-3 w-1/4 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : interviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-3">
          <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <h3 className="text-base font-bold text-foreground">No interviews found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {filterTab === "all"
              ? "You haven't scheduled any candidate interviews yet. Review applicants and click Schedule Interview to invite them."
              : `No interviews with status "${filterTab}".`}
          </p>
          <button
            onClick={() => router.push("/jobprovider/candidates")}
            className="px-5 py-2.5 rounded-xl bg-violet-600 text-white font-bold text-xs hover:bg-violet-700 transition-colors"
          >
            Go to Candidates
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {interviews.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${getStatusBadge(item.status)}`}>
                      ● {item.status}
                    </span>
                    <span className="text-xs text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                      {item.interview_mode === "Video" ? <Video className="h-3 w-3" /> : item.interview_mode === "Phone" ? <Phone className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                      {item.interview_mode} Interview
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    {item.candidate_name}
                  </h3>

                  <p className="text-xs text-muted-foreground">
                    For position <strong className="text-foreground">{item.job_title}</strong>
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <Calendar className="h-3.5 w-3.5 text-blue-600" />
                      {new Date(item.interview_date).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <Clock className="h-3.5 w-3.5 text-violet-600" />
                      {item.interview_time}
                    </span>
                    {item.candidate_phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {item.candidate_phone}
                      </span>
                    )}
                  </div>

                  {item.meeting_link && (
                    <div className="pt-2">
                      <a
                        href={item.meeting_link.startsWith("http") ? item.meeting_link : `https://${item.meeting_link}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs hover:bg-blue-500/20 transition-colors"
                      >
                        <Video className="h-3.5 w-3.5" /> Open Video Call Link
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}

                  {item.notes && (
                    <p className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-xl mt-2">
                      <strong className="text-foreground">Notes:</strong> {item.notes}
                    </p>
                  )}
                </div>

                {/* Right Status Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {item.status === "scheduled" && (
                    <>
                      <button
                        onClick={() => updateStatus(item.id, "completed")}
                        className="px-3 py-1.5 rounded-xl border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark Done
                      </button>
                      <button
                        onClick={() => updateStatus(item.id, "cancelled")}
                        className="px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
