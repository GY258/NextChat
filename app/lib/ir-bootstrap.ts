/**
 * IR服务引导程序 - 在Next.js应用启动时自动初始化IR索引服务
 * 这个文件应该在应用的早期阶段被导入和执行
 */

import { initializeIRService } from "../services/ir-service-initializer";
import {
  getIRServiceConfig,
  validateIRServiceConfig,
  printIRServiceConfig,
} from "../config/ir-service";

// 标记是否已经执行过引导
let isBootstrapped = false;

/**
 * IR服务引导函数
 * 在应用启动时调用，负责初始化IR索引服务
 */
export async function bootstrapIRService(): Promise<void> {
  // 防止重复引导
  if (isBootstrapped) {
    console.log("🔄 [IR Bootstrap] Already bootstrapped, skipping...");
    return;
  }

  console.log("🚀 [IR Bootstrap] Starting IR service bootstrap...");

  try {
    // 获取环境配置
    const config = getIRServiceConfig();

    // 验证配置
    if (!validateIRServiceConfig(config)) {
      throw new Error("Invalid IR service configuration");
    }

    // 打印配置信息（开发环境）
    if (process.env.NODE_ENV === "development") {
      printIRServiceConfig(config);
    }

    // 初始化服务
    await initializeIRService(config);

    // 标记已完成引导
    isBootstrapped = true;

    console.log(
      "✅ [IR Bootstrap] IR service bootstrap completed successfully",
    );

    // 在开发环境中提供一些有用的信息
    if (process.env.NODE_ENV === "development") {
      console.log(
        "🔧 [IR Bootstrap] Development mode: service is ready for use",
      );
      console.log(
        "📚 [IR Bootstrap] You can now upload documents and perform searches",
      );

      // 提供全局访问方式（仅开发环境）
      if (typeof window !== "undefined") {
        (window as any).__IR_SERVICE_DEBUG__ = {
          getStatus: () =>
            import("../services/ir-service-manager").then((m) =>
              m.getIRServiceStatus(),
            ),
          getMetrics: () =>
            import("../services/ir-service-manager").then((m) =>
              m.getIRServiceMetrics(),
            ),
          healthCheck: () =>
            import("../services/ir-service-manager").then((m) =>
              m.checkIRServiceHealth(),
            ),
        };
        console.log(
          "🛠️ [IR Bootstrap] Debug tools available at window.__IR_SERVICE_DEBUG__",
        );
      }
    }
  } catch (error) {
    console.error("❌ [IR Bootstrap] Bootstrap failed:", error);

    // 在生产环境中，服务启动失败不应该阻塞整个应用
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "⚠️ [IR Bootstrap] Continuing without IR service in production mode",
      );
    } else {
      // 在开发环境中重新抛出错误
      throw error;
    }
  }
}

/**
 * 检查是否已经引导完成
 */
export function isIRServiceBootstrapped(): boolean {
  return isBootstrapped;
}

/**
 * 等待引导完成
 */
export async function waitForIRBootstrap(): Promise<void> {
  if (isBootstrapped) {
    return;
  }

  // 如果还没有开始引导，自动启动
  await bootstrapIRService();
}

/**
 * 重置引导状态（主要用于测试）
 */
export function resetIRBootstrap(): void {
  isBootstrapped = false;
  console.log("🔄 [IR Bootstrap] Bootstrap state reset");
}

// ================ 自动引导逻辑 ================

// 在客户端环境自动执行引导
if (typeof window !== "undefined") {
  // 确保DOM加载完成后再执行
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      // 延迟执行，避免阻塞页面渲染
      setTimeout(bootstrapIRService, 500);
    });
  } else {
    // DOM已经加载完成，直接执行
    setTimeout(bootstrapIRService, 100);
  }
}

// 在服务端环境（Next.js SSR/SSG）中，不自动执行引导
// 需要在客户端组件中手动调用

// 导出默认的引导函数
export default bootstrapIRService;
