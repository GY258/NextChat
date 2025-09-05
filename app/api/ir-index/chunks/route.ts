import { NextRequest, NextResponse } from "next/server";
import { getIRIndexService } from "../../../services/ir-index-service";

// POST /api/ir-index/chunks - 批量添加文本块
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chunks, docId } = body;

    if (!chunks || !Array.isArray(chunks)) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing or invalid chunks array",
        },
        { status: 400 },
      );
    }

    const indexService = getIRIndexService();

    if (docId) {
      // 如果指定了docId，只添加属于该文档的块
      const filteredChunks = chunks.filter((chunk) => chunk.docId === docId);
      const ids = await indexService.addChunks(filteredChunks);

      return NextResponse.json({
        success: true,
        data: { ids, count: filteredChunks.length },
        message: `Added ${filteredChunks.length} chunks for document ${docId}`,
      });
    } else {
      // 添加所有块
      const ids = await indexService.addChunks(chunks);

      return NextResponse.json({
        success: true,
        data: { ids, count: chunks.length },
        message: `Added ${chunks.length} chunks`,
      });
    }
  } catch (error) {
    console.error("Failed to add chunks:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to add chunks",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// GET /api/ir-index/chunks?docId=xxx - 获取指定文档的文本块
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("docId");

    if (!docId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing docId parameter",
        },
        { status: 400 },
      );
    }

    const indexService = getIRIndexService();
    const chunks = await indexService.getChunksByDocId(docId);

    return NextResponse.json({
      success: true,
      data: chunks,
      count: chunks.length,
    });
  } catch (error) {
    console.error("Failed to get chunks:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get chunks",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
