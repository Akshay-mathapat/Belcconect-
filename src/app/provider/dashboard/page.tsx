"use client";

import Navigation from "@/components/sections/Navigation";
import Footer from "@/components/sections/Footer";
import { motion } from "framer-motion";
import { DollarSign, Briefcase, Star, Clock, ArrowRight, CheckCircle2, ChevronRight, Settings } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function ProviderDashboardPage() {
  const [activeTab, setActiveTab] = useState("overview");

  const stats = [
    { label: "Profile Views", value: "1,250", icon: Briefcase, trend: "+12.5%", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Jobs Completed", value: "142", icon: Briefcase, trend: "+4", color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Avg. Rating", value: "4.8", icon: Star, trend: "+0.1", color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Active Services", value: "3", icon: Briefcase, trend: "0", color: "text-violet-500", bg: "bg-violet-500/10" },
  ];

  const upcomingBookings = [
    { id: "B-1042", customer: "Rahul V.", service: "AC Gas Refill", date: "Today", address: "Tilakwadi, Belagavi", status: "confirmed" },
    { id: "B-1045", customer: "Sneha P.", service: "Deep Cleaning", date: "Tomorrow", address: "Hindwadi, Belagavi", status: "pending" },
    { id: "B-1048", customer: "Karan D.", service: "AC Service", date: "Oct 15", address: "Camp, Belagavi", status: "pending" },
  ];

  return (
    <main className="min-h-screen bg-muted/10 text-foreground flex flex-col">
      <Navigation />
      
      <div className="flex-1 pt-24 pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          {/* Dashboard Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground mb-1">Provider Dashboard</h1>
              <p className="text-muted-foreground">Welcome back, Ramesh. Here's what's happening with your business today.</p>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-600 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                Available for jobs
              </span>
              <button className="p-2 rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors">
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                    {stat.trend}
                  </span>
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-foreground mb-1">{stat.value}</h3>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Main Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Bookings */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Tabs */}
              <div className="flex space-x-1 rounded-xl bg-muted/50 p-1">
                {["overview", "bookings", "earnings", "reviews"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-semibold capitalize transition-all ${
                      activeTab === tab 
                        ? "bg-card text-foreground shadow-sm" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Content based on activeTab */}
              {activeTab === "overview" && (
                <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-border flex items-center justify-between">
                    <h3 className="font-semibold text-lg text-foreground">Upcoming Bookings</h3>
                    <button onClick={() => setActiveTab("bookings")} className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors">View all</button>
                  </div>
                  
                  <div className="divide-y divide-border">
                    {upcomingBookings.map((booking) => (
                      <div key={booking.id} className="p-6 transition-colors hover:bg-muted/30">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <span className="text-xs font-bold text-muted-foreground">{booking.id}</span>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                booking.status === 'confirmed' 
                                  ? "bg-emerald-500/10 text-emerald-600" 
                                  : "bg-amber-500/10 text-amber-600"
                              }`}>
                                {booking.status}
                              </span>
                            </div>
                            <h4 className="text-lg font-semibold text-foreground">{booking.service}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {booking.customer} • {booking.address}
                            </p>
                          </div>
                          
                          <div className="text-left sm:text-right">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-3 sm:justify-end">
                              {booking.date}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => alert(`Accepted booking ${booking.id}`)} className="px-4 py-2 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
                                Accept
                              </button>
                              <button onClick={() => alert(`Details for booking ${booking.id}`)} className="px-4 py-2 text-sm font-semibold rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors">
                                Details
                              </button>
                            </div>
                          </div>
                          
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "bookings" && (
                <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
                  <h3 className="font-semibold text-lg text-foreground mb-4">All Bookings</h3>
                  <p className="text-sm text-muted-foreground mb-6">Manage your past and upcoming bookings here.</p>
                  <div className="p-8 text-center border-2 border-dashed border-border rounded-xl">
                    <Briefcase className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">List of all bookings goes here...</p>
                  </div>
                </div>
              )}

              {activeTab === "earnings" && (
                <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
                  <h3 className="font-semibold text-lg text-foreground mb-4">Earnings Report</h3>
                  <p className="text-sm text-muted-foreground mb-6">Track your revenue and payouts.</p>
                  <div className="p-8 text-center border-2 border-dashed border-border rounded-xl">
                    <DollarSign className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Earnings chart and history goes here...</p>
                  </div>
                </div>
              )}

              {activeTab === "reviews" && (
                <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
                  <h3 className="font-semibold text-lg text-foreground mb-4">Customer Reviews</h3>
                  <p className="text-sm text-muted-foreground mb-6">See what customers are saying about your work.</p>
                  <div className="p-8 text-center border-2 border-dashed border-border rounded-xl">
                    <Star className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Reviews list goes here...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Widgets */}
            <div className="space-y-6">
              
              {/* Trust & Verification Widget */}
              <div className="rounded-2xl border border-border bg-card shadow-sm p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10 group-hover:bg-primary/10 transition-colors" />
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Verified Provider</h3>
                    <p className="text-xs text-muted-foreground">Background check completed</p>
                  </div>
                </div>
                
                <div className="space-y-3 mt-5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Profile Completeness</span>
                    <span className="font-semibold text-foreground">95%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full w-[95%]" />
                  </div>
                </div>
                
                <button className="mt-5 w-full py-2.5 text-sm font-semibold text-primary border border-primary/20 rounded-xl hover:bg-primary/5 transition-colors flex items-center justify-center gap-2">
                  Complete Profile
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              
              {/* Recent Activity */}
              <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
                <h3 className="font-semibold text-lg text-foreground mb-4">Recent Activity</h3>
                
                <div className="space-y-5">
                  {[
                    { title: "Booking Completed", desc: "AC Service completed", time: "Recent", type: "success" },
                    { title: "New 5-star review", desc: "Rahul V. left a review", time: "Recent", type: "star" },
                    { title: "System alert", desc: "Please update your ID proof", time: "Recent", type: "alert" },
                  ].map((activity, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="mt-0.5">
                        <div className={`w-2 h-2 rounded-full ${
                          activity.type === 'success' ? 'bg-emerald-500' :
                          activity.type === 'star' ? 'bg-amber-500' : 'bg-red-500'
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{activity.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{activity.desc}</p>
                        <span className="text-[10px] text-muted-foreground mt-1 block">{activity.time}</span>
                      </div>
                    </div>
                  ))}
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
