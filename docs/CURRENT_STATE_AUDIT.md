# BelConnect Site Polish & Mobile Quality: Step 0 Comprehensive Audit Report

**Branch**: `feat/site-polish` (branched from `feat/opaque-sessions` at commit `65f562b63ebf41b233da85b0ec1a8a1a485c5f59`)  
**Target Monorepo**: `belconnectt/frontend`  
**Audit Scope**: Read-only inspection of 58 routes, navigation, footer, links, buttons, typography, responsive viewports (360px, 390px, 414px, 768px), image assets, placeholders, and SEO metadata.  
**Compliance**: No touch on auth, sessions, CSRF, rate-limiting, migrations, or Android Java.

---

## 1. 20-Item Detailed Audit & Implementation Plan

| # | Checklist Item | Current State in Repo (File & Line) | What is Wrong | Planned Fix | Risk & Mitigation | Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **1** | **Remove horizontal scrolling (overflow-x)** | `frontend/src/app/globals.css:146-150`<br>`frontend/src/app/layout.tsx:111` | `globals.css` defines `overflow-x: clip`, which lacks full compatibility with older mobile WebViews. Root `body` in `layout.tsx` lacks `overflow-x-hidden w-full max-w-full`. Negative margins (`-mx-4 sm:-mx-6`) on hero and grid containers bleed out at 360px/390px. | Add `overflow-x-hidden w-full max-w-full relative` to root `body` in `layout.tsx` and ensure `html, body { overflow-x: hidden; }` fallback. Restrain full-bleed sections with `overflow-hidden`. | **Low**. Ensure `position: sticky` elements (e.g. Navigation) remain sticky when parents have `overflow-x: clip/hidden`. | **PARTIAL** |
| **2** | **Find broken links** | `src/components/provider/layout/ProviderNavbar.tsx:75`<br>`src/components/sections/Footer.tsx:81` | `/provider/notifications` links to non-existent route (returns 404). Social icons in `Footer.tsx` point to dead `href="#"`. | Update Provider notification bell to toggle notification dropdown drawer or link to `/provider/messages`. Update footer social links to official handles or appropriate anchors. | **Low**. Internal route integrity verified against 58 existing pages. | **NEEDS FIX** |
| **3** | **Mobile menu** | `src/components/sections/Navigation.tsx:1177-1520` | Mobile hamburger drawer exists, but lacks `aria-expanded` synchronization on toggle button, lacks keyboard focus trap, and does not close on Escape key. | Add `aria-expanded={mobileMenuOpen}`, `aria-controls="mobile-nav-menu"`, and Escape key listener with focus management. | **Low**. Purely improves accessibility and keyboard/touch navigation. | **PARTIAL** |
| **4** | **Add favicon & app icons** | `src/app/layout.tsx:83-84`<br>`src/app/icon.svg:1-4` | `favicon.ico` is missing in both `src/app/` and `public/` (returns 404 on browser requests). `src/app/icon.svg` contains legacy "C" letter with `#1F5F5B` green background (old CityConnect). | Provide standard multi-resolution `favicon.ico` (32x32) in `src/app/` and update `src/app/icon.svg` to BelConnect "B" icon with brand blue `#2563EB`. | **Low**. Enhances browser tab rendering and eliminates 404 log noise. | **NEEDS FIX** |
| **5** | **Fix page titles (metadata API)** | All 58 pages in `src/app/**/page.tsx` | 56 out of 58 routes inherit root title without custom titles. Two pages have modal titles as page title (`provider-profile/[id]` has "Log In to Block Provider", `services/[category]` has "Log In to Book Service"). | Add unique metadata title exports to every route utilizing the root layout template `%s \| BelConnect Belagavi`. | **Low**. Pure Next.js metadata API enhancements. | **NEEDS FIX** |
| **6** | **Meta descriptions for public pages** | Public routes (`/about`, `/services`, `/jobs`, `/contact`, `/terms`, `/privacy`, `/help`, etc.) | Public routes inherit default description from `layout.tsx`. Missing unique descriptions for search indexing. | Export concise, unique `description` strings (120–160 characters) on all public marketing and directory pages. | **Low**. Strictly improves SEO and social graph cards. | **NEEDS FIX** |
| **7** | **Fix footer links** | `src/components/sections/Footer.tsx:20-50` | Social links use `href="#"` (line 81) which jumps to page top. "Register as a Pro" links to `/auth?mode=signup&role=provider`. | Replace `#` with external links or accessible buttons. Verify all column routes (`/about`, `/careers`, `/blog`, `/contact`, `/services/*`, `/privacy`, `/terms`, `/cancellation`). | **Low**. All destination routes exist. | **NEEDS FIX** |
| **8** | **Custom 404 page (`app/not-found.tsx`)** | `src/app/not-found.tsx:27` | Page exists with links home and to services, but line 27 has a corrupted UTF-8 bullet character `Error 404 ? Page Not Found`. | Correct the corrupted character to `Error 404 • Page Not Found` (`&bull;` or standard bullet) and verify responsive layout. | **Zero**. Component already built. | **ALREADY DONE (Minor Polish)** |
| **9** | **Fix copyright year** | `src/components/sections/Footer.tsx:113` | `<span>© {new Date().getFullYear()} {SITE_NAME}</span>` executes dynamic date without `suppressHydrationWarning` or client mount hook, risking hydration mismatch. | Wrap with `suppressHydrationWarning` on the copyright `<span>` to ensure deterministic SSR and client hydration. | **Low**. Completely eliminates React hydration error risks. | **NEEDS FIX** |
| **10** | **Compress images** | `public/images/heroes/*.jpg` | 3 hero images exceed 200 KB: `plumbing.jpg` (751 KB), `electrician.jpg` (695 KB), `ac-repair.jpg` (675 KB). | Compress images with lossless/high-quality WebP/JPEG, preserving originals in backup or keeping under 180 KB. | **Low**. Retain original files until user explicitly approves deletion. | **NEEDS FIX** |
| **11** | **Fix broken buttons** | `src/app/provider/calendar/page.tsx:57-62`<br>`src/components/jobprovider/help/HelpPanel.tsx:136,150,165`<br>`src/components/jobprovider/settings/SettingsPanel.tsx:327` | Calendar previous/next buttons have zero `onClick` handlers. HelpPanel "Start Live Chat", "Send Email Ticket", "Request Callback" have no handlers. Settings password button has no handler. | Wire calendar navigation state (`prevMonth`, `nextMonth`), connect HelpPanel buttons to email/chat routes, and wire settings submit handlers. | **Medium**. Requires state wiring without altering session auth. | **NEEDS FIX** |
| **12** | **Add accessible success messages** | `src/app/contact/page.tsx`<br>`src/app/feedback/page.tsx`<br>`src/app/provider/profile/page.tsx` | Success states exist as static divs without `aria-live="polite"` or `role="status"` for screen readers. Profile save lacks visual confirmation banner. | Add `role="status"` and `aria-live="polite"` to feedback alerts; introduce styled banner feedback upon successful profile and setting saves. | **Low**. Accessibility and UX enhancement. | **NEEDS FIX** |
| **13** | **Plain language error messages** | `src/app/contact/page.tsx:60`<br>`src/app/feedback/page.tsx:48` | Fallback error messages occasionally dump raw server string `data.error \|\| "Failed to submit..."`. | Sanitize error displays to user-friendly messages (`"Unable to send message right now. Please check your connection and try again."`) with `role="alert"`. | **Low**. Prevents internal error leakage. | **NEEDS FIX** |
| **14** | **Remove placeholder text** | `src/components/jobprovider/help/HelpPanel.tsx:107`<br>`src/app/provider/kyc/page.tsx:673`<br>`src/components/auth/SignupForm.tsx:290` | Dummy helpline `18001234567` in HelpPanel. Dummy text `Contact Support at +91 98765 43210` in KYC. `aarav.sharma@example.com` in signup. | Replace dummy numbers with real BelConnect support details or user-provided helpline. Replace `example.com` with generic descriptive placeholders. | **Input Needed**. User must confirm official helpline number. | **NEEDS FIX** |
| **15** | **Remove unused navigation items** | `src/components/provider/layout/ProviderNavbar.tsx:75`<br>`src/constants/site.ts:47` | `/provider/notifications` is dead. `/job-provider` is redundant with `/jobprovider`. | Point navbar notification link to active messages/bookings or remove icon. Keep `/job-provider` redirect intact (do not delete file). | **Low**. Route redirection preserved. | **NEEDS FIX** |
| **16** | **Fix mobile component overflow** | `src/app/bookings/[id]/page.tsx:964`<br>`src/app/jobs/[id]/page.tsx:563`<br>`src/app/admin/page.tsx:645` | Certain modal dialogs lack `overflow-y-auto` on small heights. Long booking IDs and user tokens overflow card boundaries on 360px screens. | Add `break-all` / `truncate` on ID chips and ensure modal backdrops have `overflow-y-auto max-h-[90vh]`. | **Low**. Prevents clipped modal content on small screens. | **NEEDS FIX** |
| **17** | **Make logo link to home page everywhere** | `src/app/jobprovider/JobProviderClientLayout.tsx:162`<br>`src/app/provider/ProviderClientLayout.tsx:196`<br>`src/components/provider/layout/ProviderSidebar.tsx:243` | JobProvider layout links logo to `/jobprovider/dashboard`. Provider layout links logo to `/provider`. | Update logo brand wrappers to link to `/` (Home), adding secondary breadcrumb or portal label linking to dashboard. | **Low**. Ensures consistent global logo behavior across all portals. | **NEEDS FIX** |
| **18** | **Make phone number clickable (`tel:`)** | `src/components/jobprovider/help/HelpPanel.tsx:107`<br>`src/app/provider/kyc/page.tsx:673` | HelpPanel has `href="tel:18001234567"` (dummy number). KYC page lists `+91 98765 43210` as plain text without `tel:`. | Replace with verified official support phone number and format as `<a href="tel:+91..." className="...">`. | **Input Needed**. User must provide the official phone number. | **NEEDS FIX** |
| **19** | **Make email clickable (`mailto:`)** | `src/components/jobprovider/help/HelpPanel.tsx:148`<br>`src/app/provider/ekyc/status/page.tsx:260` | `HelpPanel.tsx:148` displays `employers@belconnect.com` as plain unclickable text. `ekyc/status` uses `.com` instead of `.in`. | Wrap with `<a href="mailto:support@belconnect.in">` and normalize domain to `support@belconnect.in`. | **Low**. All email links will open native email client. | **NEEDS FIX** |
| **20** | **Mobile viewport optimization (360, 390, 414, 768)** | `src/components/sections/Navigation.tsx`<br>`src/components/sections/Hero.tsx` | Touch tap targets on icon buttons in header (search toggle, language dropdown) are `36px` (`h-9 w-9`), below the recommended 44px touch target standard. | Ensure minimum touch target `min-h-[44px] min-w-[44px]` via padding or invisible pseudo-elements without disrupting layout. | **Low**. Enhances Android WebView touch responsiveness. | **NEEDS FIX** |

