/**
 * IR服务React Hook - 在React组件中使用IR索引服务
 */

import { useState, useEffect, useCallback } from "react";
import {
  initializeIRService,
  isIRServiceInitialized,
  waitForIRServiceInitialization,
} from "../services/ir-service-initializer";
import {
  getIRServiceStatus,
  getIRServiceMetrics,
  checkIRServiceHealth,
  IRServiceConfig,
} from "../services/ir-service-manager";
import { getIRIndexService } from "../services/ir-index-service";

export interface IRServiceState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  metrics: any;
  status: any;
}

/**
 * 使用IR索引服务的Hook
 */
export function useIRService(autoInit = true) {
  const [state, setState] = useState<IRServiceState>({
    isInitialized: false,
    isLoading: false,
    error: null,
    metrics: null,
    status: null,
  });

  // 初始化服务
  const initializeService = useCallback(
    async (config?: Partial<IRServiceConfig>) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        await initializeIRService(config);
        const status = getIRServiceStatus();
        const metrics = await getIRServiceMetrics();

        setState({
          isInitialized: true,
          isLoading: false,
          error: null,
          status,
          metrics,
        });

        console.log("✅ [useIRService] Service initialized via hook");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
        console.error("❌ [useIRService] Initialization failed:", error);
      }
    },
    [],
  );

  // 刷新状态
  const refreshStatus = useCallback(async () => {
    try {
      const status = getIRServiceStatus();
      const metrics = await getIRServiceMetrics();

      setState((prev) => ({
        ...prev,
        status,
        metrics,
        isInitialized: status.isStarted,
      }));
    } catch (error) {
      console.error("❌ [useIRService] Failed to refresh status:", error);
    }
  }, []);

  // 健康检查
  const performHealthCheck = useCallback(async () => {
    try {
      const isHealthy = await checkIRServiceHealth();
      console.log("🏥 [useIRService] Health check result:", isHealthy);
      return isHealthy;
    } catch (error) {
      console.error("❌ [useIRService] Health check failed:", error);
      return false;
    }
  }, []);

  // 获取服务实例
  const getService = useCallback(() => {
    if (!state.isInitialized) {
      throw new Error("IR service is not initialized");
    }
    return getIRIndexService();
  }, [state.isInitialized]);

  // 组件挂载时的初始化
  useEffect(() => {
    if (autoInit && !isIRServiceInitialized()) {
      initializeService();
    } else if (isIRServiceInitialized()) {
      refreshStatus();
    }
  }, [autoInit, initializeService, refreshStatus]);

  // 定期刷新状态（每30秒）
  useEffect(() => {
    if (!state.isInitialized) return;

    const interval = setInterval(refreshStatus, 30000);
    return () => clearInterval(interval);
  }, [state.isInitialized, refreshStatus]);

  return {
    // 状态
    ...state,

    // 方法
    initialize: initializeService,
    refresh: refreshStatus,
    healthCheck: performHealthCheck,
    getService,

    // 辅助方法
    waitForInitialization: waitForIRServiceInitialization,
  };
}

/**
 * 仅用于获取服务状态的轻量级Hook
 */
export function useIRServiceStatus() {
  const [status, setStatus] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const updateStatus = useCallback(() => {
    try {
      const currentStatus = getIRServiceStatus();
      setStatus(currentStatus);
      setLastUpdate(Date.now());
    } catch (error) {
      console.error("❌ [useIRServiceStatus] Failed to get status:", error);
    }
  }, []);

  useEffect(() => {
    updateStatus();
    const interval = setInterval(updateStatus, 10000); // 每10秒更新
    return () => clearInterval(interval);
  }, [updateStatus]);

  return {
    status,
    lastUpdate,
    refresh: updateStatus,
  };
}

/**
 * 用于等待服务初始化的Hook
 */
export function useIRServiceInitialization() {
  const [isReady, setIsReady] = useState(isIRServiceInitialized());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isReady) return;

    waitForIRServiceInitialization()
      .then(() => {
        setIsReady(true);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unknown error");
      });
  }, [isReady]);

  return { isReady, error };
}
