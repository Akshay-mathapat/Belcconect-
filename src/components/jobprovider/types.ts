export type ActivePanel =
  | "overview"
  | "business-profile"
  | "post-job"
  | "my-jobs"
  | "applications"
  | "shortlisted"
  | "promote"
  | "messages"
  | "settings";

export type JobStatus = "active" | "paused" | "closed";
export type AppStatus = "new" | "reviewed" | "shortlisted" | "hired" | "rejected";

export interface Job {
  id: string;
  title: string;
  type: string;
  location: string;
  salary: string;
  applicants: number;
  status: JobStatus;
  posted: string;
  deadline: string;
}

export interface Applicant {
  id: string;
  name: string;
  role: string;
  jobTitle: string;
  appliedOn: string;
  experience: string;
  location: string;
  status: AppStatus;
  avatar: string;
  email: string;
  phone: string;
}

export interface Message {
  id: string;
  from: string;
  preview: string;
  time: string;
  unread: boolean;
  avatar: string;
}
