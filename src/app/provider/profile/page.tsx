"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, 
  ShieldCheck, 
  Star, 
  MapPin, 
  Phone, 
  Mail, 
  Briefcase, 
  Languages, 
  FileCheck,
  Edit3,
  Camera,
  CheckCircle2,
  X,
  Upload,
  FileText
} from "lucide-react";
import { useProviderStore } from "@/store/useProviderStore";
import { useAuthStore } from "@/store/useAuthStore";

export default function ProviderProfilePage() {
  const { currentUser, updateProfile: updateAuthProfile } = useAuthStore();
  const { profile, updateProfile, syncWithAuthUser, bookings } = useProviderStore();
  const [isEditing, setIsEditing] = useState(false);
  const [showSavedAlert, setShowSavedAlert] = useState(false);
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);

  const ratedBookings = bookings.filter((b) => b.rating !== undefined && b.rating !== null && b.rating > 0);
  const totalReviews = ratedBookings.length;
  const avgRating = totalReviews > 0 
    ? (ratedBookings.reduce((sum, b) => sum + (b.rating || 0), 0) / totalReviews).toFixed(1)
    : "0.0";

  useEffect(() => {
    if (currentUser) {
      syncWithAuthUser({
        name: currentUser.name,
        email: currentUser.email,
        phone: currentUser.phone,
        avatar: currentUser.avatar
      });
    }
  }, [currentUser, syncWithAuthUser]);

  const activeProfile = currentUser ? {
    ...profile,
    name: currentUser.name || profile.name,
    email: currentUser.email || profile.email,
    phone: currentUser.phone || profile.phone,
    photo: currentUser.avatar || profile.photo
  } : profile;

  const [formData, setFormData] = useState({
    ...activeProfile,
    skillsInput: activeProfile.skills.join(", "),
    languagesInput: activeProfile.languages.join(", ")
  });

  const [kycForm, setKycForm] = useState({
    documentType: activeProfile.kycDocumentType || "Aadhaar Card",
    documentNumber: activeProfile.kycDocumentNumber || activeProfile.aadhaarNumber || "",
    fullName: activeProfile.name || "",
    documentPhoto: activeProfile.kycDocumentPhoto || ""
  });

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          photo: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    const parsedSkills = formData.skillsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const parsedLanguages = formData.languagesInput
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);

    const updatedProfileData = {
      ...formData,
      skills: parsedSkills.length > 0 ? parsedSkills : profile.skills,
      languages: parsedLanguages.length > 0 ? parsedLanguages : profile.languages
    };

    updateProfile(updatedProfileData);
    updateAuthProfile({
      name: updatedProfileData.name,
      phone: updatedProfileData.phone,
      avatar: updatedProfileData.photo
    });
    setIsEditing(false);
    setShowSavedAlert(true);
    setTimeout(() => setShowSavedAlert(false), 3000);
  };

  const handleKycDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setKycForm((prev) => ({
          ...prev,
          documentPhoto: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleKycSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kycForm.documentNumber) {
      alert("Please enter your Government Document / ID Number.");
      return;
    }

    const updatedKyc = {
      isVerified: true,
      kycStatus: "Verified" as const,
      kycDocumentType: kycForm.documentType,
      kycDocumentNumber: kycForm.documentNumber,
      kycDocumentPhoto: kycForm.documentPhoto,
      panNumber: kycForm.documentType === "PAN Card" ? kycForm.documentNumber : profile.panNumber,
      aadhaarNumber: kycForm.documentType === "Aadhaar Card" ? kycForm.documentNumber : profile.aadhaarNumber
    };

    updateProfile(updatedKyc);
    setIsKycModalOpen(false);
    setShowSavedAlert(true);
    setTimeout(() => setShowSavedAlert(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Provider Professional Profile
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage your public bio, profile picture, credentials, language skills, and contact info.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({
              ...profile,
              skillsInput: profile.skills.join(", "),
              languagesInput: profile.languages.join(", ")
            });
            setIsEditing(!isEditing);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md hover:bg-blue-700 transition-all"
        >
          <Edit3 className="h-4 w-4" />
          <span>{isEditing ? "Cancel Edit" : "Edit Profile"}</span>
        </button>
      </div>

      {showSavedAlert && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="h-4 w-4" />
          <span>Profile changes updated successfully and saved to localStorage!</span>
        </div>
      )}

      {/* Main Profile Card */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
        
        {/* Top Info Banner */}
        <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-border">
          <div className="relative group">
            <img
              src={formData.photo || profile.photo}
              alt={formData.name || profile.name}
              className="w-24 h-24 rounded-3xl object-cover border-4 border-blue-600/30 shadow-lg shrink-0"
            />
            {isEditing && (
              <label className="absolute inset-0 bg-black/50 rounded-3xl flex flex-col items-center justify-center text-white cursor-pointer opacity-90 group-hover:opacity-100 transition-opacity">
                <Camera className="h-6 w-6" />
                <span className="text-[9px] font-bold mt-1">Upload Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="text-center sm:text-left space-y-1 flex-1">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h2 className="font-heading text-xl font-bold text-foreground">{profile.name}</h2>
              <ShieldCheck className="h-5 w-5 text-blue-600" />
            </div>

            <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{profile.title}</p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1 font-bold text-foreground">
                <Star className={`h-3.5 w-3.5 text-[#D4A017] ${totalReviews > 0 ? "fill-[#D4A017]" : ""}`} />
                {totalReviews > 0 ? `${avgRating} Rating` : "No ratings"} ({totalReviews} Reviews)
              </span>
              <span>• {profile.experienceYears} Years Experience</span>
              <span>• Belagavi Zone</span>
            </div>
          </div>
        </div>

        {/* Profile Content / Edit Form */}
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-bold text-foreground">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 rounded-xl bg-muted/40 border border-border focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">Professional Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-3 rounded-xl bg-muted/40 border border-border focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">Bio Description</label>
              <textarea
                rows={3}
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="w-full p-3 rounded-xl bg-muted/40 border border-border focus:outline-none focus:ring-2 focus:ring-blue-600/30"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="font-bold text-foreground">Phone Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-3 rounded-xl bg-muted/40 border border-border focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-3 rounded-xl bg-muted/40 border border-border focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">Experience (Years)</label>
                <input
                  type="number"
                  value={formData.experienceYears}
                  onChange={(e) => setFormData({ ...formData, experienceYears: Number(e.target.value) })}
                  className="w-full p-3 rounded-xl bg-muted/40 border border-border focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-bold text-foreground">Skills (Comma-separated)</label>
                <input
                  type="text"
                  value={formData.skillsInput}
                  onChange={(e) => setFormData({ ...formData, skillsInput: e.target.value })}
                  placeholder="e.g. Wiring, MCB Repair, Emergency Service"
                  className="w-full p-3 rounded-xl bg-muted/40 border border-border focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">Languages (Comma-separated)</label>
                <input
                  type="text"
                  value={formData.languagesInput}
                  onChange={(e) => setFormData({ ...formData, languagesInput: e.target.value })}
                  placeholder="e.g. English, Kannada, Hindi"
                  className="w-full p-3 rounded-xl bg-muted/40 border border-border focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-bold shadow-md hover:bg-blue-700 transition-all text-xs"
            >
              Save Profile Changes to LocalStorage
            </button>
          </form>
        ) : (
          <div className="space-y-6 text-xs">
            
            {/* Bio */}
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">About & Bio</span>
              <p className="text-foreground leading-relaxed font-medium bg-muted/30 p-4 rounded-2xl border border-border/50">
                "{profile.bio}"
              </p>
            </div>

            {/* Skills & Languages */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Verified Skills</span>
                <div className="flex flex-wrap gap-1.5">
                  {profile.skills.map((skill, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Spoken Languages</span>
                <div className="flex flex-wrap gap-1.5">
                  {profile.languages.map((lang, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-card border border-border text-foreground font-semibold">
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Contact Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-muted/30 border border-border/60">
              <div className="flex items-center gap-2.5 text-foreground">
                <Phone className="h-4 w-4 text-blue-600" />
                <span>{profile.phone}</span>
              </div>
              <div className="flex items-center gap-2.5 text-foreground">
                <Mail className="h-4 w-4 text-blue-600" />
                <span>{profile.email}</span>
              </div>
            </div>

            {/* Government ID KYC Verification Interactive Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-emerald-500/10 border border-blue-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  <FileCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-foreground">KYC Identity Verification</h4>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                      profile.isVerified 
                        ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30" 
                        : "bg-amber-500/20 text-amber-600 border-amber-500/30"
                    }`}>
                      {profile.isVerified ? "Verified ✅" : "Action Required ⚠️"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {profile.kycDocumentType 
                      ? `${profile.kycDocumentType}: ${profile.kycDocumentNumber}` 
                      : "Upload Aadhaar, PAN, Driving License or Govt ID for identity trust"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsKycModalOpen(true)}
                className="w-auto self-start sm:self-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all shrink-0 whitespace-nowrap"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{profile.isVerified ? "Update KYC Details" : "Verify or Complete KYC"}</span>
              </button>
            </div>

          </div>
        )}

      </div>

      {/* KYC Modal Dialog */}
      <AnimatePresence>
        {isKycModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto scrollbar-thin"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-heading text-lg font-bold text-foreground">Complete KYC Verification</h3>
                    <p className="text-[11px] text-muted-foreground">Upload official Govt ID to verify your profile</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsKycModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* KYC Form */}
              <form onSubmit={handleKycSubmit} className="space-y-4 text-xs">
                
                {/* Government ID Type */}
                <div className="space-y-1">
                  <label className="font-bold text-foreground block">Select Government ID Type *</label>
                  <select
                    required
                    value={kycForm.documentType}
                    onChange={(e) => setKycForm({ ...kycForm, documentType: e.target.value })}
                    className="w-full p-3 rounded-xl bg-muted/40 border border-border focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  >
                    <option value="Aadhaar Card">Aadhaar Card (12-Digit)</option>
                    <option value="PAN Card">PAN Card (10-Digit Alphanumeric)</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Voter ID Card">Voter ID Card</option>
                    <option value="Passport">Passport</option>
                  </select>
                </div>

                {/* ID Number */}
                <div className="space-y-1">
                  <label className="font-bold text-foreground block">Government ID / Document Number *</label>
                  <input
                    type="text"
                    required
                    value={kycForm.documentNumber}
                    onChange={(e) => setKycForm({ ...kycForm, documentNumber: e.target.value })}
                    placeholder="e.g. ABCDE1234F or 1234 5678 9012"
                    className="w-full p-3 rounded-xl bg-muted/40 border border-border focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  />
                </div>

                {/* Full Name on Document */}
                <div className="space-y-1">
                  <label className="font-bold text-foreground block">Full Name (As on Government ID) *</label>
                  <input
                    type="text"
                    required
                    value={kycForm.fullName}
                    onChange={(e) => setKycForm({ ...kycForm, fullName: e.target.value })}
                    placeholder="Official full name"
                    className="w-full p-3 rounded-xl bg-muted/40 border border-border focus:outline-none"
                  />
                </div>

                {/* Document Photo Upload */}
                <div className="space-y-2 pt-2">
                  <label className="font-bold text-foreground block">Upload Photo of Document *</label>
                  
                  <div className="border-2 border-dashed border-border hover:border-blue-600 rounded-2xl p-6 text-center bg-muted/20 flex flex-col items-center justify-center transition-colors">
                    {kycForm.documentPhoto ? (
                      <div className="space-y-2">
                        <img
                          src={kycForm.documentPhoto}
                          alt="Document Preview"
                          className="w-48 h-32 rounded-xl object-cover border border-border mx-auto shadow-md"
                        />
                        <button
                          type="button"
                          onClick={() => setKycForm({ ...kycForm, documentPhoto: "" })}
                          className="text-[11px] font-bold text-red-500 hover:underline block mx-auto"
                        >
                          Remove Photo
                        </button>
                      </div>
                    ) : (
                      <>
                        <FileText className="h-8 w-8 text-blue-600 mb-2" />
                        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md hover:bg-blue-700 transition-all">
                          <Upload className="h-4 w-4" />
                          <span>Choose Document Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleKycDocUpload}
                            className="hidden"
                          />
                        </label>
                        <span className="text-[10px] text-muted-foreground mt-2">Clear image of PAN, Aadhaar or License card</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsKycModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all"
                  >
                    Submit KYC for Verification
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
