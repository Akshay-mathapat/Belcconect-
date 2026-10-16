"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, 
  ShieldCheck, 
  Star, 
  MapPin, 
  Briefcase, 
  Languages, 
  FileCheck,
  Edit3,
  Camera,
  CheckCircle2,
  X,
  Upload,
  FileText,
  Eye,
  ExternalLink,
  Trash2,
  AlertCircle
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useProviderStore } from "@/store/useProviderStore";
import { useAuthStore, getStoredAuthToken } from "@/store/useAuthStore";
import { useTranslation } from "@/lib/i18n";

export default function ProviderProfilePage() {
  const router = useRouter();
  const { currentUser, updateProfile: updateAuthProfile, logout } = useAuthStore();
  const { profile, updateProfile, syncWithAuthUser, bookings } = useProviderStore();
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [showSavedAlert, setShowSavedAlert] = useState(false);
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Account Deletion State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");

  const handleDeleteAccount = async () => {
    try {
      setIsDeletingAccount(true);
      setDeleteError(null);
      const token = getStoredAuthToken();
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          password: deletePassword,
          reason: "Provider requested in-app account deletion"
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete account");
      }
      logout();
      router.push("/?deleted=true");
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete account. Please try again.");
    } finally {
      setIsDeletingAccount(false);
    }
  };

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

  const handleKycDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("Document file size exceeds 10MB limit. Please upload a smaller image or PDF.");
      return;
    }

    try {
      setIsUploadingDoc(true);
      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("category", "kyc");

      const token = currentUser?.token || (typeof window !== "undefined" ? localStorage.getItem("cityconnect_auth_token") : null);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: uploadData
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          setKycForm((prev) => ({
            ...prev,
            documentPhoto: data.url
          }));
          return;
        }
      }

      // Local preview fallback if upload is unavailable
      const reader = new FileReader();
      reader.onloadend = () => {
        setKycForm((prev) => ({
          ...prev,
          documentPhoto: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    } catch (uploadErr) {
      console.warn("KYC document upload error, using local preview fallback:", uploadErr);
      const reader = new FileReader();
      reader.onloadend = () => {
        setKycForm((prev) => ({
          ...prev,
          documentPhoto: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingDoc(false);
    }
  };

  // Fetch persisted KYC details from PostgreSQL database on load
  useEffect(() => {
    const isDemo = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    const providerId = currentUser?.id || (isDemo ? "provider-1" : "");
    if (!providerId) return;
    fetch(`/api/provider/kyc?providerId=${encodeURIComponent(providerId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.kyc) {
          const vStatus = data.kyc.verificationStatus || (data.kyc.isVerified ? "verified" : "unverified");
          const isVerified = vStatus === "verified";
          updateProfile({
            isVerified,
            kycStatus: data.kyc.kycStatus || (isVerified ? "Verified" : "Unverified"),
            verificationStatus: vStatus,
            kycDocumentType: data.kyc.kycDocumentType || undefined,
            kycDocumentNumber: data.kyc.kycDocumentNumber || undefined,
            kycDocumentPhoto: data.kyc.kycDocumentPhoto || undefined,
            panNumber: data.kyc.panNumber || undefined,
            aadhaarNumber: data.kyc.aadhaarNumber || undefined
          });
          setKycForm((prev) => ({
            ...prev,
            documentType: data.kyc.kycDocumentType || prev.documentType,
            documentNumber: data.kyc.kycDocumentNumber || prev.documentNumber,
            documentPhoto: data.kyc.kycDocumentPhoto || prev.documentPhoto,
            fullName: data.kyc.name || prev.fullName
          }));
        }
      })
      .catch((e) => console.error("Error loading KYC from PostgreSQL database:", e));
  }, [currentUser, updateProfile]);

  const handleKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kycForm.documentNumber) {
      alert("Please enter your Government Document / ID Number.");
      return;
    }

    // Client-side format validation
    if (kycForm.documentType === "Aadhaar Card") {
      const cleanAadhaar = kycForm.documentNumber.replace(/[\s-]/g, "");
      if (!/^\d{12}$/.test(cleanAadhaar)) {
        alert("Please enter a valid 12-digit Aadhaar number (e.g. 1234 5678 9012).");
        return;
      }
    } else if (kycForm.documentType === "PAN Card") {
      const cleanPan = kycForm.documentNumber.trim().toUpperCase();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
        alert("Please enter a valid 10-character PAN number (e.g. ABCDE1234F).");
        return;
      }
    }

    const isDemo = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    const providerId = currentUser?.id || (isDemo ? "provider-1" : "");
    if (!providerId) {
      alert("Please log in to submit KYC documents.");
      return;
    }

    const updatedKyc = {
      isVerified: false,
      kycStatus: "Pending" as const,
      verificationStatus: "pending",
      kycDocumentType: kycForm.documentType,
      kycDocumentNumber: kycForm.documentNumber,
      kycDocumentPhoto: kycForm.documentPhoto,
      panNumber: kycForm.documentType === "PAN Card" ? kycForm.documentNumber : profile.panNumber,
      aadhaarNumber: kycForm.documentType === "Aadhaar Card" ? kycForm.documentNumber : profile.aadhaarNumber
    };

    // 1. Update local state
    updateProfile(updatedKyc);

    // 2. Persist to PostgreSQL database
    try {
      const res = await fetch("/api/provider/kyc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": providerId
        },
        body: JSON.stringify({
          providerId,
          documentType: kycForm.documentType,
          documentNumber: kycForm.documentNumber,
          documentPhoto: kycForm.documentPhoto,
          fullName: kycForm.fullName
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.kyc) {
          const isVerified = data.kyc.verificationStatus === "verified";
          updateProfile({
            isVerified,
            kycStatus: data.kyc.kycStatus || "Pending",
            verificationStatus: data.kyc.verificationStatus || "pending",
            kycDocumentType: data.kyc.kycDocumentType,
            kycDocumentNumber: data.kyc.kycDocumentNumber,
            kycDocumentPhoto: data.kyc.kycDocumentPhoto,
            panNumber: data.kyc.panNumber || profile.panNumber,
            aadhaarNumber: data.kyc.aadhaarNumber || profile.aadhaarNumber
          });
        }
      }
    } catch (err) {
      console.error("Failed to save KYC documents to PostgreSQL database:", err);
    }

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
            {t("serviceProvider.providerProfessionalProfile")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {t("serviceProvider.providerProfileDesc")}
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
          <span>{isEditing ? t("serviceProvider.cancelEdit") : t("serviceProvider.editProfile")}</span>
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
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-extrabold text-4xl flex items-center justify-center border-4 border-blue-600/30 shadow-lg shrink-0">
              {profile.name ? profile.name.trim().charAt(0).toUpperCase() : "P"}
            </div>
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
              {profile.verificationStatus === "verified" && (
                <span title="Verified Provider">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                </span>
              )}
            </div>

            <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{profile.title}</p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1 font-bold text-foreground">
                <Star className={`h-3.5 w-3.5 text-[#D4A017] ${totalReviews > 0 ? "fill-[#D4A017]" : ""}`} />
                {totalReviews > 0 ? `${avgRating} Rating` : t("serviceProvider.noRatings")} ({totalReviews} Reviews)
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
                <label className="font-bold text-foreground">{t("account.fullName")} *</label>
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
                <label className="font-bold text-foreground">{t("account.mobileNumber")}</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-3 rounded-xl bg-muted/40 border border-border focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">{t("account.emailAddress")}</label>
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
              {t("account.saveProfileChanges")}
            </button>
          </form>
        ) : (
          <div className="space-y-6 text-xs">
            
            {/* Bio */}
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">{t("serviceProvider.aboutAndBio")}</span>
              <p className="text-foreground leading-relaxed font-medium bg-muted/30 p-4 rounded-2xl border border-border/50">
                &quot;{profile.bio || t("serviceProvider.defaultBio")}&quot;
              </p>
            </div>

            {/* Skills & Languages */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">{t("serviceProvider.verifiedSkills")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {profile.skills.map((skill, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">{t("serviceProvider.spokenLanguages")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {profile.languages.map((lang, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-card border border-border text-foreground font-semibold">
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            </div>


            {/* In-app Notice for Providers Affected by Migration 027 Base64 Cleanup */}
            {(!profile.kycDocumentPhoto && (profile.kycDocumentType || profile.kycDocumentNumber || profile.verificationStatus === "pending" || profile.kycStatus === "please re-upload your KYC document")) && (
              <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                    <FileCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs uppercase tracking-wide text-amber-800 dark:text-amber-300">Action Required: KYC Document Photo Missing</h5>
                    <p className="text-xs mt-0.5 text-amber-700 dark:text-amber-200">
                      Migration 027 security update cleared raw base64 photos. <strong>please re-upload your KYC document</strong> to complete your verification and start receiving bookings.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsKycModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 transition-colors shadow-xs"
                >
                  Upload Document
                </button>
              </div>
            )}

            {/* Government ID KYC Verification Interactive Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-emerald-500/10 border border-blue-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  <FileCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-foreground">{t("serviceProvider.kycIdentityVerification")}</h4>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                      profile.verificationStatus === "verified"
                        ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30"
                        : (!profile.kycDocumentPhoto && (profile.kycDocumentType || profile.kycDocumentNumber || profile.verificationStatus === "pending" || profile.kycStatus === "please re-upload your KYC document"))
                        ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30"
                        : profile.verificationStatus === "pending" || profile.kycStatus === "Pending"
                        ? "bg-blue-500/20 text-blue-600 border-blue-500/30"
                        : "bg-zinc-500/20 text-zinc-600 border-zinc-500/30"
                    }`}>
                      {profile.verificationStatus === "verified"
                        ? t("serviceProvider.verifiedBadge")
                        : (!profile.kycDocumentPhoto && (profile.kycDocumentType || profile.kycDocumentNumber || profile.verificationStatus === "pending" || profile.kycStatus === "please re-upload your KYC document"))
                        ? "please re-upload your KYC document"
                        : profile.verificationStatus === "pending" || profile.kycStatus === "Pending"
                        ? "Pending Verification"
                        : t("serviceProvider.actionRequiredBadge")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(!profile.kycDocumentPhoto && (profile.kycDocumentType || profile.kycDocumentNumber || profile.verificationStatus === "pending" || profile.kycStatus === "please re-upload your KYC document"))
                      ? "please re-upload your KYC document (document photo is missing or cleared by security updates)"
                      : profile.kycDocumentType
                      ? `${profile.kycDocumentType}: ${profile.kycDocumentNumber}`
                      : t("serviceProvider.kycDesc")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                {profile.kycDocumentPhoto && (
                  <a
                    href={profile.kycDocumentPhoto}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card border border-border hover:bg-muted text-foreground text-xs font-bold transition-all shadow-xs"
                    title="View Uploaded Document (Photo / PDF)"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-blue-600" />
                    <span>View Document</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setIsKycModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all shrink-0 whitespace-nowrap"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>{profile.isVerified ? t("serviceProvider.updateKycDetails") : t("serviceProvider.verifyOrCompleteKyc")}</span>
                </button>
              </div>
            </div>

            {/* Danger Zone: Account Deletion */}
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  <span>Delete Service Provider Account</span>
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Permanently remove your service listings, KYC identity documents, and provider profile.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-4 py-2.5 rounded-xl border border-red-500 bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Account</span>
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
                    <h3 className="font-heading text-lg font-bold text-foreground">{t("serviceProvider.completeKycVerification")}</h3>
                    <p className="text-[11px] text-muted-foreground">{t("serviceProvider.uploadGovtIdDesc")}</p>
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
                  <label className="font-bold text-foreground block">{t("serviceProvider.selectGovtIdType")}</label>
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
                  <label className="font-bold text-foreground block">{t("serviceProvider.govtIdNumber")}</label>
                  <input
                    type="text"
                    required
                    value={kycForm.documentNumber}
                    onChange={(e) => setKycForm({ ...kycForm, documentNumber: e.target.value })}
                    placeholder="e.g. ABCDE1234F or 1234 5678 9012"
                    className="w-full p-3 rounded-xl bg-muted/40 border border-border focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  />
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Privacy Notice: Full document numbers are validated only for format. Only the last 4 digits (e.g. XXXX-XXXX-1234) are permanently stored.</span>
                  </p>
                </div>

                {/* Full Name on Document */}
                <div className="space-y-1">
                  <label className="font-bold text-foreground block">{t("serviceProvider.fullNameOnGovtId")}</label>
                  <input
                    type="text"
                    required
                    value={kycForm.fullName}
                    onChange={(e) => setKycForm({ ...kycForm, fullName: e.target.value })}
                    placeholder="Official full name"
                    className="w-full p-3 rounded-xl bg-muted/40 border border-border focus:outline-none"
                  />
                </div>

                {/* Document Photo / PDF Upload */}
                <div className="space-y-2 pt-2">
                  <label className="font-bold text-foreground block">{t("serviceProvider.uploadDocumentPhoto")}</label>
                  
                  <div className="border-2 border-dashed border-border hover:border-blue-600 rounded-2xl p-6 text-center bg-muted/20 flex flex-col items-center justify-center transition-colors">
                    {kycForm.documentPhoto ? (
                      (() => {
                        const isPdf = 
                          kycForm.documentPhoto.startsWith("data:application/pdf") || 
                          kycForm.documentPhoto.toLowerCase().endsWith(".pdf") || 
                          kycForm.documentPhoto.includes("pdf");

                        if (isPdf) {
                          return (
                            <div className="space-y-3 w-full max-w-sm mx-auto">
                              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-between gap-3 shadow-xs">
                                <div className="flex items-center gap-3 text-left">
                                  <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-extrabold text-xs shadow-md shrink-0">
                                    PDF
                                  </div>
                                  <div className="overflow-hidden">
                                    <h5 className="font-bold text-foreground text-xs truncate">
                                      {kycForm.documentType || "Government ID"} Document
                                    </h5>
                                    <p className="text-[10px] text-muted-foreground">PDF Document Uploaded</p>
                                  </div>
                                </div>
                                <a
                                  href={kycForm.documentPhoto}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all shrink-0 cursor-pointer"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  <span>View PDF</span>
                                </a>
                              </div>

                              {kycForm.documentPhoto.startsWith("data:application/pdf") && (
                                <iframe
                                  src={kycForm.documentPhoto}
                                  className="w-full h-44 rounded-xl border border-border bg-background shadow-inner"
                                  title="PDF Document Preview"
                                />
                              )}

                              <button
                                type="button"
                                onClick={() => setKycForm({ ...kycForm, documentPhoto: "" })}
                                className="text-[11px] font-bold text-red-500 hover:underline block mx-auto pt-1 cursor-pointer"
                              >
                                Remove PDF Document
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-2">
                            <div className="relative group mx-auto w-48">
                              <img
                                src={kycForm.documentPhoto}
                                alt="Document Preview"
                                className="w-48 h-32 rounded-xl object-cover border border-border mx-auto shadow-md"
                              />
                              <a
                                href={kycForm.documentPhoto}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity font-bold text-xs gap-1.5 cursor-pointer"
                              >
                                <Eye className="h-4 w-4" />
                                <span>View Photo</span>
                              </a>
                            </div>
                            <button
                              type="button"
                              onClick={() => setKycForm({ ...kycForm, documentPhoto: "" })}
                              className="text-[11px] font-bold text-red-500 hover:underline block mx-auto cursor-pointer"
                            >
                              Remove Photo
                            </button>
                          </div>
                        );
                      })()
                    ) : (
                      <>
                        <FileText className="h-8 w-8 text-blue-600 mb-2" />
                        <label className="cursor-pointer inline-flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md hover:bg-blue-700 transition-all">
                          <Upload className="h-4 w-4" />
                          <span>{t("serviceProvider.chooseDocumentPhoto")}</span>
                          <input
                            type="file"
                            accept="image/*,application/pdf,.pdf"
                            onChange={handleKycDocUpload}
                            className="hidden"
                          />
                        </label>
                        <span className="text-[10px] text-muted-foreground mt-2 font-medium">
                          Upload clear photo (PNG, JPG) or PDF file of PAN, Aadhaar or License card
                        </span>
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
                    {t("serviceProvider.cancel")}
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all"
                  >
                    {t("serviceProvider.submitKycForVerification")}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}

        {/* Delete Account Confirmation Modal */}
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-3xl border border-red-500/30 bg-card p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Delete Provider Account?</h3>
                  <p className="text-xs text-muted-foreground">Permanent and irreversible</p>
                </div>
              </div>

              {deleteError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-2 leading-relaxed">
                <p>
                  This will permanently delete your service catalog, verification status, uploaded KYC identity cards, and mobile phone profile.
                </p>
                <p className="text-[11px] text-muted-foreground/80">
                  You cannot delete your account while you have active service bookings in progress.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Enter password to confirm deletion:
                </label>
                <input
                  type="password"
                  placeholder="Enter current password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-red-500/30"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
                <button
                  type="button"
                  disabled={isDeletingAccount}
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingAccount}
                  onClick={handleDeleteAccount}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all cursor-pointer shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isDeletingAccount ? "Deleting..." : "Yes, Delete Provider Account"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
