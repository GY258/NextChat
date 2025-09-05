import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { query, maxTokens = 2000 } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Invalid query provided" },
        { status: 400 },
      );
    }

    // This endpoint will be called by the plugin system
    // The actual context retrieval will be handled by the frontend document store
    return NextResponse.json({
      action: "client-side-context",
      query,
      maxTokens,
      message: "Context will be retrieved using local document store",
    });
  } catch (error) {
    console.error("Document context API error:", error);
    return NextResponse.json(
      { error: "Failed to get document context" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Document context API is active",
  });
}
