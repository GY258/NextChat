/**
 * IR服务控制面板 - 用于监控和管理IR索引服务
 */

import React, { useState } from "react";
import { useIRService } from "../hooks/use-ir-service";
import {
  startIRService,
  stopIRService,
  restartIRService,
} from "../services/ir-service-manager";
import { getIRServiceConfig } from "../config/ir-service";

export function IRServiceDashboard() {
  const {
    isInitialized,
    isLoading,
    error,
    metrics,
    status,
    initialize,
    refresh,
    healthCheck,
  } = useIRService(true);

  const [isPerformingAction, setIsPerformingAction] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);

  // 启动服务
  const handleStart = async () => {
    setIsPerformingAction(true);
    setActionResult(null);

    try {
      const config = getIRServiceConfig();
      await startIRService(config);
      setActionResult("✅ 服务启动成功");
      await refresh();
    } catch (error) {
      setActionResult(
        `❌ 启动失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    } finally {
      setIsPerformingAction(false);
    }
  };

  // 停止服务
  const handleStop = async () => {
    setIsPerformingAction(true);
    setActionResult(null);

    try {
      await stopIRService();
      setActionResult("✅ 服务停止成功");
      await refresh();
    } catch (error) {
      setActionResult(
        `❌ 停止失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    } finally {
      setIsPerformingAction(false);
    }
  };

  // 重启服务
  const handleRestart = async () => {
    setIsPerformingAction(true);
    setActionResult(null);

    try {
      const config = getIRServiceConfig();
      await restartIRService(config);
      setActionResult("✅ 服务重启成功");
      await refresh();
    } catch (error) {
      setActionResult(
        `❌ 重启失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    } finally {
      setIsPerformingAction(false);
    }
  };

  // 健康检查
  const handleHealthCheck = async () => {
    setIsPerformingAction(true);
    setActionResult(null);

    try {
      const isHealthy = await healthCheck();
      setActionResult(isHealthy ? "✅ 健康检查通过" : "⚠️ 健康检查失败");
    } catch (error) {
      setActionResult(
        `❌ 健康检查错误: ${
          error instanceof Error ? error.message : "未知错误"
        }`,
      );
    } finally {
      setIsPerformingAction(false);
    }
  };

  // 格式化时间
  const formatUptime = (uptime: number) => {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}小时 ${minutes % 60}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟 ${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  };

  return (
    <div
      style={{
        padding: "20px",
        maxWidth: "800px",
        margin: "0 auto",
        fontFamily: "monospace",
      }}
    >
      <h2>🔧 IR服务控制面板</h2>

      {/* 服务状态 */}
      <div
        style={{
          marginBottom: "20px",
          padding: "15px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          backgroundColor: isInitialized ? "#e8f5e8" : "#ffe8e8",
        }}
      >
        <h3>📊 服务状态</h3>
        <div>
          <strong>状态:</strong>{" "}
          {isLoading
            ? "🔄 加载中..."
            : error
            ? `❌ 错误: ${error}`
            : isInitialized
            ? "✅ 运行中"
            : "⭕ 未启动"}
        </div>

        {status && (
          <div style={{ marginTop: "10px" }}>
            <div>
              <strong>启动时间:</strong>{" "}
              {new Date(status.startTime).toLocaleString()}
            </div>
            <div>
              <strong>运行时长:</strong> {formatUptime(status.uptime)}
            </div>
            <div>
              <strong>配置类型:</strong> {status.config?.serviceType}
            </div>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div style={{ marginBottom: "20px" }}>
        <h3>🎮 服务控制</h3>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={handleStart}
            disabled={isPerformingAction || isInitialized}
            style={{ padding: "8px 16px", cursor: "pointer" }}
          >
            🚀 启动服务
          </button>

          <button
            onClick={handleStop}
            disabled={isPerformingAction || !isInitialized}
            style={{ padding: "8px 16px", cursor: "pointer" }}
          >
            🛑 停止服务
          </button>

          <button
            onClick={handleRestart}
            disabled={isPerformingAction}
            style={{ padding: "8px 16px", cursor: "pointer" }}
          >
            🔄 重启服务
          </button>

          <button
            onClick={handleHealthCheck}
            disabled={isPerformingAction || !isInitialized}
            style={{ padding: "8px 16px", cursor: "pointer" }}
          >
            🏥 健康检查
          </button>

          <button
            onClick={refresh}
            disabled={isPerformingAction}
            style={{ padding: "8px 16px", cursor: "pointer" }}
          >
            🔄 刷新状态
          </button>
        </div>

        {actionResult && (
          <div
            style={{
              marginTop: "10px",
              padding: "10px",
              backgroundColor: actionResult.includes("❌")
                ? "#ffe8e8"
                : "#e8f5e8",
              borderRadius: "4px",
            }}
          >
            {actionResult}
          </div>
        )}
      </div>

      {/* 服务指标 */}
      {metrics && (
        <div style={{ marginBottom: "20px" }}>
          <h3>📈 服务指标</h3>
          <div
            style={{
              padding: "15px",
              border: "1px solid #ddd",
              borderRadius: "8px",
              backgroundColor: "#f8f9fa",
            }}
          >
            {metrics.indexStats && (
              <div>
                <h4>索引统计:</h4>
                <div>📚 文档数量: {metrics.indexStats.totalDocuments}</div>
                <div>📄 文本块数量: {metrics.indexStats.totalChunks}</div>
                <div>🔤 词汇总数: {metrics.indexStats.totalTerms}</div>
                <div>🎯 唯一词汇: {metrics.indexStats.uniqueTerms}</div>
                <div>
                  📏 平均文档长度:{" "}
                  {Math.round(metrics.indexStats.avgDocumentLength)} tokens
                </div>
                <div>
                  📐 平均块长度: {Math.round(metrics.indexStats.avgChunkLength)}{" "}
                  tokens
                </div>
              </div>
            )}

            {metrics.memoryStats && (
              <div style={{ marginTop: "15px" }}>
                <h4>内存统计:</h4>
                <div>📚 内存中文档: {metrics.memoryStats.documents}</div>
                <div>📄 内存中文本块: {metrics.memoryStats.chunks}</div>
                <div>🔤 内存中词汇: {metrics.memoryStats.terms}</div>
                <div>📊 倒排索引项: {metrics.memoryStats.postings}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 配置信息 */}
      <div>
        <h3>⚙️ 当前配置</h3>
        <div
          style={{
            padding: "15px",
            border: "1px solid #ddd",
            borderRadius: "8px",
            backgroundColor: "#f8f9fa",
          }}
        >
          <pre style={{ margin: 0, fontSize: "12px" }}>
            {JSON.stringify(getIRServiceConfig(), null, 2)}
          </pre>
        </div>
      </div>

      {/* 使用说明 */}
      <div style={{ marginTop: "20px", fontSize: "14px", color: "#666" }}>
        <h4>💡 使用说明:</h4>
        <ul>
          <li>服务会在页面加载时自动启动</li>
          <li>可以通过按钮手动控制服务的启动和停止</li>
          <li>健康检查会验证服务的基本功能</li>
          <li>指标信息会定期自动更新</li>
          <li>
            在开发环境中，可以通过浏览器控制台的{" "}
            <code>window.__IR_SERVICE_DEBUG__</code> 进行调试
          </li>
        </ul>
      </div>
    </div>
  );
}

export default IRServiceDashboard;
