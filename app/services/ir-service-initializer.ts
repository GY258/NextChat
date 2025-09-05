/**
 * IR服务初始化器 - 在Next.js应用启动时自动初始化IR索引服务
 */

import {
  startIRService,
  getIRServiceStatus,
  IRServiceConfig,
} from "./ir-service-manager";

let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * 初始化IR索引服务
 * 这个函数应该在应用启动时调用一次
 */
export async function initializeIRService(
  config?: Partial<IRServiceConfig>,
): Promise<void> {
  // 防止重复初始化
  if (isInitialized) {
    console.log("🔄 [IR Initializer] Service already initialized");
    return;
  }

  // 如果正在初始化，返回现有的Promise
  if (initializationPromise) {
    console.log("⏳ [IR Initializer] Initialization in progress, waiting...");
    return initializationPromise;
  }

  // 开始初始化
  initializationPromise = performInitialization(config);

  try {
    await initializationPromise;
    isInitialized = true;
    console.log("✅ [IR Initializer] Service initialized successfully");
  } catch (error) {
    console.error("❌ [IR Initializer] Initialization failed:", error);
    initializationPromise = null;
    throw error;
  }
}

/**
 * 执行实际的初始化逻辑
 */
async function performInitialization(
  config?: Partial<IRServiceConfig>,
): Promise<void> {
  console.log("🚀 [IR Initializer] Starting IR service initialization...");

  const defaultConfig: Partial<IRServiceConfig> = {
    serviceType: "memory",
    autoStart: true,
    enableLogging: true,
    memoryConfig: {
      maxDocuments: 1000,
      maxMemoryMB: 512,
      enableCompression: false,
    },
  };

  // 合并配置
  const finalConfig = { ...defaultConfig, ...config };

  try {
    // 启动服务
    await startIRService(finalConfig);

    // 记录启动信息
    const status = getIRServiceStatus();
    console.log("📊 [IR Initializer] Service status:", status);
  } catch (error) {
    console.error("❌ [IR Initializer] Failed to start IR service:", error);
    throw error;
  }
}

/**
 * 检查服务是否已初始化
 */
export function isIRServiceInitialized(): boolean {
  return isInitialized;
}

/**
 * 等待服务初始化完成
 */
export async function waitForIRServiceInitialization(): Promise<void> {
  if (isInitialized) {
    return;
  }

  if (initializationPromise) {
    await initializationPromise;
    return;
  }

  // 如果还没有开始初始化，自动启动
  await initializeIRService();
}

/**
 * 在客户端环境中自动初始化服务
 * 只在浏览器环境中执行
 */
if (typeof window !== "undefined") {
  // 延迟初始化，避免阻塞页面加载
  setTimeout(() => {
    initializeIRService().catch((error) => {
      console.error("❌ [IR Initializer] Auto-initialization failed:", error);
    });
  }, 1000);
}

/**
 * 导出给应用使用的初始化函数
 */
export default initializeIRService;