---

## 2. Comprehensive Route, Metadata & H1 Audit (58 Pages)

```
Total Page Routes Audited: 58
Status: 56 routes inherit root metadata; 2 routes contain modal title collisions.
```

| Route URL | Current Metadata Title | Current Meta Description | `<h1>` Heading in DOM | File Path |
| :--- | :--- | :--- | :--- | :--- |
| `/` | `BelConnect - Book Trusted Home Services in Belagavi` | `Default Description (Belagavi Home Services)` | None (Hero uses styled divs) | `src/app/page.tsx` |
| `/about` | *Inherits root layout* | *Inherits root layout* | "About BelConnect" | `src/app/about/page.tsx` |
| `/account` | *Inherits root layout* | *Inherits root layout* | None | `src/app/account/page.tsx` |
| `/admin` | *Inherits root layout* | *Inherits root layout* | "BelConnect Admin" | `src/app/admin/page.tsx` |
| `/auth` | *Inherits root layout* | *Inherits root layout* | None | `src/app/auth/page.tsx` |
| `/blog` | *Inherits root layout* | *Inherits root layout* | "Blog & Articles" | `src/app/blog/page.tsx` |
| `/book` | *Inherits root layout* | *Inherits root layout* | "Book a Service" | `src/app/book/page.tsx` |
| `/bookings` | *Inherits root layout* | *Inherits root layout* | "My Bookings & Live Tracking" | `src/app/bookings/page.tsx` |
| `/bookings/[id]` | *Inherits root layout* | *Inherits root layout* | None | `src/app/bookings/[id]/page.tsx` |
| `/cancellation` | *Inherits root layout* | *Inherits root layout* | "Cancellation Policy" | `src/app/cancellation/page.tsx` |
| `/careers` | *Inherits root layout* | *Inherits root layout* | "Careers at BelConnect" | `src/app/careers/page.tsx` |
| `/contact` | *Inherits root layout* | *Inherits root layout* | "Contact & Support" | `src/app/contact/page.tsx` |
| `/delete-account` | *Inherits root layout* | *Inherits root layout* | "Request Account & Data Deletion" | `src/app/delete-account/page.tsx` |
| `/feedback` | *Inherits root layout* | *Inherits root layout* | "Send Feedback" | `src/app/feedback/page.tsx` |
| `/help` | *Inherits root layout* | *Inherits root layout* | "How can we help you?" | `src/app/help/page.tsx` |
| `/job-provider` | *Inherits root layout* | *Inherits root layout* | None (Redirect wrapper) | `src/app/job-provider/page.tsx` |
| `/jobprovider` | *Inherits root layout* | *Inherits root layout* | None | `src/app/jobprovider/page.tsx` |
| `/jobprovider/analytics` | *Inherits root layout* | *Inherits root layout* | None | `src/app/jobprovider/analytics/page.tsx` |
| `/jobprovider/business-profile` | *Inherits root layout* | *Inherits root layout* | None | `src/app/jobprovider/business-profile/page.tsx` |
| `/jobprovider/candidates` | *Inherits root layout* | *Inherits root layout* | None | `src/app/jobprovider/candidates/page.tsx` |
| `/jobprovider/dashboard` | *Inherits root layout* | *Inherits root layout* | None | `src/app/jobprovider/dashboard/page.tsx` |
| `/jobprovider/help` | *Inherits root layout* | *Inherits root layout* | None | `src/app/jobprovider/help/page.tsx` |
| `/jobprovider/interviews` | *Inherits root layout* | *Inherits root layout* | None | `src/app/jobprovider/interviews/page.tsx` |
| `/jobprovider/jobs` | *Inherits root layout* | *Inherits root layout* | None | `src/app/jobprovider/jobs/page.tsx` |
| `/jobprovider/messages` | *Inherits root layout* | *Inherits root layout* | None | `src/app/jobprovider/messages/page.tsx` |
| `/jobprovider/post-job` | *Inherits root layout* | *Inherits root layout* | None | `src/app/jobprovider/post-job/page.tsx` |
| `/jobprovider/settings` | *Inherits root layout* | *Inherits root layout* | None | `src/app/jobprovider/settings/page.tsx` |
| `/jobs` | *Inherits root layout* | *Inherits root layout* | "Find Your Next Career Opportunity in Belagavi" | `src/app/jobs/page.tsx` |
| `/jobs/applications` | *Inherits root layout* | *Inherits root layout* | "My Job Applications" | `src/app/jobs/applications/page.tsx` |
| `/jobs/[id]` | *Inherits root layout* | *Inherits root layout* | None (dynamic job title in card) | `src/app/jobs/[id]/page.tsx` |
| `/login` | *Inherits root layout* | *Inherits root layout* | None | `src/app/login/page.tsx` |
| `/privacy` | *Inherits root layout* | *Inherits root layout* | "Privacy Policy" | `src/app/privacy/page.tsx` |
| `/provider` | *Inherits root layout* | *Inherits root layout* | "Welcome, Pro" | `src/app/provider/page.tsx` |
| `/provider/availability` | *Inherits root layout* | *Inherits root layout* | "Weekly Working Hours & Availability" | `src/app/provider/availability/page.tsx` |
| `/provider/bookings` | *Inherits root layout* | *Inherits root layout* | "Service Bookings" | `src/app/provider/bookings/page.tsx` |
| `/provider/bookings/[id]` | *Inherits root layout* | *Inherits root layout* | None | `src/app/provider/bookings/[id]/page.tsx` |
| `/provider/calendar` | *Inherits root layout* | *Inherits root layout* | "Job Schedule" | `src/app/provider/calendar/page.tsx` |
| `/provider/ekyc` | *Inherits root layout* | *Inherits root layout* | None | `src/app/provider/ekyc/page.tsx` |
| `/provider/ekyc/document` | *Inherits root layout* | *Inherits root layout* | None | `src/app/provider/ekyc/document/page.tsx` |
| `/provider/ekyc/selfie` | *Inherits root layout* | *Inherits root layout* | None | `src/app/provider/ekyc/selfie/page.tsx` |
| `/provider/ekyc/status` | *Inherits root layout* | *Inherits root layout* | None | `src/app/provider/ekyc/status/page.tsx` |
| `/provider/ekyc/success` | *Inherits root layout* | *Inherits root layout* | None | `src/app/provider/ekyc/success/page.tsx` |
| `/provider/ekyc/verification` | *Inherits root layout* | *Inherits root layout* | None | `src/app/provider/ekyc/verification/page.tsx` |
| `/provider/kyc` | *Inherits root layout* | *Inherits root layout* | "Compulsory KYC Identity Verification" | `src/app/provider/kyc/page.tsx` |
| `/provider/messages` | *Inherits root layout* | *Inherits root layout* | None | `src/app/provider/messages/page.tsx` |
| `/provider/payments` | *Inherits root layout* | *Inherits root layout* | "Financials & Payouts" | `src/app/provider/payments/page.tsx` |
| `/provider/portfolio` | *Inherits root layout* | *Inherits root layout* | None | `src/app/provider/portfolio/page.tsx` |
| `/provider/profile` | *Inherits root layout* | *Inherits root layout* | "Provider Profile" | `src/app/provider/profile/page.tsx` |
| `/provider/reviews` | *Inherits root layout* | *Inherits root layout* | "Customer Reviews & Ratings" | `src/app/provider/reviews/page.tsx` |
| `/provider/services` | *Inherits root layout* | *Inherits root layout* | "My Services & Rates" | `src/app/provider/services/page.tsx` |
| `/provider/services/new` | *Inherits root layout* | *Inherits root layout* | None | `src/app/provider/services/new/page.tsx` |
| `/provider-profile/[id]` | **"Log In to Block Provider"** (Bug) | *Inherits root layout* | None | `src/app/provider-profile/[id]/page.tsx` |
| `/register` | *Inherits root layout* | *Inherits root layout* | None | `src/app/register/page.tsx` |
| `/register/provider` | *Inherits root layout* | *Inherits root layout* | None | `src/app/register/provider/page.tsx` |
| `/services` | *Inherits root layout* | *Inherits root layout* | "Explore All Services in Belagavi" | `src/app/services/page.tsx` |
| `/services/[category]` | **"Log In to Book Service"** (Bug) | *Inherits root layout* | None | `src/app/services/[category]/page.tsx` |
| `/support` | *Inherits root layout* | *Inherits root layout* | "Contact Support" | `src/app/support/page.tsx` |
| `/terms` | *Inherits root layout* | *Inherits root layout* | "Terms of Service" | `src/app/terms/page.tsx` |

