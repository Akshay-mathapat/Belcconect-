import { JobStatus, AppStatus } from "./types";

/**
 * Shared UI Tokens, Status Badges, and Animation Variants for Job Provider Workspace.
 * Separated from mock data to ensure mock fixtures are completely isolated.
 */
export const statusColors: Record<JobStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  paused: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  closed: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

export const appStatusColors: Record<AppStatus, string> = {
  new: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  reviewed: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  shortlisted: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  hired: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  rejected: "bg-red-500/10 text-red-500 border-red-500/20",
};

export const panelVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18 } },
};

