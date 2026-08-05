/* ═══════ Configurable Brand Name ═══════ */
export const SITE_NAME = "BelConnect";

/* ═══════ Service Categories ═══════ */
export const SERVICE_CATEGORIES = [
  { id: "electrical", name: "Electrical", i18nKey: "services.electrical", icon: "Zap", description: "Expert electricians for all your wiring and repair needs.", gradient: "from-blue-500/10 to-cyan-500/10", iconColor: "text-blue-500" },
  { id: "plumbing", name: "Plumbing", i18nKey: "services.plumbing", icon: "Droplets", description: "Reliable plumbers for leaks, installations, and repairs.", gradient: "from-blue-500/10 to-cyan-500/10", iconColor: "text-blue-500" },
  { id: "cleaning", name: "Cleaning", i18nKey: "services.cleaning", icon: "Sparkles", description: "Deep cleaning for homes, offices, and furniture.", gradient: "from-emerald-500/10 to-green-500/10", iconColor: "text-emerald-500" },
  { id: "pest-control", name: "Pest Control", i18nKey: "services.pestControl", icon: "Bug", description: "Complete pest control solutions for safe environments.", gradient: "from-red-500/10 to-rose-500/10", iconColor: "text-red-500" },
  { id: "ac-repair", name: "AC Repair", i18nKey: "services.acRepair", icon: "Wind", description: "Repair and service for all major home appliances.", gradient: "from-sky-500/10 to-blue-500/10", iconColor: "text-sky-500" },
  { id: "painting", name: "Painting", i18nKey: "services.painting", icon: "PaintBucket", description: "Professional painting services for home makeovers.", gradient: "from-violet-500/10 to-purple-500/10", iconColor: "text-violet-500" },
  { id: "salon", name: "Salon at Home", i18nKey: "services.salon", icon: "Scissors", description: "Premium beauty and grooming services at your doorstep.", gradient: "from-pink-500/10 to-rose-500/10", iconColor: "text-pink-500" },
  { id: "carpentry", name: "Carpentry", i18nKey: "services.carpentry", icon: "Hammer", description: "Custom woodwork, furniture repair, and assembly.", gradient: "from-blue-600/10 to-sky-500/10", iconColor: "text-blue-600" },
  { id: "education", name: "Education & Tutors", i18nKey: "services.education", icon: "GraduationCap", description: "Expert tutors for academics and skill development.", gradient: "from-indigo-500/10 to-blue-500/10", iconColor: "text-indigo-500" },
  { id: "it", name: "IT Support", i18nKey: "services.it", icon: "Monitor", description: "Tech support for devices, networks, and software.", gradient: "from-fuchsia-500/10 to-pink-500/10", iconColor: "text-fuchsia-500" },
  { id: "pet-care", name: "Pet Care", i18nKey: "services.petCare", icon: "PawPrint", description: "Grooming, walking, and care for your furry friends.", gradient: "from-teal-500/10 to-emerald-500/10", iconColor: "text-teal-500" },
] as const;

/* ═══════ Trust Metrics ═══════ */
export const TRUST_METRICS = [
  { value: 10000, suffix: "+", i18nKey: "trust.bookings" },
  { value: 500, suffix: "+", i18nKey: "trust.professionals" },
  { value: 4.8, suffix: "", i18nKey: "trust.rating", isDecimal: true },
  { value: 15, suffix: "+", i18nKey: "trust.categories" },
] as const;

/* ═══════ Testimonials ═══════ */
export const TESTIMONIALS = [
  { name: "Priya Sharma", service: "Home Cleaning", rating: 5, quote: "Absolutely spotless work! The team was professional, and thorough. Will definitely book again.", avatar: "PS" },
  { name: "Rahul Kulkarni", service: "AC Repair", rating: 5, quote: "Fixed my AC quickly. Great quality work with no hidden surprises. Highly recommend!", avatar: "RK" },
  { name: "Anita Desai", service: "Salon at Home", rating: 5, quote: "Best salon experience without leaving home. The stylist was skilled and used premium products.", avatar: "AD" },
  { name: "Vikram Patil", service: "Electrical", rating: 4, quote: "Quick response. Fixed all wiring issues professionally. Great service.", avatar: "VP" },
  { name: "Sneha Joshi", service: "Plumbing", rating: 5, quote: "Emergency plumbing fixed right away! The support is a lifesaver. Thank you CityConnect!", avatar: "SJ" },
  { name: "Amit Hegde", service: "Painting", rating: 5, quote: "Transformed our entire apartment. Clean work, no mess left behind. Worth every rupee.", avatar: "AH" },
] as const;

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
  { i18nKey: "nav.providers", href: "/register/provider", label: "Join as Provider" },
] as const;

/* ═══════ Search Placeholder Suggestions ═══════ */
export const SEARCH_SUGGESTIONS = [
  "Painter",
  "Electrician",
  "Plumber",
  "Tutor",
  "Technician",
  "AC Repair",
  "Salon at Home",
  "Carpenter",
  "Pest Control",
  "Pet Care",
  "IT Support",
  "Cleaner",
] as const;

/* ═══════ Service Taxonomy (Mega Menu) ═══════ */
export const SERVICE_TAXONOMY = [
  {
    section: "Home & Property",
    items: [
      {
        id: "repairs",
        name: "Home Repairs & Maintenance",
        services: ["electrical", "plumbing", "ac-repair", "carpentry"]
      },
      {
        id: "cleaning",
        name: "Cleaning & Pest Control",
        services: ["cleaning", "pest-control"]
      },
      {
        id: "renovations",
        name: "Renovations & Improvements",
        services: ["painting"]
      }
    ]
  },
  {
    section: "Lifestyle & Professional",
    items: [
      {
        id: "personal",
        name: "Personal Care",
        services: ["salon", "pet-care"]
      },
      {
        id: "tech-education",
        name: "Tech & Education",
        services: ["it", "education"]
      }
    ]
  }
] as const;
