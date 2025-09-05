import { NextRequest, NextResponse } from "next/server";
import { getIRIndexService } from "../../../services/ir-index-service";

interface SearchRequest {
  terms: string[];
  docIds?: string[];
  limit?: number;
  includePostings?: boolean;
}

// POST /api/ir-index/search - 搜索索引
export async function POST(request: NextRequest) {
  try {
    const body: SearchRequest = await request.json();
    const { terms, docIds, limit = 100, includePostings = false } = body;

    if (!terms || !Array.isArray(terms) || terms.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing or invalid terms array",
        },
        { status: 400 },
      );
    }

    const indexService = getIRIndexService();

    // 获取词汇信息
    const termData = await indexService.searchTerms(terms);

    // 获取倒排索引数据
    let postings: Map<string, any[]> = new Map();
    if (includePostings) {
      if (docIds && docIds.length > 0) {
        postings = await indexService.getPostingsForTermsInDocs(terms, docIds);
      } else {
        postings = await indexService.getPostingsForTerms(terms);
      }
    }

    // 转换为JSON格式
    const result = {
      terms: Object.fromEntries(termData),
      postings: includePostings ? Object.fromEntries(postings) : undefined,
      stats: {
        queryTerms: terms.length,
        foundTerms: termData.size,
        totalPostings: includePostings
          ? Array.from(postings.values()).reduce(
              (sum, arr) => sum + arr.length,
              0,
            )
          : 0,
      },
    };

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Search failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Search failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// GET /api/ir-index/search/stats - 获取搜索统计信息
export async function GET() {
  try {
    const indexService = getIRIndexService();
    const stats = await indexService.getIndexStats();

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Failed to get search stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get search stats",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