---

## 3. Large Assets Audit (> 200 KB in `public/` and `src/`)

```
Source Directory: frontend/src -> 0 files > 200 KB
Public Directory: frontend/public -> 6 files > 200 KB (3 hero images, 3 audio files)
```

| File Path | Type | Current Size | Status / Planned Action |
| :--- | :---: | :---: | :--- |
| `public/images/heroes/plumbing.jpg` | Image | **751.15 KB** | Compress to WebP / optimized JPEG (< 180 KB), retaining original backup. |
| `public/images/heroes/electrician.jpg` | Image | **694.86 KB** | Compress to WebP / optimized JPEG (< 180 KB), retaining original backup. |
| `public/images/heroes/ac-repair.jpg` | Image | **675.17 KB** | Compress to WebP / optimized JPEG (< 180 KB), retaining original backup. |
| `public/sounds/phone-ringing.mp3` | Audio | 302.04 KB | Incoming call ringtone. Kept as-is (audio asset). |
| `public/sounds/belconnect_incoming_call.mp3` | Audio | 302.04 KB | Incoming call ringtone. Kept as-is (audio asset). |
| `public/sounds/ringtone.wav` | Audio | 275.17 KB | WebRTC call chime. Kept as-is (audio asset). |

---

## 4. Business Identity, Contact & Grievance Officer Audit

