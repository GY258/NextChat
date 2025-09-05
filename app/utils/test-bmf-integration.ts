/**
 * BMF Integration Test Utility
 *
 * 用于测试BMF搜索服务集成的工具
 */

import { BMFSearchService } from "../services/bmf-search-service";
import { enhanceMessageWithBMFDocuments } from "./bmf-document-rag-plugin";
import { getBMFConfig } from "../config/bmf-search";

export async function testBMFSearchService(
  query: string = "猪肝",
): Promise<void> {
  console.log("🧪 [BMF Test] Starting BMF search service test...");

  const config = getBMFConfig();
  console.log("📋 [BMF Test] Configuration:", config);

  const searchService = BMFSearchService.getInstance();

  try {
    // 健康检查
    console.log("🏥 [BMF Test] Performing health check...");
    const isHealthy = await searchService.healthCheck();
    console.log("🏥 [BMF Test] Health check result:", isHealthy);

    if (!isHealthy) {
      console.error(
        "❌ [BMF Test] BMF service is not healthy, skipping search test",
      );
      return;
    }

    // 获取服务信息
    console.log("ℹ️ [BMF Test] Getting service info...");
    const serviceInfo = await searchService.getServiceInfo();
    console.log("ℹ️ [BMF Test] Service info:", serviceInfo);

    // 执行搜索测试
    console.log(`🔍 [BMF Test] Testing search with query: "${query}"`);
    const searchResult = await searchService.search({
      query: query,
      limit: 3,
      include_snippets: true,
    });

    console.log("📊 [BMF Test] Search results:", {
      resultsCount: searchResult.results.length,
      took: searchResult.took_ms,
      query: searchResult.query,
    });

    searchResult.results.forEach((result, index) => {
      console.log(`📄 [BMF Test] Result ${index + 1}:`, {
        score: result.score,
        source: result.metadata?.source,
        contentPreview: result.content.substring(0, 100) + "...",
        snippetsCount: result.snippets?.length || 0,
      });
    });

    // 测试消息增强
    console.log(
      `🚀 [BMF Test] Testing message enhancement with query: "${query}"`,
    );
    const enhancement = await enhanceMessageWithBMFDocuments(query);

    console.log("✨ [BMF Test] Enhancement result:", {
      hasContext: enhancement.hasContext,
      sourcesCount: enhancement.sources.length,
      enhancedLength: enhancement.enhancedMessage.length,
      sources: enhancement.sources,
    });

    if (enhancement.hasContext) {
      console.log(
        "📝 [BMF Test] Enhanced message preview:",
        enhancement.enhancedMessage.substring(0, 300) + "...",
      );
    }

    console.log("✅ [BMF Test] All tests completed successfully!");
  } catch (error) {
    console.error("❌ [BMF Test] Test failed:", error);
    throw error;
  }
}

export async function testBMFSearchWithCustomQuery(
  query: string,
): Promise<void> {
  return testBMFSearchService(query);
}
