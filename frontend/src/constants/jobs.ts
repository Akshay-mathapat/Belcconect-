import {
  Zap,
  Droplets,
  Sparkles,
  Wind,
  Hammer,
  Paintbrush,
  Scissors,
  Car,
  ShieldCheck,
  Truck,
  Monitor,
  FileText,
  ShoppingBag,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

export interface JobCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  aliases?: string[];
}

/**
 * Standardized single source of truth for Job Categories across BelConnect:
 * Used consistently in:
 * - Public Job Portal Search & Filter (/jobs)
 * - Employer Post Job Panel (/jobprovider/post-job)
 * - Jobs API query filtering (/api/jobs)
 */
export const JOB_CATEGORIES: JobCategory[] = [
  { id: "Electrical", label: "Electrical", icon: Zap },
  { id: "Plumbing", label: "Plumbing", icon: Droplets },
  { id: "Cleaning", label: "Cleaning", icon: Sparkles },
  {
    id: "HVAC & AC Repair",
    label: "HVAC & AC Repair",
    icon: Wind,
    aliases: ["HVAC / AC", "AC Repair", "HVAC"],
  },
  { id: "Carpentry", label: "Carpentry", icon: Hammer },
  { id: "Painting", label: "Painting", icon: Paintbrush },
  {
    id: "Salon & Beauty",
    label: "Salon & Beauty",
    icon: Scissors,
    aliases: ["Salon"],
  },
  { id: "Automotive", label: "Automotive", icon: Car },
  { id: "Security", label: "Security", icon: ShieldCheck },
  {
    id: "Delivery & Logistics",
    label: "Delivery & Logistics",
    icon: Truck,
    aliases: ["Delivery", "Logistics"],
  },
  { id: "IT & Tech", label: "IT & Tech", icon: Monitor },
  {
    id: "Administration",
    label: "Administration & Office",
    icon: FileText,
    aliases: ["Office", "Administration & Office"],
  },
  { id: "Retail & Sales", label: "Retail & Sales", icon: ShoppingBag },
  { id: "Other", label: "Other", icon: MoreHorizontal },
];

