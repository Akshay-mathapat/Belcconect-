/* ═══════ Configurable Brand Name ═══════ */
export const SITE_NAME = "BelConnect";

export interface ServiceCategory {
  id: string;
  name: string;
  group: string;
  i18nKey: string;
  icon: string;
  description: string;
  gradient: string;
  iconColor: string;
}

/* ═══════ Service Categories (All 33 Services) ═══════ */
export const SERVICE_CATEGORIES: readonly ServiceCategory[] = [
  // 1. Home Maintenance
  {
    id: "electrical",
    name: "Electrical",
    group: "Home Maintenance",
    i18nKey: "services.electrical",
    icon: "Zap",
    description: "Expert electricians for wiring, fixtures, switches, and home power solutions.",
    gradient: "from-amber-500/10 to-yellow-500/10",
    iconColor: "text-amber-500"
  },
  {
    id: "plumbing",
    name: "Plumbing",
    group: "Home Maintenance",
    i18nKey: "services.plumbing",
    icon: "Droplets",
    description: "Reliable plumbers for leaks, pipe fittings, sanitary installations, and drainage repairs.",
    gradient: "from-blue-500/10 to-cyan-500/10",
    iconColor: "text-blue-500"
  },
  {
    id: "carpentry",
    name: "Carpentry",
    group: "Home Maintenance",
    i18nKey: "services.carpentry",
    icon: "Hammer",
    description: "Custom woodwork, furniture repair, door lock fitting, and wood finishing.",
    gradient: "from-amber-600/10 to-orange-500/10",
    iconColor: "text-amber-600"
  },
  {
    id: "painting",
    name: "Painting",
    group: "Home Maintenance",
    i18nKey: "services.painting",
    icon: "PaintBucket",
    description: "Interior and exterior wall painting, texture designs, waterproofing, and touch-ups.",
    gradient: "from-purple-500/10 to-pink-500/10",
    iconColor: "text-purple-500"
  },
  {
    id: "handyman",
    name: "Handyman",
    group: "Home Maintenance",
    i18nKey: "services.handyman",
    icon: "Wrench",
    description: "Quick household fixes, drill & hangings, door repairs, and general odd jobs.",
    gradient: "from-orange-500/10 to-amber-500/10",
    iconColor: "text-orange-500"
  },
  {
    id: "waterproofing",
    name: "Waterproofing",
    group: "Home Maintenance",
    i18nKey: "services.waterproofing",
    icon: "Waves",
    description: "Terrace, roof, bathroom, and wall seepage waterproofing and dampness solutions.",
    gradient: "from-cyan-500/10 to-blue-500/10",
    iconColor: "text-cyan-600"
  },
  {
    id: "locksmith",
    name: "Locksmith",
    group: "Home Maintenance",
    i18nKey: "services.locksmith",
    icon: "KeyRound",
    description: "Lock repair, emergency unlocking, duplicate keys, and smart lock installations.",
    gradient: "from-yellow-500/10 to-amber-500/10",
    iconColor: "text-yellow-600"
  },

  // 2. Cleaning & Household
  {
    id: "cleaning",
    name: "Cleaning",
    group: "Cleaning & Household",
    i18nKey: "services.cleaning",
    icon: "Sparkles",
    description: "Daily and weekly home cleaning, kitchen sanitization, and floor mopping.",
    gradient: "from-emerald-500/10 to-green-500/10",
    iconColor: "text-emerald-500"
  },
  {
    id: "pest-control",
    name: "Pest Control",
    group: "Cleaning & Household",
    i18nKey: "services.pestControl",
    icon: "Bug",
    description: "Termite, cockroach, bed bug, and mosquito fumigation & pest eradication.",
    gradient: "from-rose-500/10 to-red-500/10",
    iconColor: "text-rose-500"
  },
  {
    id: "laundry",
    name: "Laundry",
    group: "Cleaning & Household",
    i18nKey: "services.laundry",
    icon: "Shirt",
    description: "Doorstep clothes washing, steam ironing, and dry cleaning pickup & delivery.",
    gradient: "from-sky-500/10 to-blue-500/10",
    iconColor: "text-sky-500"
  },
  {
    id: "deep-cleaning",
    name: "Deep Cleaning",
    group: "Cleaning & Household",
    i18nKey: "services.deepCleaning",
    icon: "SprayCan",
    description: "Full house deep scrubbing, sofa & carpet shampooing, and post-renovation cleanup.",
    gradient: "from-teal-500/10 to-emerald-500/10",
    iconColor: "text-teal-500"
  },
  {
    id: "gardening",
    name: "Gardening",
    group: "Cleaning & Household",
    i18nKey: "services.gardening",
    icon: "Leaf",
    description: "Lawn mowing, plant pruning, balcony garden setup, and soil fertilizing.",
    gradient: "from-green-500/10 to-emerald-500/10",
    iconColor: "text-green-600"
  },
  {
    id: "packers-movers",
    name: "Packers & Movers",
    group: "Cleaning & Household",
    i18nKey: "services.packersMovers",
    icon: "Truck",
    description: "Safe household shifting, bubble wrapping, transport, and office relocation.",
    gradient: "from-indigo-500/10 to-blue-500/10",
    iconColor: "text-indigo-600"
  },

  // 3. Appliance & Technical
  {
    id: "ac-repair",
    name: "AC Repair",
    group: "Appliance & Technical",
    i18nKey: "services.acRepair",
    icon: "Wind",
    description: "Air conditioner servicing, gas charging, cooling issues, and uninstallation.",
    gradient: "from-blue-500/10 to-indigo-500/10",
    iconColor: "text-blue-500"
  },
  {
    id: "appliance-repair",
    name: "Appliance Repair",
    group: "Appliance & Technical",
    i18nKey: "services.applianceRepair",
    icon: "Refrigerator",
    description: "Washing machine, refrigerator, microwave oven, and geyser repair specialists.",
    gradient: "from-sky-500/10 to-cyan-500/10",
    iconColor: "text-sky-600"
  },
  {
    id: "ro-repair",
    name: "RO Repair",
    group: "Appliance & Technical",
    i18nKey: "services.roRepair",
    icon: "Filter",
    description: "Water purifier filter replacement, RO membrane cleaning, and TDS tuning.",
    gradient: "from-cyan-500/10 to-teal-500/10",
    iconColor: "text-cyan-500"
  },
  {
    id: "computer-repair",
    name: "Computer Repair",
    group: "Appliance & Technical",
    i18nKey: "services.computerRepair",
    icon: "Laptop",
    description: "Laptop and desktop hardware troubleshooting, screen fix, and OS installation.",
    gradient: "from-violet-500/10 to-purple-500/10",
    iconColor: "text-violet-500"
  },
  {
    id: "it",
    name: "IT Support",
    group: "Appliance & Technical",
    i18nKey: "services.it",
    icon: "Monitor",
    description: "Home & office Wi-Fi setup, router configuration, printer support, and networking.",
    gradient: "from-fuchsia-500/10 to-pink-500/10",
    iconColor: "text-fuchsia-500"
  },
  {
    id: "cctv",
    name: "CCTV & Security",
    group: "Appliance & Technical",
    i18nKey: "services.cctv",
    icon: "ShieldCheck",
    description: "Security camera installation, DVR/NVR setup, mobile view configuration, and wiring.",
    gradient: "from-slate-500/10 to-zinc-500/10",
    iconColor: "text-slate-600"
  },
  {
    id: "solar",
    name: "Solar Services",
    group: "Appliance & Technical",
    i18nKey: "services.solar",
    icon: "SunMedium",
    description: "Rooftop solar panel maintenance, inverter checking, and solar system cleaning.",
    gradient: "from-amber-500/10 to-orange-500/10",
    iconColor: "text-amber-500"
  },

  // 4. Personal & Lifestyle
  {
    id: "salon",
    name: "Salon at Home",
    group: "Personal & Lifestyle",
    i18nKey: "services.salon",
    icon: "Scissors",
    description: "Doorstep haircuts, facials, waxing, manicures, and grooming for men and women.",
    gradient: "from-pink-500/10 to-rose-500/10",
    iconColor: "text-pink-500"
  },
  {
    id: "pet-care",
    name: "Pet Care",
    group: "Personal & Lifestyle",
    i18nKey: "services.petCare",
    icon: "PawPrint",
    description: "Pet grooming, dog walking, sitting, bathing, and vet consultation support.",
    gradient: "from-emerald-500/10 to-teal-500/10",
    iconColor: "text-emerald-500"
  },
  {
    id: "fitness",
    name: "Fitness & Yoga",
    group: "Personal & Lifestyle",
    i18nKey: "services.fitness",
    icon: "Dumbbell",
    description: "Personal fitness trainers, home yoga instructors, and personalized wellness coaching.",
    gradient: "from-orange-500/10 to-red-500/10",
    iconColor: "text-orange-500"
  },
  {
    id: "baby-care",
    name: "Baby Care",
    group: "Personal & Lifestyle",
    i18nKey: "services.babyCare",
    icon: "Baby",
    description: "Verified babysitters, trained infant nannies, and gentle mother-baby assistance.",
    gradient: "from-rose-400/10 to-pink-400/10",
    iconColor: "text-rose-400"
  },
  {
    id: "elderly-care",
    name: "Elderly Care",
    group: "Personal & Lifestyle",
    i18nKey: "services.elderlyCare",
    icon: "HeartHandshake",
    description: "Compassionate in-home senior care, mobility assistance, and patient support.",
    gradient: "from-red-500/10 to-rose-500/10",
    iconColor: "text-red-500"
  },
  {
    id: "education",
    name: "Education & Tutors",
    group: "Personal & Lifestyle",
    i18nKey: "services.education",
    icon: "GraduationCap",
    description: "Home and online tutors for school subjects, languages, and skill learning.",
    gradient: "from-indigo-500/10 to-violet-500/10",
    iconColor: "text-indigo-500"
  },

  // 5. Automotive & Events
  {
    id: "car-repair",
    name: "Car Repair",
    group: "Automotive & Events",
    i18nKey: "services.carRepair",
    icon: "Car",
    description: "Doorstep car servicing, battery jumpstart, breakdown mechanics, and cleaning.",
    gradient: "from-blue-600/10 to-indigo-600/10",
    iconColor: "text-blue-600"
  },
  {
    id: "bike-repair",
    name: "Bike Repair",
    group: "Automotive & Events",
    i18nKey: "services.bikeRepair",
    icon: "Bike",
    description: "Two-wheeler breakdown mechanics, oil change, tyre puncture, and servicing.",
    gradient: "from-amber-500/10 to-yellow-600/10",
    iconColor: "text-amber-600"
  },
  {
    id: "driver-services",
    name: "Driver Services",
    group: "Automotive & Events",
    i18nKey: "services.driverServices",
    icon: "CarFront",
    description: "Verified on-demand professional drivers for city commutes or outstation travel.",
    gradient: "from-emerald-600/10 to-teal-600/10",
    iconColor: "text-emerald-600"
  },
  {
    id: "event-services",
    name: "Event Services",
    group: "Automotive & Events",
    i18nKey: "services.eventServices",
    icon: "PartyPopper",
    description: "Birthday, celebration, and wedding decorators, sound system, and stage setup.",
    gradient: "from-purple-500/10 to-indigo-500/10",
    iconColor: "text-purple-600"
  },
  {
    id: "photography",
    name: "Photography",
    group: "Automotive & Events",
    i18nKey: "services.photography",
    icon: "Camera",
    description: "Professional photographers for weddings, birthdays, baby shoots, and events.",
    gradient: "from-pink-500/10 to-rose-500/10",
    iconColor: "text-pink-600"
  },
  {
    id: "catering",
    name: "Catering",
    group: "Automotive & Events",
    i18nKey: "services.catering",
    icon: "Utensils",
    description: "Delicious multi-cuisine catering and buffet arrangements for family and corporate events.",
    gradient: "from-orange-500/10 to-red-500/10",
    iconColor: "text-orange-600"
  },
  {
    id: "fabricator",
    name: "Fabricator",
    group: "Automotive & Events",
    i18nKey: "services.fabricator",
    icon: "Flame",
    description: "Metal fabrication, safety grills, iron gates, shed roofing, and welding works.",
    gradient: "from-amber-600/10 to-stone-500/10",
    iconColor: "text-amber-700"
  }
] as const;

