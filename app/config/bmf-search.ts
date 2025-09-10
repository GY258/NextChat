/**
 * BMF Search Service Configuration
 */

export interface BMFSearchConfig {
  enabled: boolean;
  baseUrl: string;
  maxContextTokens: number;
  searchLimit: number;
  includeSnippets: boolean;
  healthCheckTimeout: number;
  enhanceMinLength: number;
}

export const DEFAULT_BMF_CONFIG: BMFSearchConfig = {
  enabled: true,
  baseUrl: "/api/bmf", // 通过同源代理路由，避免浏览器解析容器主机名
  maxContextTokens: 2000,
  searchLimit: 8,
  includeSnippets: true,
  healthCheckTimeout: 5000,
  enhanceMinLength: 0, // 修改为0，让所有非空消息都可能触发RAG
};

export function getBMFConfig(): BMFSearchConfig {
  // 可以从环境变量或配置文件中读取
  return {
    enabled: process.env.NEXT_PUBLIC_BMF_ENABLED !== "false",
    baseUrl: process.env.NEXT_PUBLIC_BMF_BASE_URL || DEFAULT_BMF_CONFIG.baseUrl,
    maxContextTokens: parseInt(
      process.env.NEXT_PUBLIC_BMF_MAX_CONTEXT_TOKENS || "2000",
    ),
    searchLimit: parseInt(process.env.NEXT_PUBLIC_BMF_SEARCH_LIMIT || "8"),
    includeSnippets: process.env.NEXT_PUBLIC_BMF_INCLUDE_SNIPPETS !== "false",
    healthCheckTimeout: parseInt(
      process.env.NEXT_PUBLIC_BMF_HEALTH_CHECK_TIMEOUT || "5000",
    ),
    enhanceMinLength: parseInt(
      process.env.NEXT_PUBLIC_BMF_ENHANCE_MIN_LENGTH || "0",
    ),
  };
}
