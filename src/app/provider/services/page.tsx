"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  PlusCircle, 
  Search, 
  Wrench, 
  Star, 
  Clock, 
  MapPin, 
  Tag, 
  Trash2, 
  Edit3, 
  Copy, 
  Eye, 
  Power,
  Zap,
  CheckCircle2
} from "lucide-react";
import { useProviderStore } from "@/store/useProviderStore";

export default function ServicesManagementPage() {
  const { services, toggleServiceAvailability, deleteService, addService } = useProviderStore();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDuplicate = (serviceId: string) => {
    const s = services.find((x) => x.id === serviceId);
    if (s) {
      addService({
        ...s,
        name: `${s.name} (Copy)`
      });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            My Offered Services
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage your service offerings, prices, gallery photos, and customer availability.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search services..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-card border border-border focus:outline-none"
            />
          </div>

          <Link
            href="/provider/services/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#1F5F5B] hover:bg-[#164744] text-white text-xs font-bold shadow-md transition-all whitespace-nowrap"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Add New Service</span>
          </Link>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map((s, idx) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className={`rounded-2xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
              s.isAvailable ? "border-border" : "border-border/60 opacity-75"
            }`}
          >
            <div>
              {/* Thumbnail Header */}
              <div className="relative h-44 w-full bg-muted overflow-hidden">
                <img
                  src={s.thumbnail}
                  alt={s.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                
                {/* Category Badge */}
                <span className="absolute top-3 left-3 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white">
                  {s.category}
                </span>

                {/* Status Toggle */}
                <button
                  onClick={() => toggleServiceAvailability(s.id)}
                  className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-md flex items-center gap-1.5 transition-all ${
                    s.isAvailable 
                      ? "bg-emerald-500/80 border-emerald-400 text-white" 
                      : "bg-gray-800/80 border-gray-600 text-gray-200"
                  }`}
                >
                  <Power className="h-3 w-3" />
                  <span>{s.isAvailable ? "Active" : "Disabled"}</span>
                </button>
              </div>

              {/* Service Info Content */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1F5F5B] flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-[#D4A017] text-[#D4A017]" />
                    {s.rating} ({s.bookingsCount} bookings)
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {s.durationMinutes} mins
                  </span>
                </div>

                <h3 className="font-heading text-base font-bold text-foreground line-clamp-1">
                  {s.name}
                </h3>

                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {s.description}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Pricing</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1">
                      Mutually Decided
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block">Service Area</span>
                    <span className="font-bold text-foreground text-xs">{s.serviceRadiusKm} km radius</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Toolbar */}
            <div className="p-3 bg-muted/30 border-t border-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDuplicate(s.id)}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Duplicate Service"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deleteService(s.id)}
                  className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-colors"
                  title="Delete Service"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/services`}
                  target="_blank"
                  className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground flex items-center gap-1"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Preview</span>
                </Link>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

    </div>
  );
}
