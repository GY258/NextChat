import { NextRequest, NextResponse } from "next/server";
import { getIRIndexService } from "../../../services/ir-index-service";

// GET /api/ir-index/documents - 获取所有文档
export async function GET() {
  try {
    const indexService = getIRIndexService();
    const documents = await indexService.getAllDocuments();

    return NextResponse.json({
      success: true,
      data: documents,
      count: documents.length,
    });
  } catch (error) {
    console.error("Failed to get documents:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get documents",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// POST /api/ir-index/documents - 添加新文档
export async function POST(request: NextRequest) {
  try {
    const document = await request.json();

    if (!document.id || !document.fileName) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: id, fileName",
        },
        { status: 400 },
      );
    }

    const indexService = getIRIndexService();
    const id = await indexService.addDocument(document);

    return NextResponse.json({
      success: true,
      data: { id },
      message: "Document added successfully",
    });
  } catch (error) {
    console.error("Failed to add document:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to add document",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
