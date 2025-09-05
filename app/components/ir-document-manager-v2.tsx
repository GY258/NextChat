import React, { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";

import { IconButton } from "./button";
import { ErrorBoundary } from "./error";
import { showConfirm, showToast } from "./ui-lib";

import styles from "./document-manager.module.scss";

import CloseIcon from "../icons/close.svg";
import UploadIcon from "../icons/upload.svg";
import DeleteIcon from "../icons/delete.svg";
import SearchIcon from "../icons/search.svg";
import ReloadIcon from "../icons/reload.svg";
import DocumentIcon from "../icons/document.svg";
import SettingsIcon from "../icons/settings.svg";

import { useIRDocumentStoreV2 } from "../store/document-ir-v2";
import { DatabaseDocument } from "../services/ir-index-service";

export function IRDocumentManagerV2Page() {
  const navigate = useNavigate();
  const documentStore = useIRDocumentStoreV2();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState<DatabaseDocument[]>([]);
  const [stats, setStats] = useState<any>({});
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // 获取文档和统计信息
  useEffect(() => {
    loadDocuments();
    loadStats();
  }, [documentStore.lastUpdated]);

  const loadDocuments = async () => {
    try {
      const docs = await documentStore.getAllDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error("Failed to load documents:", error);
    }
  };

  const loadStats = async () => {
    try {
      const docStats = await documentStore.getDocumentStats();
      setStats(docStats);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  // 支持的文件类型
  const supportedTypes = [
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/json",
    "text/csv",
    "text/xml",
    "application/xml",
  ];

  const getFileIcon = (document: DatabaseDocument) => {
    const fileType = document.fileType;
    if (fileType === "application/pdf" || document.fileName.endsWith(".pdf"))
      return "pdf";
    if (fileType === "text/markdown" || document.fileName.endsWith(".md"))
      return "md";
    if (fileType === "application/json" || document.fileName.endsWith(".json"))
      return "json";
    if (fileType === "text/csv" || document.fileName.endsWith(".csv"))
      return "csv";
    if (
      fileType === "text/xml" ||
      fileType === "application/xml" ||
      document.fileName.endsWith(".xml")
    )
      return "xml";
    return "txt";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 文件上传处理
  const handleFileSelect = useCallback(
    async (files: FileList) => {
      setIsUploading(true);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (
          !supportedTypes.includes(file.type) &&
          !supportedTypes.some((type) =>
            file.name.toLowerCase().endsWith(type.split("/")[1]),
          )
        ) {
          showToast(
            `不支持的文件类型: ${file.name}. 支持的格式: PDF, TXT, MD, JSON, CSV, XML`,
            undefined,
            3000,
          );
          continue;
        }

        try {
          console.log("📤 [IR Upload V2] Starting upload for:", file.name);
          await documentStore.uploadDocument(file);
          showToast(`✅ 文档 "${file.name}" 上传成功！`, undefined, 2000);

          // 重新加载文档列表和统计
          await Promise.all([loadDocuments(), loadStats()]);
        } catch (error) {
          console.error("Upload error:", error);
          showToast(
            `❌ 文档 "${file.name}" 上传失败: ${
              error instanceof Error ? error.message : "未知错误"
            }`,
            undefined,
            5000,
          );
        }
      }

      setIsUploading(false);
    },
    [documentStore],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileSelect(files);
      }
      e.target.value = "";
    },
    [handleFileSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleFileSelect(files);
      }
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  // 文档操作
  const handleDeleteDocument = useCallback(
    async (document: DatabaseDocument) => {
      const confirmed = await showConfirm(
        `确认删除文档 "${document.fileName}"？此操作不可恢复。`,
      );
      if (confirmed) {
        try {
          await documentStore.deleteDocument(document.id);
          showToast(`✅ 文档 "${document.fileName}" 已删除`, undefined, 2000);

          // 重新加载文档列表和统计
          await Promise.all([loadDocuments(), loadStats()]);
        } catch (error) {
          showToast(
            `❌ 删除失败: ${
              error instanceof Error ? error.message : "未知错误"
            }`,
            undefined,
            3000,
          );
        }
      }
    },
    [documentStore],
  );

  const handleSearchTest = useCallback(async () => {
    if (!searchQuery.trim()) {
      showToast("请输入搜索查询", undefined, 2000);
      return;
    }

    try {
      console.log("🔍 [IR Search Test V2] Testing search for:", searchQuery);

      const results = await documentStore.searchDocuments(searchQuery, 5);

      if (results.length > 0) {
        console.log("📊 [IR Search Test V2] Results:", results);
        showToast(
          `🎯 找到 ${results.length} 个相关结果，查看控制台了解详情`,
          undefined,
          3000,
        );

        // 显示前3个结果的预览
        results.slice(0, 3).forEach((result, index) => {
          console.log(
            `📄 [Result ${index + 1}] Score: ${result.score.toFixed(
              4,
            )}, Document: ${result.document.fileName}`,
          );
          console.log(
            `📄 [Content Preview] ${result.chunk.content.substring(0, 200)}...`,
          );
        });
      } else {
        showToast("❌ 未找到相关结果", undefined, 2000);
      }
    } catch (error) {
      console.error("Search test error:", error);
      showToast(
        `❌ 搜索测试失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`,
        undefined,
        3000,
      );
    }
  }, [searchQuery, documentStore]);

  // 获取搜索建议
  const handleSearchInputChange = useCallback(
    async (value: string) => {
      setSearchQuery(value);

      if (value.length > 2) {
        try {
          const suggestions = await documentStore.getSearchSuggestions(value);
          setSearchSuggestions(suggestions);
        } catch (error) {
          console.error("Failed to get search suggestions:", error);
        }
      } else {
        setSearchSuggestions([]);
      }
    },
    [documentStore],
  );

  const handleClearAllDocuments = useCallback(async () => {
    const confirmed = await showConfirm("确认清除所有文档？此操作不可恢复。");
    if (confirmed) {
      try {
        await documentStore.clearAllDocuments();
        showToast("✅ 所有文档已清除", undefined, 2000);
        await Promise.all([loadDocuments(), loadStats()]);
      } catch (error) {
        showToast(
          `❌ 清除失败: ${error instanceof Error ? error.message : "未知错误"}`,
          undefined,
          3000,
        );
      }
    }
  }, [documentStore]);

  const handleReindexDocuments = useCallback(async () => {
    try {
      await documentStore.reindexDocuments();
      showToast("✅ 文档重新索引完成", undefined, 2000);
      await loadStats();
    } catch (error) {
      showToast(
        `❌ 重新索引失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`,
        undefined,
        3000,
      );
    }
  }, [documentStore]);

  // 搜索设置处理
  const handleToggleHierarchicalSearch = useCallback(() => {
    documentStore.updateSearchSettings({
      useHierarchicalSearch:
        !documentStore.searchSettings.useHierarchicalSearch,
    });
  }, [documentStore]);

  const handleTogglePRF = useCallback(() => {
    documentStore.updateSearchSettings({
      usePRF: !documentStore.searchSettings.usePRF,
    });
  }, [documentStore]);

  const handleToggleExplainScores = useCallback(() => {
    documentStore.updateSearchSettings({
      explainScores: !documentStore.searchSettings.explainScores,
    });
  }, [documentStore]);

  // 分析查询
  const handleAnalyzeQuery = useCallback(async () => {
    if (!searchQuery.trim()) {
      showToast("请输入查询内容", undefined, 2000);
      return;
    }

    try {
      const analysis = await documentStore.analyzeQuery(searchQuery);
      console.log("🔍 [Query Analysis V2]", analysis);
      showToast("查询分析完成，查看控制台了解详情", undefined, 2000);
    } catch (error) {
      showToast(
        `❌ 查询分析失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`,
        undefined,
        3000,
      );
    }
  }, [searchQuery, documentStore]);

  return (
    <ErrorBoundary>
      <div className="window-header">
        <div className="window-header-title">
          <div className="window-header-main-title">IR 业务文档管理 V2</div>
          <div className="window-header-sub-title">
            基于持久化索引服务的高级信息检索系统
          </div>
        </div>
        <div className="window-actions">
          <div className="window-action-button">
            <IconButton
              icon={<CloseIcon />}
              onClick={() => navigate(-1)}
              bordered
              title="关闭"
            />
          </div>
        </div>
      </div>

      <div className={styles.container}>
        {/* 状态栏 */}
        <div className={styles.statusBar}>
          <div className={styles.stats}>
            <span>📚 {stats.totalDocuments || 0} 个文档</span>
            <span>📄 {stats.totalChunks || 0} 个文本块</span>
            <span>💾 {formatFileSize(stats.totalSize || 0)}</span>
            <span>🔍 {stats.searchMethod || "ir-bm25-v2"}</span>
            <span>🧠 {stats.uniqueTerms || 0} 个词汇</span>
            {(documentStore.isProcessing || isUploading) && (
              <span className={styles.indexing}>🔄 处理中...</span>
            )}
          </div>

          <div className={styles.actions}>
            <IconButton
              icon={<ReloadIcon />}
              onClick={handleReindexDocuments}
              title="重新索引"
              disabled={documentStore.isProcessing || isUploading}
            />
            <IconButton
              icon={<DeleteIcon />}
              onClick={handleClearAllDocuments}
              title="清除所有文档"
              disabled={
                documentStore.isProcessing ||
                isUploading ||
                documents.length === 0
              }
            />
            <IconButton
              icon={<SettingsIcon />}
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              title="高级设置"
              text={showAdvancedSettings ? "🔽" : "🔼"}
            />
          </div>
        </div>

        {/* 高级设置面板 */}
        {showAdvancedSettings && (
          <div className={styles.searchSettings}>
            <h3>🔧 高级搜索设置</h3>
            <div className={styles.settingsGrid}>
              <label className={styles.settingItem}>
                <input
                  type="checkbox"
                  checked={documentStore.searchSettings.useHierarchicalSearch}
                  onChange={handleToggleHierarchicalSearch}
                />
                <span>层次搜索 (文档→块)</span>
              </label>

              <label className={styles.settingItem}>
                <input
                  type="checkbox"
                  checked={documentStore.searchSettings.usePRF}
                  onChange={handleTogglePRF}
                />
                <span>伪相关反馈 (PRF)</span>
              </label>

              <label className={styles.settingItem}>
                <input
                  type="checkbox"
                  checked={documentStore.searchSettings.explainScores}
                  onChange={handleToggleExplainScores}
                />
                <span>评分解释</span>
              </label>
            </div>
          </div>
        )}

        {/* 搜索测试区域 */}
        <div className={styles.searchTest}>
          <div className={styles.searchInputContainer}>
            <input
              type="text"
              placeholder="输入查询测试IR搜索 V2..."
              value={searchQuery}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchTest()}
              className={styles.searchInput}
            />
            {searchSuggestions.length > 0 && (
              <div className={styles.searchSuggestions}>
                {searchSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className={styles.suggestion}
                    onClick={() => setSearchQuery(suggestion)}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={styles.searchButtons}>
            <IconButton
              icon={<SearchIcon />}
              onClick={handleSearchTest}
              title="测试搜索"
              disabled={!searchQuery.trim()}
            />
            <IconButton
              icon={<SettingsIcon />}
              onClick={handleAnalyzeQuery}
              title="分析查询"
              disabled={!searchQuery.trim()}
              text="📊"
            />
          </div>
        </div>

        {/* 上传区域 */}
        <div
          className={clsx(styles.uploadArea, {
            [styles.dragOver]: isDragOver,
            [styles.uploading]: isUploading,
          })}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.md,.json,.csv,.xml"
            onChange={handleFileInput}
            style={{ display: "none" }}
          />

          <div className={styles.uploadContent}>
            <UploadIcon className={styles.uploadIcon} />
            <div className={styles.uploadText}>
              <div className={styles.uploadTitle}>
                {isUploading ? "正在上传和索引..." : "拖拽文件到此处或点击上传"}
              </div>
              <div className={styles.uploadHint}>
                支持格式: PDF, TXT, MD, JSON, CSV, XML
              </div>
              <div className={styles.uploadHint}>
                V2特性: 持久化索引, 增强BM25评分, 优化搜索性能
              </div>
            </div>
          </div>
        </div>

        {/* 文档列表 */}
        <div className={styles.documentList}>
          {documents.length === 0 ? (
            <div className={styles.emptyState}>
              <DocumentIcon className={styles.emptyIcon} />
              <div className={styles.emptyText}>暂无文档</div>
              <div className={styles.emptyHint}>
                上传您的业务文档开始使用IR系统V2
              </div>
            </div>
          ) : (
            documents.map((document) => (
              <div key={document.id} className={styles.documentItem}>
                <div className={styles.documentIcon}>
                  <span
                    className={`${styles.fileIcon} ${
                      styles[getFileIcon(document)]
                    }`}
                  >
                    {getFileIcon(document).toUpperCase()}
                  </span>
                </div>

                <div className={styles.documentInfo}>
                  <div className={styles.documentName}>{document.fileName}</div>
                  <div className={styles.documentMeta}>
                    <span>{formatFileSize(document.fileSize)}</span>
                    <span>•</span>
                    <span>{formatDate(document.uploadedAt)}</span>
                    <span>•</span>
                    <span>{document.chunkCount} 块</span>
                    <span>•</span>
                    <span>{document.totalTokens} tokens</span>
                    {document.termStats && (
                      <>
                        <span>•</span>
                        <span>{document.termStats.uniqueTerms} 唯一词汇</span>
                      </>
                    )}
                  </div>

                  <div className={styles.documentStatus}>
                    {document.status === "completed" && (
                      <span className={styles.statusCompleted}>✅ 已索引</span>
                    )}
                    {document.status === "processing" && (
                      <span className={styles.statusProcessing}>🔄 处理中</span>
                    )}
                    {document.status === "error" && (
                      <span className={styles.statusError}>
                        ❌ 错误: {document.error}
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.documentActions}>
                  <IconButton
                    icon={<DeleteIcon />}
                    onClick={() => handleDeleteDocument(document)}
                    title="删除文档"
                    className={styles.deleteButton}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* 索引统计 */}
        {stats.totalDocuments > 0 && (
          <div className={styles.indexStats}>
            <h3>📊 索引统计 (V2)</h3>
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>平均文档长度:</span>
                <span className={styles.statValue}>
                  {Math.round(stats.avgDocumentLength || 0)} tokens
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>平均块长度:</span>
                <span className={styles.statValue}>
                  {Math.round(stats.avgChunkLength || 0)} tokens
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>总词汇数:</span>
                <span className={styles.statValue}>
                  {stats.totalTerms || 0}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>唯一词汇数:</span>
                <span className={styles.statValue}>
                  {stats.uniqueTerms || 0}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
