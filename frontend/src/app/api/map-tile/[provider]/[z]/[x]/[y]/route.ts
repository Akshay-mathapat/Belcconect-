const TILE_SOURCES = {
  osm: (z: string, x: string, y: string) =>
    `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  esri: (z: string, x: string, y: string) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
} as const;

function isTileCoordinate(value: string) {
  return /^\d{1,8}$/.test(value);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string; z: string; x: string; y: string }> }
) {
  const { provider, z, x, y: rawY } = await params;
  const y = rawY.replace(/\.png$/, "");
  const sourceBuilder = TILE_SOURCES[provider as keyof typeof TILE_SOURCES];

  if (!sourceBuilder || !isTileCoordinate(z) || !isTileCoordinate(x) || !isTileCoordinate(y)) {
    return new Response("Invalid map tile", { status: 400 });
  }

  try {
    const upstream = await fetch(sourceBuilder(z, x, y), {
      headers: { "User-Agent": "BelConnect/1.0 map tile proxy" },
      next: { revalidate: 86400 },
    });

    if (!upstream.ok) {
      return new Response("Map tile unavailable", { status: upstream.status });
    }

    return new Response(await upstream.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("Map tile unavailable", { status: 502 });
  }
}