| Entity | Exact Repo Location | Current Value | State |
| :--- | :--- | :--- | :--- |
| **Brand Name** | `src/constants/site.ts:2` | `BelConnect` | FOUND IN REPO |
| **Grievance Officer** | `src/app/privacy/page.tsx:83`<br>`src/app/terms/page.tsx:75` | `Akshay Mathapati` | FOUND IN REPO |
| **Grievance Email** | `src/lib/seo.ts:61`<br>`src/app/privacy/page.tsx:84` | `grievance@belconnect.in` | FOUND IN REPO `mailto:` |
| **Support Email** | `src/lib/seo.ts:60`<br>`src/app/privacy/page.tsx:85` | `support@belconnect.in` | FOUND IN REPO (Found minor `.com` variant in `ekyc/status` to normalize) |
| **Physical Address** | `src/app/privacy/page.tsx:86`<br>`src/app/terms/page.tsx:78` | `Belagavi, Karnataka, India - 590001` | FOUND IN REPO |
| **Helpline / Phone** | `src/components/jobprovider/help/HelpPanel.tsx:107`<br>`src/app/provider/kyc/page.tsx:673` | `18001234567` (dummy)<br>`+91 98765 43210` (dummy) | ⚠️ **PLACEHOLDER DETECTED** (Need User Input for real customer helpline) |

