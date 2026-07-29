"use client";

import Navigation from "@/components/sections/Navigation";
import Footer from "@/components/sections/Footer";
import { motion } from "framer-motion";
import { Search, Zap, Droplets, Sparkles, Bug, Wind, PaintBucket, Scissors, Hammer, GraduationCap, Monitor, PawPrint, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SERVICE_CATEGORIES, SERVICE_TAXONOMY } from "@/constants/site";

const iconMap: Record<string, any> = {
  Zap, Droplets, Sparkles, Bug, Wind, PaintBucket, Scissors, Hammer, GraduationCap, Monitor, PawPrint
};

export default function ServicesPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = SERVICE_CATEGORIES.filter(cat => 
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    cat.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-muted/10 text-foreground flex flex-col">
      <Navigation />
      
      <div className="flex-1 pt-24 pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          {/* Header & Search */}
          <div className="mb-12 text-center max-w-3xl mx-auto">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl sm:text-5xl font-heading font-bold tracking-tight text-foreground mb-4"
            >
              All Services
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-muted-foreground mb-8"
            >
              Find the perfect professional for your home, business, or personal needs in Belagavi.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="relative max-w-xl mx-auto"
            >
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-11 pr-4 py-4 border border-border rounded-full bg-card focus:bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-base text-foreground placeholder-muted-foreground shadow-sm"
                placeholder="Search for 'AC repair', 'Cleaning', etc."
              />
            </motion.div>
          </div>

          {/* Categories Grid */}
          {searchQuery ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredCategories.length > 0 ? (
                filteredCategories.map((category, index) => (
                  <motion.div
                    key={category.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                  >
                    <Link href={`/services/${category.id}`} className="group block h-full">
                      <div className="rounded-[1.5rem] border border-border bg-card p-6 h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/30 flex flex-col">
                        <div className="flex items-start justify-between mb-4">
                          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${category.gradient} flex items-center justify-center transition-transform group-hover:scale-110`}>
                            {(() => {
                              const IconComponent = iconMap[category.icon] || Sparkles;
                              return <IconComponent className={`h-7 w-7 ${category.iconColor}`} />;
                            })()}
                          </div>
                        </div>
                        <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">{category.name}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">{category.description}</p>
                        
                        <div className="mt-auto flex items-center text-sm font-semibold text-primary">
                          View services
                          <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <Search className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">No services found</h3>
                  <p className="text-muted-foreground">We couldn't find any services matching "{searchQuery}". Try a different keyword.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-16">
              {SERVICE_TAXONOMY.map((section, sIndex) => (
                <div key={section.section}>
                  <motion.h2 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: sIndex * 0.1 }}
                    className="text-3xl font-heading font-bold text-foreground mb-8"
                  >
                    {section.section}
                  </motion.h2>
                  
                  <div className="space-y-12">
                    {section.items.map((group, gIndex) => (
                      <div key={group.id}>
                        <motion.h3 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: sIndex * 0.1 + gIndex * 0.05 }}
                          className="text-xl font-semibold text-foreground/80 mb-6 flex items-center gap-2"
                        >
                          {group.name}
                        </motion.h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {group.services.map((serviceId, iIndex) => {
                            const category = SERVICE_CATEGORIES.find(s => s.id === serviceId);
                            if (!category) return null;
                            
                            return (
                              <motion.div
                                key={category.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.4, delay: sIndex * 0.1 + gIndex * 0.05 + iIndex * 0.05 }}
                              >
                                <Link href={`/services/${category.id}`} className="group block h-full">
                                  <div className="rounded-[1.5rem] border border-border bg-card p-6 h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/30 flex flex-col">
                                    <div className="flex items-start justify-between mb-4">
                                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${category.gradient} flex items-center justify-center transition-transform group-hover:scale-110`}>
                                        {(() => {
                                          const IconComponent = iconMap[category.icon] || Sparkles;
                                          return <IconComponent className={`h-7 w-7 ${category.iconColor}`} />;
                                        })()}
                                      </div>
                                    </div>
                                    <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">{category.name}</h3>
                                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">{category.description}</p>
                                    
                                    <div className="mt-auto flex items-center text-sm font-semibold text-primary">
                                      View services
                                      <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                    </div>
                                  </div>
                                </Link>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          
        </div>
      </div>
      
      <Footer />
    </main>
  );
}
