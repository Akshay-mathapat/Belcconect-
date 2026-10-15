import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const alt = "BelConnect - Trusted Local Services & Jobs in Belagavi";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          backgroundColor: "#090D16",
          color: "#FFFFFF",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Glow Effects */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            right: "-50px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37, 99, 235, 0.35) 0%, rgba(37, 99, 235, 0) 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-100px",
            left: "-50px",
            width: "450px",
            height: "450px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(79, 70, 229, 0.25) 0%, rgba(79, 70, 229, 0) 70%)",
          }}
        />

        {/* Top Header: Brand & Location Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          {/* Logo + Brand Name */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "18px",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "16px",
                backgroundColor: "#2563EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
                fontWeight: 900,
                color: "#FFFFFF",
                boxShadow: "0 8px 24px rgba(37, 99, 235, 0.4)",
              }}
            >
              BC
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: "36px",
                  fontWeight: 900,
                  letterSpacing: "-0.03em",
                  color: "#FFFFFF",
                }}
              >
                BelConnect
              </span>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#60A5FA",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Belagavi, Karnataka
              </span>
            </div>
          </div>

          {/* Location Scope Pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              borderRadius: "9999px",
              backgroundColor: "rgba(37, 99, 235, 0.15)",
              border: "1.5px solid rgba(59, 130, 246, 0.35)",
              fontSize: "15px",
              fontWeight: 700,
              color: "#93C5FD",
            }}
          >
            <span>📍 Belagavi (Belgaum) Local Hub</span>
          </div>
        </div>

        {/* Center: Main Value Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            maxWidth: "960px",
          }}
        >
          <div
            style={{
              fontSize: "60px",
              fontWeight: 900,
              lineHeight: 1.14,
              letterSpacing: "-0.03em",
              color: "#F8FAFC",
            }}
          >
            Trusted Local Services & Jobs in Belagavi
          </div>

          <div
            style={{
              fontSize: "24px",
              fontWeight: 500,
              lineHeight: 1.4,
              color: "#94A3B8",
            }}
          >
            Book verified home professionals or discover local career opportunities across Belagavi. Fast, reliable, and verified.
          </div>
        </div>

        {/* Bottom Footer: Categories & Domain */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            borderTop: "1.5px solid rgba(255, 255, 255, 0.1)",
            paddingTop: "24px",
          }}
        >
          {/* Quick Categories */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            {["Electrician", "Plumber", "AC Repair", "Cleaning", "Jobs & Hiring"].map((cat) => (
              <span
                key={cat}
                style={{
                  padding: "8px 16px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#E2E8F0",
                }}
              >
                {cat}
              </span>
            ))}
          </div>

          {/* Domain */}
          <div
            style={{
              fontSize: "18px",
              fontWeight: 800,
              color: "#38BDF8",
              letterSpacing: "0.02em",
            }}
          >
            belconnect.in
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