---

## 5. Year & Placeholder Text Audit

1. **Copyright Year**:
   - `src/components/sections/Footer.tsx:113`:  
     `<span>© {new Date().getFullYear()} {SITE_NAME}. {t("footer.copyright")}</span>`  
     *Issue*: Executed directly during render; needs `suppressHydrationWarning`.
2. **Hardcoded Month / Year**:
   - `src/app/provider/calendar/page.tsx:55`: `<span>{t("serviceProvider.july2026")}</span>` (hardcoded July 2026 string).
   - `src/lib/translations/*.json`: `profileVerified` contains `"Last updated Jul 2026"`.
3. **Placeholder Emails & Numbers in UI**:
   - `src/components/jobprovider/help/HelpPanel.tsx:107`: `tel:18001234567` (Helpline placeholder).
   - `src/app/provider/kyc/page.tsx:673`: `+91 98765 43210` (Support number placeholder).
   - `src/components/auth/SignupForm.tsx:290`: `aarav.sharma@example.com` (input placeholder).

---

## 6. Questions for User Approval Before Commencing Phase 1

1. **Official Support Helpline Number**:
   `HelpPanel.tsx` currently has `18001234567` and `provider/kyc` mentions `+91 98765 43210`. What is the official telephone number to configure for BelConnect (or should helpline card state *"Email & In-App Ticket Support available 24/7"* if no toll-free trunk line is active)?
2. **Footer Social Icons**:
   `Footer.tsx` has Twitter/X, Facebook, Instagram, LinkedIn with `href="#"`. Should these point to your specific social handle URLs or should we retain clean disabled buttons until handles are registered?
3. **Hero Image Compression**:
   May we generate optimized `.webp` copies of `plumbing.jpg`, `electrician.jpg`, and `ac-repair.jpg` (saving ~1.5 MB total transfer size) while keeping the original high-res files preserved in `public/images/heroes/originals/`?
