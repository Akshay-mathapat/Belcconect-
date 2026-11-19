# UI Architectural Decisions: Category Bar Retention

**Date:** 19 November 2026  
**Decision:** Retain the persistent desktop Category Bar component (`frontend/src/components/sections/CategoryBar.tsx`).  
**Status:** Approved & Preserved.

---

## 1. Component Inventory

The `CategoryBar` is a fixed desktop sub-navigation bar (height: 48px, `h-12`) positioned at `top: 64px` (`top-16`) directly beneath the primary navbar. It consists of three functional elements:

1. **All Categories Mega-Menu (`All Categories`):**
   - **Trigger:** Outline pill button with `LayoutGrid` icon and animated chevron.
   - **Menu Panel:** 820px wide structured mega-menu divided into two top-level sections:
     - *Home & Property:* Home Repairs & Maintenance (`electrical`, `plumbing`, `ac-repair`, `carpentry`), Cleaning & Pest Control (`cleaning`, `pest-control`), Renovations & Improvements (`painting`).
     - *Lifestyle & Professional:* Personal Care (`salon`, `pet-care`), Tech & Education (`it`, `education`).
   - **Accessibility:** Keyboard navigable with `focus-visible:ring-2 focus-visible:ring-primary`, `text-[#1D4ED8]` contrast token (~5.8:1 on light background).

2. **Horizontal Quick Categories Bar (`quickCategories`):**
   - **Controls:** Left and right chevron scroll buttons with smooth horizontal scrolling.
   - **Pills:** 11 category pills (`electrical`, `plumbing`, `cleaning`, `pest-control`, `ac-repair`, `painting`, `salon`, `carpentry`, `education`, `it`, `pet-care`) with dedicated icons and direct links to `/services/[category]`.

3. **Jobs & Hiring Dropdown (`Jobs`):**
   - **Trigger:** Ghost pill with `Briefcase` icon, optional `NEW` tag (controlled via `SHOW_JOBS_NEW_TAG`), and chevron.
   - **Menu Panel:** Direct navigation links to "Find Jobs" (`/jobs`) and "Employer Dashboard" (`/job-provider`).

---

## 2. Rendering Scope & Affected Routes

`CategoryBar` is mounted globally within `frontend/src/components/sections/Navigation.tsx` (line 1153) and renders on every public consumer route on desktop viewports (`lg:` breakpoint and above):
* **Homepage:** `/` (remains visible when scrolling up, seamlessly integrates with Hero).
* **Services Directory & Detail:** `/services`, `/services/[category]`.
* **Jobs Directory & Detail:** `/jobs`, `/jobs/[id]`.
* **Customer Account & Bookings:** `/account`, `/bookings`, `/bookings/[id]`.
* **Support & Legal Pages:** `/help`, `/feedback`, `/privacy`, `/terms`.

**Excluded Routes (Deliberately Suppressed):**
* `/provider*` (Service Provider Dashboard & KYC flows)
* `/jobprovider*` (Employer Workspace & Applicant Management)

---

## 3. Rationale for Retention

1. **Immediate Category Orientation (OLX / Urban Company Paradigm):**  
   Marketplace user testing confirms that users arriving on internal pages (e.g. searching from `/jobs` or checking `/bookings`) require 1-click access to switch service categories without returning to the homepage.
2. **Eliminates Header Clutter:**  
   By housing the 11 service categories in a clean horizontal strip, the main navbar (`h-16`) remains uncrowded with room for search, language selection, and user profile controls.
3. **High Accessibility:**  
   The Category Bar buttons provide full keyboard focus rings, touch targets, and high-contrast color tokens exceeding WCAG 2.1 AA (4.5:1).
