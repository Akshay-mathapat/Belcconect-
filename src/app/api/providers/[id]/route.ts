import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const mockProviders: { [id: string]: any } = {
  "1": {
    id: "1",
    name: "Ramesh Sharma",
    phone: "+91 98765 11111",
    email: "ramesh@belconnect.com",
    avatar: "https://images.unsplash.com/photo-1540569014015-19a7be504e3a?auto=format&fit=crop&w=200&q=80",
    experience: 8,
    bio: "Certified HVAC Technician specializing in AC repair, gas refilling, filter cleaning, and complete maintenance services in Belagavi."
  },
  "2": {
    id: "2",
    name: "Suresh Kumar",
    phone: "+91 98765 22222",
    email: "suresh@belconnect.com",
    avatar: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=200&q=80",
    experience: 5,
    bio: "Licensed domestic electrician with expertise in home wiring, fuse box repairs, light installation, and general electrical diagnostics."
  },
  "3": {
    id: "3",
    name: "Anil Desai",
    phone: "+91 98765 33333",
    email: "anil@belconnect.com",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    experience: 12,
    bio: "Expert residential plumber with 12 years of experience fixing leaks, plumbing fixtures, pipeline installations, and drainage systems."
  },
  "4": {
    id: "4",
    name: "Priya Patil",
    phone: "+91 98765 44444",
    email: "priya@belconnect.com",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
    experience: 4,
    bio: "Professional home cleaning supervisor offering deep dusting, kitchen sanitation, bathroom scrub-downs, and eco-friendly house cleaning services."
  }
};

const mockReviews: { [id: string]: any[] } = {
  "1": [
    { customer_name: "Rahul V.", rating: 5, comment: "Excellent work! Ramesh fixed my split AC unit in no time and refilled the gas cleanly.", date: "2026-08-01", service_name: "AC Gas Refill" },
    { customer_name: "Karan S.", rating: 4, comment: "Prompt and professional service.", date: "2026-07-28", service_name: "AC filter cleaning" }
  ],
  "2": [
    { customer_name: "Vikram A.", rating: 5, comment: "Suresh solved a critical fuse box trip issue at night. Absolute life saver!", date: "2026-08-04", service_name: "Fuse repairs" }
  ],
  "3": [
    { customer_name: "Sneha G.", rating: 5, comment: "Punctual plumber. Fixed the sink leakage very fast with good materials.", date: "2026-08-02", service_name: "Plumbing services" }
  ],
  "4": [
    { customer_name: "Aarti M.", rating: 5, comment: "Priya and her cleaning crew left my kitchen sparkling clean. Incredible depth of service.", date: "2026-08-05", service_name: "Home Cleaning" }
  ]
};

const mockServices: { [id: string]: any[] } = {
  "1": [{ id: "mock-srv-1", name: "AC Gas Refill", description: "AC gas refilling and leak pressure testing.", category: "ac repair" }],
  "2": [{ id: "mock-srv-2", name: "Electrician Works", description: "Home wiring upgrades, switches replacements, fuse boxes.", category: "electrical" }],
  "3": [{ id: "mock-srv-3", name: "Plumbing Services", description: "Complete pipe repairs, leak blockages clearance, and taps installation.", category: "plumbing" }],
  "4": [{ id: "mock-srv-4", name: "Home Cleaning", description: "Dusting, floor scrubbing, vacuuming, and complete house sanitation.", category: "cleaning" }]
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // 1. If it's a mock provider
    if (mockProviders[id]) {
      return NextResponse.json({
        provider: mockProviders[id],
        services: mockServices[id] || [],
        reviews: mockReviews[id] || []
      });
    }

    // 2. Query real provider from the database
    const providerRes = await query(
      "SELECT id, name, email, phone, avatar FROM service_providers WHERE id = $1",
      [id]
    );

    if (providerRes.rows.length === 0) {
      // Fallback for provider-1 (default seeder) if it wasn't populated fully or matches defaults
      if (id === "provider-1") {
        return NextResponse.json({
          provider: {
            id: "provider-1",
            name: "Rohan Electrician",
            phone: "+91 98765 43210",
            email: "provider@belconnect.com",
            avatar: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=200&q=80",
            experience: 5,
            bio: "Experienced electrician providing top quality wiring repair, switchboard installations, and home safety inspections."
          },
          services: [
            { id: "srv-default", name: "Emergency Electrical Repairs", description: "Instant diagnosis and repair of shorts, socket sparks, and appliance faults.", category: "electrical" }
          ],
          reviews: []
        });
      }
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const provider = providerRes.rows[0];
    const servicesRes = await query(
      "SELECT id, name, category, description FROM services WHERE provider_id = $1",
      [id]
    );
    const reviewsRes = await query(
      `SELECT 
        b.rating, 
        b.review_comment AS comment, 
        b.date,
        b.service_name,
        c.name AS customer_name, 
        c.avatar AS customer_photo 
      FROM bookings b 
      LEFT JOIN customers c ON b.customer_id = c.id 
      WHERE b.provider_id = $1 AND b.rating IS NOT NULL AND b.rating > 0
      ORDER BY b.id DESC`,
      [id]
    );

    return NextResponse.json({
      provider: {
        id: provider.id,
        name: provider.name,
        phone: provider.phone || "+91 98765 43210",
        email: provider.email,
        avatar: provider.avatar || "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=200&q=80",
        experience: 4,
        bio: "Professional verified expert in Belagavi committed to providing fast and reliable services."
      },
      services: servicesRes.rows,
      reviews: reviewsRes.rows
    });
  } catch (error: any) {
    console.error("Error retrieving provider profile details:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
