"use client";

import Navigation from "@/components/sections/Navigation";
import Footer from "@/components/sections/Footer";
import { motion } from "framer-motion";
import { User, MapPin, Calendar, Star, Clock, MoreVertical, LogOut, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState("bookings");

  const mockBookings = [
    { id: "B-8492", service: "AC Repair", provider: "Ramesh Sharma", date: "Tomorrow", status: "Upcoming" },
    { id: "B-8120", service: "Home Cleaning", provider: "Suresh Kumar", date: "12 May", status: "Completed" },
    { id: "B-7644", service: "Plumbing", provider: "Anil Desai", date: "3 April", status: "Completed" },
  ];

  const mockAddresses = [
    { id: 1, type: "Home", text: "123 Main St, Tilakwadi, Belagavi, 590006" },
    { id: 2, type: "Office", text: "45 Business Park, Camp, Belagavi, 590001" },
  ];

  return (
    <main className="min-h-screen bg-muted/10 text-foreground flex flex-col">
      <Navigation />
      
      <div className="flex-1 pt-24 pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row gap-8">
            {/* Sidebar */}
            <div className="w-full md:w-64 space-y-2">
              <div className="rounded-2xl border border-border bg-card p-6 mb-4 text-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <User className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">John Doe</h2>
                <p className="text-sm text-muted-foreground">+91 98765 43210</p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-2 flex flex-col gap-1">
                <button 
                  onClick={() => setActiveTab("bookings")}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors ${activeTab === "bookings" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
                >
                  <Calendar className="h-4 w-4" /> My Bookings
                </button>
                <button 
                  onClick={() => setActiveTab("addresses")}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors ${activeTab === "addresses" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
                >
                  <MapPin className="h-4 w-4" /> Saved Addresses
                </button>
                <button 
                  onClick={() => setActiveTab("profile")}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors ${activeTab === "profile" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}
                >
                  <User className="h-4 w-4" /> Profile Settings
                </button>
              </div>

              <button className="w-full mt-4 text-left px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors">
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>

            {/* Main Content */}
            <div className="flex-1">
              {activeTab === "bookings" && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-foreground">My Bookings</h2>
                  
                  {mockBookings.map(booking => (
                    <motion.div 
                      key={booking.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-border bg-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${booking.status === "Upcoming" ? "bg-blue-500/10 text-blue-500" : "bg-emerald-500/10 text-emerald-500"}`}>
                            {booking.status}
                          </span>
                          <span className="text-sm font-medium text-muted-foreground">{booking.id}</span>
                        </div>
                        <h3 className="text-lg font-bold text-foreground">{booking.service}</h3>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                          <User className="h-3.5 w-3.5" /> Professional: {booking.provider}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" /> {booking.date}
                        </p>
                      </div>

                      <div className="flex flex-col md:items-end gap-3">
                        
                        {booking.status === "Upcoming" ? (
                          <div className="flex gap-2">
                            <button className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Reschedule</button>
                            <button className="px-4 py-2 rounded-lg border border-red-500/20 text-red-500 text-sm font-medium hover:bg-red-500/10 transition-colors">Cancel</button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Rebook</button>
                            <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1">
                              <Star className="h-3.5 w-3.5" /> Rate Service
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {activeTab === "addresses" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-foreground">Saved Addresses</h2>
                    <button className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                      + Add New
                    </button>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-4">
                    {mockAddresses.map(addr => (
                      <div key={addr.id} className="rounded-2xl border border-border bg-card p-5 relative">
                        <div className="absolute top-4 right-4">
                          <button className="text-muted-foreground hover:text-foreground">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>
                        <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" /> {addr.type}
                        </h3>
                        <p className="text-sm text-muted-foreground pr-6">{addr.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "profile" && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-foreground">Profile Settings</h2>
                  <div className="rounded-2xl border border-border bg-card p-6 space-y-4 max-w-xl">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1">Full Name</label>
                      <input type="text" defaultValue="John Doe" className="w-full px-4 py-2.5 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary focus:border-transparent text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1">Mobile Number</label>
                      <input type="tel" defaultValue="+91 98765 43210" disabled className="w-full px-4 py-2.5 border border-border rounded-xl bg-muted/50 text-muted-foreground cursor-not-allowed text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1">Email (Optional)</label>
                      <input type="email" placeholder="john@example.com" className="w-full px-4 py-2.5 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary focus:border-transparent text-sm" />
                    </div>
                    <button className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors mt-2">
                      Save Changes
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
      
      <Footer />
    </main>
  );
}
