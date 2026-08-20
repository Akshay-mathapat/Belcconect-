import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");

    if (!latStr || !lngStr) {
      return NextResponse.json({ error: "Missing lat and lng parameters" }, { status: 400 });
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: "Invalid lat/lng range" }, { status: 400 });
    }

    const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (googleKey) {
      try {
        const googleRes = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleKey}`
        );
        const googleData = await googleRes.json();
        if (googleData.status === "OK" && googleData.results.length > 0) {
          const top = googleData.results[0];
          let locality = "";
          let city = "";
          let state = "";
          let pincode = "";

          top.address_components.forEach((comp: any) => {
            if (comp.types.includes("sublocality") || comp.types.includes("neighborhood")) {
              locality = comp.long_name;
            }
            if (comp.types.includes("locality")) {
              city = comp.long_name;
            }
            if (comp.types.includes("administrative_area_level_1")) {
              state = comp.long_name;
            }
            if (comp.types.includes("postal_code")) {
              pincode = comp.long_name;
            }
          });

          return NextResponse.json({
            success: true,
            provider: "google",
            address: top.formatted_address,
            placeId: top.place_id,
            locality: locality || city,
            city: city || locality || "Belagavi",
            state: state || "Karnataka",
            pincode
          });
        }
      } catch (err) {
        console.warn("Google Maps reverse geocode failed, falling back to OSM Nominatim:", err);
      }
    }

    // Fallback: OpenStreetMap Nominatim reverse geocoding API
    const osmRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          "User-Agent": "CityConnect-LocationSystem/1.0 (contact@cityconnect.in)"
        }
      }
    );

    if (!osmRes.ok) {
      throw new Error(`OSM Nominatim returned status ${osmRes.status}`);
    }

    const osmData = await osmRes.json();
    const addr = osmData.address || {};

    const locality = addr.suburb || addr.neighbourhood || addr.residential || addr.road || "";
    const city = addr.city || addr.town || addr.village || addr.county || "Belagavi";
    const state = addr.state || "Karnataka";
    const pincode = addr.postcode || "";
    const buildingName = addr.building || addr.amenity || addr.historic || "";

    const parts = [buildingName, locality, city, state, pincode].filter(Boolean);
    const formatted = osmData.display_name || parts.join(", ");

    return NextResponse.json({
      success: true,
      provider: "openstreetmap",
      address: formatted,
      placeId: osmData.place_id ? `osm-${osmData.place_id}` : null,
      buildingName,
      locality: locality || city,
      city,
      state,
      pincode
    });
  } catch (error: any) {
    console.error("Reverse geocoding error:", error);
    return NextResponse.json({
      error: error.message || "Failed to reverse geocode location",
      address: "Selected Location, Belagavi"
    }, { status: 500 });
  }
}