/* ═══════ Trust Metrics ═══════ */
export const TRUST_METRICS = [
  { value: 33, suffix: "+", i18nKey: "trust.categories" },
  { value: 100, suffix: "%", i18nKey: "trust.directBooking" },
  { value: 100, suffix: "%", i18nKey: "trust.localBelagavi" },
  { value: 100, suffix: "%", i18nKey: "trust.verifiedIdentity" },
] as const;

/* ═══════ Testimonials ═══════ */
export const TESTIMONIALS = [] as const;

/* ═══════ Belagavi Areas ═══════ */
export const BELAGAVI_AREAS = [
  { name: "Tilakwadi", x: 35, y: 30 },
  { name: "Shahapur", x: 55, y: 20 },
  { name: "Camp", x: 65, y: 45 },
  { name: "Vadgaon", x: 25, y: 60 },
  { name: "Angol", x: 45, y: 70 },
  { name: "Mahantesh Nagar", x: 70, y: 65 },
] as const;

/* ═══════ Nav Links ═══════ */
export const NAV_LINKS = [
  { i18nKey: "nav.home", href: "/", label: "Home" },
  { i18nKey: "nav.services", href: "/services", label: "Services" },
  { i18nKey: "nav.jobs", href: "/jobs", label: "Jobs" },
  { i18nKey: "nav.providers", href: "/auth?mode=signup&role=provider", label: "Join as Provider" },
] as const;

