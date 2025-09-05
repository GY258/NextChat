import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { query, limit = 5, minScore = 0.1 } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Invalid query provided" },
        { status: 400 },
      );
    }

    // This endpoint will be called by the plugin system
    // The actual search will be handled by the frontend document store
    // We return a format that indicates this should be handled client-side
    return NextResponse.json({
      action: "client-side-search",
      query,
      limit,
      minScore,
      message: "Search will be performed using local document store",
    });
  } catch (error) {
    console.error("Document search API error:", error);
    return NextResponse.json(
      { error: "Failed to search documents" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Document search API is active",
    endpoints: ["/search", "/context"],
  });
}
