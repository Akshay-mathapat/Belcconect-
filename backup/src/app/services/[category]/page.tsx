"use client";

import Navigation from "@/components/sections/Navigation";
import Footer from "@/components/sections/Footer";
import { motion } from "framer-motion";
import { ArrowLeft, Star, Clock, MapPin, Search, User } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";

import { SERVICE_CATEGORIES } from "@/constants/site";

export default function ServicesCategoryPage() {
  const params = useParams();
  const categoryId = params.category as string;
  const category = SERVICE_CATEGORIES.find(c => c.id === categoryId) || { name: "Services", description: "Explore our verified professionals.", startingPrice: 199 };

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("Recommended");
  const [dbPros, setDbPros] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchCategoryServices = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/services?category=${encodeURIComponent(categoryId)}`);
        if (res.ok) {
          const data = await res.json();
          setDbPros(data);
        }
      } catch (e) {
        console.error("Failed to load category services:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCategoryServices();
  }, [categoryId]);

  const mockPros = [
    { id: "mock-1", name: "Ramesh Sharma", rating: 4.9, reviews: 128, jobs: 450, exp: 8, serviceName: "AC Repair & Servicing", basePrice: 499, description: "Professional AC repair and maintenance.", serviceId: undefined, providerId: "1" },
    { id: "mock-2", name: "Suresh Kumar", rating: 4.7, reviews: 85, jobs: 310, exp: 5, serviceName: "Electrician Works", basePrice: 299, description: "General electrical repairs and installations.", serviceId: undefined, providerId: "2" },
    { id: "mock-3", name: "Anil Desai", rating: 4.8, reviews: 104, jobs: 385, exp: 12, serviceName: "Plumbing Services", basePrice: 349, description: "Leakages fixing, pipeline repairs.", serviceId: undefined, providerId: "3" },
    { id: "mock-4", name: "Priya Patil", rating: 5.0, reviews: 62, jobs: 190, exp: 4, serviceName: "Home Cleaning", basePrice: 599, description: "Deep cleaning, dusting, and sanitation.", serviceId: undefined, providerId: "4" },
  ];

  const dbFormatted = dbPros.map(srv => ({
    id: srv.id,
    name: srv.providerName || "Professional",
    rating: srv.rating || 5.0,
    reviews: srv.reviews || 0,
    jobs: srv.jobs || 12,
    exp: srv.exp || 3,
    providerId: srv.providerId,
    serviceId: srv.id,
    serviceName: srv.name,
    description: srv.description,
    basePrice: srv.basePrice
  }));

  const combinedPros = [...dbFormatted, ...mockPros];

  // Apply sorting and filtering
  const filteredPros = combinedPros
    .filter(pro => 
      pro.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      pro.serviceName.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "Rating: High to Low") return b.rating - a.rating;
      if (sortBy === "Most Experienced") return b.exp - a.exp;
      return 0; // Recommended (default order)
    });

  return (
    <main className="min-h-screen bg-muted/10 text-foreground flex flex-col">
      <Navigation />
      
      <div className="flex-1 pt-24 pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          <div className="mb-6">
            <Link href="/services" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to all categories
            </Link>
          </div>

          {/* Header */}
          <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl sm:text-4xl font-heading font-bold tracking-tight text-foreground mb-3 capitalize"
              >
                {category.name}
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-muted-foreground max-w-2xl"
              >
                {category.description}
              </motion.p>
            </div>
            
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="relative w-full md:w-72"
            >
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-border rounded-xl bg-card focus:bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm text-foreground placeholder-muted-foreground"
                placeholder="Search professionals..."
              />
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar Filters */}
            <div className="lg:col-span-1 space-y-6">
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-semibold text-foreground mb-4">Sort By</h3>
                <div className="space-y-3">
                  {["Recommended", "Rating: High to Low", "Most Experienced"].map((sort, i) => (
                    <label key={i} className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="radio" 
                        name="sort" 
                        checked={sortBy === sort}
                        onChange={() => setSortBy(sort)}
                        className="text-primary focus:ring-primary bg-background border-border" 
                      />
                      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{sort}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Professionals List */}
            <div className="lg:col-span-3 space-y-4">
              {filteredPros.map((pro, index) => (
                <motion.div
                  key={pro.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="rounded-2xl border border-border bg-card p-5 sm:p-6 transition-all hover:shadow-lg hover:border-primary/30 flex flex-col sm:flex-row gap-5"
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
                      <div>
                        <h3 className="text-lg font-bold text-foreground flex flex-wrap items-center gap-2">
                          {pro.name}
                          {pro.serviceId && (
                            <span className="text-xs font-semibold text-primary-foreground bg-primary/80 px-2 py-0.5 rounded-lg">
                              {pro.serviceName}
                            </span>
                          )}
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">Verified</span>
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1 text-amber-500 font-medium">
                            <Star className="h-3.5 w-3.5 fill-amber-500" />
                            {pro.rating} ({pro.reviews})
                          </span>
                          <span>•</span>
                          <span>{pro.jobs} jobs done</span>
                          <span>•</span>
                          <span>{pro.exp} yrs exp</span>
                          <span>•</span>
                          <span className="font-semibold text-foreground">₹{pro.basePrice} onwards</span>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-3 mb-4">
                      {pro.description || `Experienced professional providing top-quality ${category.name.toLowerCase()} with a focus on reliability and customer satisfaction.`}
                    </p>
                    
                    <div className="flex items-center gap-3">
                      <Link 
                        href={pro.serviceId 
                          ? `/book?pro=${pro.providerId}&service=${encodeURIComponent(pro.serviceName)}&price=${pro.basePrice}&proName=${encodeURIComponent(pro.name)}`
                          : `/book?pro=${pro.providerId}&service=${categoryId}`
                        }
                        className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-md"
                      >
                        Book Now
                      </Link>
                      <Link 
                        href={`/provider/${pro.providerId}`}
                        className="inline-flex items-center justify-center rounded-xl border border-border bg-transparent px-5 py-2 text-sm font-semibold text-foreground transition-all hover:bg-muted"
                      >
                        View Profile
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          
        </div>
      </div>
      
      <Footer />
    </main>
  );
}
