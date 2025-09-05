import { NextRequest, NextResponse } from "next/server";
import { getIRIndexService } from "../../../../services/ir-index-service";

// GET /api/ir-index/documents/[id] - 获取指定文档
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const indexService = getIRIndexService();
    const document = await indexService.getDocument(id);

    if (!document) {
      return NextResponse.json(
        {
          success: false,
          error: "Document not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: document,
    });
  } catch (error) {
    console.error("Failed to get document:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get document",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// PUT /api/ir-index/documents/[id] - 更新文档
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const updates = await request.json();

    const indexService = getIRIndexService();
    await indexService.updateDocument(id, updates);

    return NextResponse.json({
      success: true,
      message: "Document updated successfully",
    });
  } catch (error) {
    console.error("Failed to update document:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update document",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// DELETE /api/ir-index/documents/[id] - 删除文档
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const indexService = getIRIndexService();
    await indexService.deleteDocument(id);

    return NextResponse.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete document:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete document",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