/* ═══════ Feature Toggles ═══════ */
export const SHOW_JOBS_NEW_TAG = true;

/* ═══════ Search Placeholder Suggestions ═══════ */
export const SEARCH_SUGGESTIONS = [
  "Electrician",
  "Plumber",
  "Carpenter",
  "Painter",
  "Handyman",
  "Waterproofing",
  "Locksmith",
  "Cleaning",
  "Pest Control",
  "Laundry",
  "Deep Cleaning",
  "Gardening",
  "Packers & Movers",
  "AC Repair",
  "Appliance Repair",
  "RO Repair",
  "Computer Repair",
  "IT Support",
  "CCTV & Security",
  "Solar Services",
  "Salon at Home",
  "Pet Care",
  "Fitness & Yoga",
  "Baby Care",
  "Elderly Care",
  "Education & Tutors",
  "Car Repair",
  "Bike Repair",
  "Driver Services",
  "Event Services",
  "Photography",
  "Catering",
  "Fabricator"
] as const;

/* ═══════ Service Taxonomy (5 Main Sections) ═══════ */
export const SERVICE_TAXONOMY = [
  {
    section: "Home Maintenance",
    items: [
      {
        id: "home-maintenance",
        name: "Home Maintenance & Repairs",
        services: [
          "electrical",
          "plumbing",
          "carpentry",
          "painting",
          "handyman",
          "waterproofing",
          "locksmith"
        ]
      }
    ]
  },
  {
    section: "Cleaning & Household",
    items: [
      {
        id: "cleaning-household",
        name: "Cleaning & Household Services",
        services: [
          "cleaning",
          "pest-control",
          "laundry",
          "deep-cleaning",
          "gardening",
          "packers-movers"
        ]
      }
    ]
  },
  {
    section: "Appliance & Technical",
    items: [
      {
        id: "appliance-technical",
        name: "Appliance & Technical Support",
        services: [
          "ac-repair",
          "appliance-repair",
          "ro-repair",
          "computer-repair",
          "it",
          "cctv",
          "solar"
        ]
      }
    ]
  },
  {
    section: "Personal & Lifestyle",
    items: [
      {
        id: "personal-lifestyle",
        name: "Personal & Lifestyle Care",
        services: [
          "salon",
          "pet-care",
          "fitness",
          "baby-care",
          "elderly-care",
          "education"
        ]
      }
    ]
  },
  {
    section: "Automotive & Events",
    items: [
      {
        id: "automotive-events",
        name: "Automotive & Event Services",
        services: [
          "car-repair",
          "bike-repair",
          "driver-services",
          "event-services",
          "photography",
          "catering",
          "fabricator"
        ]
      }
    ]
  }
] as const;
