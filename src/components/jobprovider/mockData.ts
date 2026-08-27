import { Job, Applicant, Message, JobStatus, AppStatus } from "./types";

export const MOCK_JOBS: Job[] = [
  { id: "J-001", title: "Senior Electrician", type: "Full-time", location: "Belagavi", salary: "Competitive", applicants: 18, status: "active", posted: "3 days ago", deadline: "Aug 15, 2026" },
  { id: "J-002", title: "Plumbing Supervisor", type: "Contract", location: "Hubli", salary: "As per industry standards", applicants: 9, status: "active", posted: "1 week ago", deadline: "Aug 20, 2026" },
  { id: "J-003", title: "HVAC Technician", type: "Part-time", location: "Dharwad", salary: "Best in industry", applicants: 5, status: "paused", posted: "2 weeks ago", deadline: "Sep 1, 2026" },
  { id: "J-004", title: "Cleaning Team Lead", type: "Full-time", location: "Belagavi", salary: "Disclosed on interview", applicants: 24, status: "closed", posted: "1 month ago", deadline: "Jul 10, 2026" },
];

export const MOCK_APPLICANTS: Applicant[] = [
  { id: "A-001", name: "Ramesh Kumar", role: "Electrician", jobTitle: "Senior Electrician", appliedOn: "Jul 28", experience: "6 yrs", location: "Belagavi", status: "new", avatar: "RK", email: "ramesh@example.com", phone: "+91 9876543210" },
  { id: "A-002", name: "Priya Nair", role: "Team Lead", jobTitle: "Cleaning Team Lead", appliedOn: "Jul 27", experience: "4 yrs", location: "Belgaum", status: "shortlisted", avatar: "PN", email: "priya@example.com", phone: "+91 9876543211" },
  { id: "A-003", name: "Suresh Patil", role: "Plumber", jobTitle: "Plumbing Supervisor", appliedOn: "Jul 26", experience: "8 yrs", location: "Hubli", status: "reviewed", avatar: "SP", email: "suresh@example.com", phone: "+91 9876543212" },
  { id: "A-004", name: "Kavita Desai", role: "HVAC Tech", jobTitle: "HVAC Technician", appliedOn: "Jul 25", experience: "3 yrs", location: "Dharwad", status: "rejected", avatar: "KD", email: "kavita@example.com", phone: "+91 9876543213" },
  { id: "A-005", name: "Arjun Shetty", role: "Electrician", jobTitle: "Senior Electrician", appliedOn: "Jul 24", experience: "5 yrs", location: "Belagavi", status: "hired", avatar: "AS", email: "arjun@example.com", phone: "+91 9876543214" },
  { id: "A-006", name: "Meena Gowda", role: "Cleaner", jobTitle: "Cleaning Team Lead", appliedOn: "Jul 23", experience: "2 yrs", location: "Belagavi", status: "new", avatar: "MG", email: "meena@example.com", phone: "+91 9876543215" },
];

export const MOCK_MESSAGES: Message[] = [
  { id: "M-001", from: "Arjun Shetty", preview: "Thank you for shortlisting me! When can I expect...", time: "10:34 AM", unread: true, avatar: "AS" },
  { id: "M-002", from: "Priya Nair", preview: "I wanted to follow up on my application for the...", time: "Yesterday", unread: true, avatar: "PN" },
  { id: "M-003", from: "Suresh Patil", preview: "Could you share more details about the contract...", time: "Jul 27", unread: false, avatar: "SP" },
  { id: "M-004", from: "Ramesh Kumar", preview: "I have attached my updated resume. Please let me know...", time: "Jul 26", unread: false, avatar: "RK" },
];

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
