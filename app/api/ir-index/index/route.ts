import { NextRequest, NextResponse } from "next/server";
import { getIRIndexService } from "../../../services/ir-index-service";

// POST /api/ir-index/index - 添加索引数据（词汇和倒排索引）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { terms, postings, stats } = body;

    const indexService = getIRIndexService();

    // 添加词汇
    if (terms && Array.isArray(terms)) {
      await indexService.addTerms(terms);
    }

    // 添加倒排索引
    if (postings && Array.isArray(postings)) {
      await indexService.addPostings(postings);
    }

    // 更新统计信息
    if (stats) {
      await indexService.updateIndexStats(stats);
    }

    return NextResponse.json({
      success: true,
      data: {
        termsAdded: terms?.length || 0,
        postingsAdded: postings?.length || 0,
        statsUpdated: !!stats,
      },
      message: "Index data added successfully",
    });
  } catch (error) {
    console.error("Failed to add index data:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to add index data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// GET /api/ir-index/index/stats - 获取索引统计信息
export async function GET() {
  try {
    const indexService = getIRIndexService();
    const stats = await indexService.getIndexStats();

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Failed to get index stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get index stats",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// PUT /api/ir-index/index/reindex - 重建全部索引
export async function PUT() {
  try {
    const indexService = getIRIndexService();
    await indexService.reindexAll();

    return NextResponse.json({
      success: true,
      message: "Reindex completed successfully",
    });
  } catch (error) {
    console.error("Failed to reindex:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reindex",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// DELETE /api/ir-index/index - 清空索引
export async function DELETE() {
  try {
    const indexService = getIRIndexService();
    await indexService.reindexAll(); // 清空索引

    return NextResponse.json({
      success: true,
      message: "Index cleared successfully",
    });
  } catch (error) {
    console.error("Failed to clear index:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to clear index",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
