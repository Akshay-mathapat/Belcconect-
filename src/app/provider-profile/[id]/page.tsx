"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Footer from "@/components/sections/Footer";
import { motion } from "framer-motion";
import { 
  Star, 
  Phone, 
  Mail, 
  Award, 
  ArrowLeft, 
  CheckCircle2, 
  Briefcase, 
  Clock, 
  MapPin, 
  Loader2, 
  User, 
  AlertCircle 
} from "lucide-react";

interface ProviderData {
  provider: {
    id: string;
    name: string;
    phone: string;
    email: string;
    avatar: string;
    experience: number;
    bio: string;
  };
  services: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    base_price: number;
  }>;
  reviews: Array<{
    customer_name: string;
    customer_photo: string;
    rating: number;
    comment: string;
    date: string;
    service_name: string;
  }>;
}

export default function ProviderProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<ProviderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/providers/${id}`);
        if (!res.ok) {
          throw new Error("Provider profile not found");
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || "Failed to load provider profile");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
        <p className="text-sm text-muted-foreground font-medium">Loading professional profile...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] p-4 text-center">
        <AlertCircle className="h-10 w-10 text-rose-500 mb-2" />
        <h3 className="text-lg font-bold text-foreground">Failed to Load Profile</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">{error || "The requested service provider profile could not be retrieved."}</p>
        <Link 
          href="/account"
          className="mt-6 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const { provider, services, reviews } = data;
  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
    : "0.0";

  return (
    <main className="min-h-screen bg-muted/10 text-foreground flex flex-col">
      <div className="flex-1 pt-8 pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          
          {/* Back Action */}
          <div className="mb-6">
            <button 
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 text-blue-600" />
              <span>Back</span>
            </button>
          </div>

          {/* Grid Container */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Provider Card */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Profile Card */}
              <div className="rounded-3xl border border-border bg-card p-6 shadow-xl relative overflow-hidden flex flex-col items-center text-center">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 to-teal-500" />
                
                {/* Avatar */}
                <img 
                  src={provider.avatar} 
                  alt={provider.name} 
                  className="w-24 h-24 rounded-full object-cover border-2 border-border shadow-md mt-2"
                />

                {/* Verification Badge */}
                <span className="mt-4 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-teal-600 bg-teal-500/10 border border-teal-500/20">
                  <CheckCircle2 className="h-3 w-3" />
                  Verified Expert
                </span>

                <h1 className="text-xl font-heading font-extrabold text-foreground mt-3">{provider.name}</h1>
                <p className="text-xs text-muted-foreground mt-1">Belagavi Service Partner</p>

                {/* Rating Banner */}
                <div className="flex items-center gap-1.5 mt-4 bg-muted/50 px-3 py-1.5 rounded-xl border border-border">
                  <Star className="h-4 w-4 fill-[#D4A017] text-[#D4A017]" />
                  <span className="text-xs font-bold text-foreground">{avgRating}</span>
                  <span className="text-[10px] text-muted-foreground">({totalReviews} Reviews)</span>
                </div>

                {/* Divider */}
                <div className="w-full border-t border-border my-6" />

                {/* Details list */}
                <div className="w-full space-y-4 text-left">
                  <div className="flex items-center gap-3 text-xs">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                      <Briefcase className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Experience</span>
                      <span className="font-bold text-foreground">{provider.experience} Years</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Phone</span>
                      <span className="font-semibold text-foreground">{provider.phone}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email</span>
                      <span className="font-semibold text-foreground truncate max-w-[180px] block">{provider.email}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bio Card */}
              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-blue-600" />
                  Biography
                </h3>
                <p className="text-xs text-foreground/80 leading-relaxed font-medium">
                  {provider.bio}
                </p>
              </div>
            </div>

            {/* Right Column: Offerings & Reviews */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Offerings Section */}
              <div className="space-y-4">
                <div className="border-b border-border pb-2">
                  <h2 className="font-heading text-lg font-bold text-foreground">Services Offered</h2>
                  <p className="text-xs text-muted-foreground">Direct pricing models backed by professional execution</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {services.length > 0 ? (
                    services.map((srv) => (
                      <div key={srv.id} className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between hover:border-blue-500/40 transition-colors">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-[#1F5F5B] bg-[#1F5F5B]/10 px-2 py-0.5 rounded-full capitalize">
                              {srv.category}
                            </span>
                            <span className="text-sm font-extrabold text-foreground">₹{srv.base_price}</span>
                          </div>
                          <h4 className="text-sm font-bold text-foreground">{srv.name}</h4>
                          <p className="text-xs text-muted-foreground mt-2 leading-relaxed font-medium line-clamp-3">
                            {srv.description || "Professional service delivered at standard upfront pricing."}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-border/60">
                          <Link 
                            href={`/book?pro=${provider.id}&service=${encodeURIComponent(srv.name)}`}
                            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs inline-flex items-center justify-center gap-1"
                          >
                            Book Service
                          </Link>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 py-8 text-center border border-dashed border-border rounded-2xl bg-card">
                      <p className="text-xs text-muted-foreground">No active services listed currently.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Reviews Section */}
              <div className="space-y-4">
                <div className="border-b border-border pb-2">
                  <h2 className="font-heading text-lg font-bold text-foreground">Customer Reviews</h2>
                  <p className="text-xs text-muted-foreground">Verifiable rating history left by recent customers</p>
                </div>

                <div className="space-y-4">
                  {reviews.length > 0 ? (
                    reviews.map((rev, index) => (
                      <div key={index} className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <img 
                              src={rev.customer_photo || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"}
                              alt={rev.customer_name}
                              className="w-9 h-9 rounded-full object-cover border border-border"
                            />
                            <div>
                              <h5 className="text-xs font-bold text-foreground">{rev.customer_name}</h5>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-0.5">
                                  {Array.from({ length: rev.rating }).map((_, i) => (
                                    <Star key={i} className="h-3 w-3 fill-[#D4A017] text-[#D4A017]" />
                                  ))}
                                </div>
                                <span className="text-[10px] text-muted-foreground">• {rev.date}</span>
                              </div>
                            </div>
                          </div>
                          
                          <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {rev.service_name}
                          </span>
                        </div>

                        <p className="text-xs text-foreground/80 leading-relaxed font-medium pl-1">
                          "{rev.comment}"
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="py-10 text-center border border-dashed border-border rounded-2xl bg-card">
                      <Star className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <h4 className="text-xs font-bold text-foreground">No Reviews Posted</h4>
                      <p className="text-[10px] text-muted-foreground max-w-xs mx-auto mt-1">This provider hasn't received reviews for completed bookings yet.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
      <Footer />
    </main>
  );
}
