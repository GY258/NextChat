import React, { useState, useRef, useCallback } from "react";
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

import { useIRDocumentStore } from "../store/document-ir";
import { IRBusinessDocument } from "../utils/document-processor-ir";

export function IRDocumentManagerPage() {
  const navigate = useNavigate();
  const documentStore = useIRDocumentStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Get documents and stats
  const documents = documentStore.getAllDocuments();
  const stats = documentStore.getDocumentStats();
  const isIndexing = documentStore.isIndexing;
  const searchSettings = documentStore.searchSettings;

  // Supported file types for IR system
  const supportedTypes = [
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/json",
    "text/csv",
    "text/xml",
    "application/xml",
  ];

  const getFileIcon = (document: IRBusinessDocument) => {
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

  // File upload handlers
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
          console.log("📤 [IR Upload] Starting upload for:", file.name);
          await documentStore.uploadDocument(file);
          showToast(`✅ 文档 "${file.name}" 上传成功！`, undefined, 2000);
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
    [documentStore, supportedTypes],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileSelect(files);
      }
      // Reset input value to allow same file upload
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

  // Document operations
  const handleDeleteDocument = useCallback(
    async (document: IRBusinessDocument) => {
      const confirmed = await showConfirm(
        `确认删除文档 "${document.fileName}"？此操作不可恢复。`,
      );
      if (confirmed) {
        try {
          documentStore.deleteDocument(document.id);
          showToast(`✅ 文档 "${document.fileName}" 已删除`, undefined, 2000);
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
      console.log("🔍 [IR Search Test] Testing search for:", searchQuery);

      // 添加详细的调试信息
      console.log("📊 [IR Search Debug] Store state check:");
      console.log(
        "  - Documents count:",
        Object.keys(documentStore.documents).length,
      );
      console.log(
        "  - Search index size:",
        Object.keys(documentStore.searchIndex).length,
      );
      console.log("  - Is indexing:", documentStore.isIndexing);
      console.log(
        "  - Last updated:",
        new Date(documentStore.lastUpdated).toLocaleString(),
      );
      console.log("  - Index stats:", documentStore.indexStats);

      // 检查具体的文档内容
      const docs = Object.values(documentStore.documents);
      if (docs.length > 0) {
        console.log("📚 [IR Search Debug] Available documents:");
        docs.forEach((doc, i) => {
          console.log(
            `  ${i + 1}. ${doc.fileName} (${doc.chunks.length} chunks, ${
              doc.totalTokens
            } tokens)`,
          );
        });
      } else {
        console.log("❌ [IR Search Debug] No documents found in store!");
        showToast("❌ 没有文档可供搜索，请先上传文档", undefined, 2000);
        return;
      }

      const results = await documentStore.searchDocuments(searchQuery, 5);

      if (results.length > 0) {
        console.log("📊 [IR Search Test] Results:", results);
        showToast(
          `🎯 找到 ${results.length} 个相关结果，查看控制台了解详情`,
          undefined,
          3000,
        );
      } else {
        console.log(
          "❌ [IR Search Debug] No results found for query:",
          searchQuery,
        );
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

  const handleClearAllDocuments = useCallback(async () => {
    const confirmed = await showConfirm("确认清除所有文档？此操作不可恢复。");
    if (confirmed) {
      try {
        documentStore.clearAllDocuments();
        showToast("✅ 所有文档已清除", undefined, 2000);
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

  // Search settings handlers
  const handleToggleHierarchicalSearch = useCallback(() => {
    documentStore.updateSearchSettings({
      useHierarchicalSearch: !searchSettings.useHierarchicalSearch,
    });
  }, [documentStore, searchSettings]);

  const handleTogglePRF = useCallback(() => {
    documentStore.updateSearchSettings({
      usePRF: !searchSettings.usePRF,
    });
  }, [documentStore, searchSettings]);

  const handleToggleExplainScores = useCallback(() => {
    documentStore.updateSearchSettings({
      explainScores: !searchSettings.explainScores,
    });
  }, [documentStore, searchSettings]);

  // 新增：调试存储状态的函数
  const handleDebugStorage = useCallback(() => {
    console.log("🔧 [Storage Debug] Checking local storage...");

    // 检查IR文档存储
    const irStoreKey = "app-ir-document";
    const irStoreData = localStorage.getItem(irStoreKey);
    if (irStoreData) {
      try {
        const parsed = JSON.parse(irStoreData);
        console.log("📦 [Storage Debug] IR Store found:", {
          key: irStoreKey,
          documentsCount: Object.keys(parsed.state?.documents || {}).length,
          searchIndexSize: Object.keys(parsed.state?.searchIndex || {}).length,
          lastUpdated: parsed.state?.lastUpdated
            ? new Date(parsed.state.lastUpdated).toLocaleString()
            : "Never",
          version: parsed.version,
        });
        console.log("📊 [Storage Debug] Full IR Store data:", parsed);
      } catch (e) {
        console.error("❌ [Storage Debug] Failed to parse IR store data:", e);
      }
    } else {
      console.log("❌ [Storage Debug] No IR store data found");
    }

    // 检查原始文档存储
    const docStoreKey = "document-store";
    const docStoreData = localStorage.getItem(docStoreKey);
    if (docStoreData) {
      try {
        const parsed = JSON.parse(docStoreData);
        console.log("📦 [Storage Debug] Original Doc Store found:", {
          key: docStoreKey,
          documentsCount: Object.keys(parsed.state?.documents || {}).length,
          searchIndexSize: Object.keys(parsed.state?.searchIndex || {}).length,
        });
      } catch (e) {
        console.error("❌ [Storage Debug] Failed to parse doc store data:", e);
      }
    } else {
      console.log("ℹ️ [Storage Debug] No original doc store data found");
    }

    // 检查所有localStorage键
    const allKeys = Object.keys(localStorage).filter(
      (key) =>
        key.includes("document") ||
        key.includes("chat") ||
        key.includes("store"),
    );
    console.log("🗂️ [Storage Debug] All relevant storage keys:", allKeys);

    showToast("📋 存储状态已输出到控制台", undefined, 2000);
  }, []);

  return (
    <ErrorBoundary>
      <div className="window-header">
        <div className="window-header-title">
          <div className="window-header-main-title">IR 业务文档管理</div>
          <div className="window-header-sub-title">
            基于BM25和层次搜索的高级信息检索系统
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
        {/* Status Bar */}
        <div className={styles.statusBar}>
          <div className={styles.stats}>
            <span>📚 {stats.totalDocuments} 个文档</span>
            <span>📄 {stats.totalChunks} 个文本块</span>
            <span>💾 {formatFileSize(stats.totalSize)}</span>
            <span>🔍 {stats.searchMethod}</span>
            {isIndexing && (
              <span className={styles.indexing}>🔄 索引中...</span>
            )}
          </div>

          <div className={styles.actions}>
            <IconButton
              icon={<ReloadIcon />}
              onClick={handleReindexDocuments}
              title="重新索引"
              disabled={isIndexing}
            />
            <IconButton
              icon={<DeleteIcon />}
              onClick={handleClearAllDocuments}
              title="清除所有文档"
              disabled={isIndexing || documents.length === 0}
            />
            <IconButton
              icon={<SettingsIcon />}
              onClick={handleDebugStorage}
              title="调试存储状态"
              text="🔧"
            />
          </div>
        </div>

        {/* Search Settings Panel */}
        <div className={styles.searchSettings}>
          <h3>🔧 搜索设置</h3>
          <div className={styles.settingsGrid}>
            <label className={styles.settingItem}>
              <input
                type="checkbox"
                checked={searchSettings.useHierarchicalSearch}
                onChange={handleToggleHierarchicalSearch}
              />
              <span>层次搜索 (文档→块)</span>
            </label>

            <label className={styles.settingItem}>
              <input
                type="checkbox"
                checked={searchSettings.usePRF}
                onChange={handleTogglePRF}
              />
              <span>伪相关反馈 (PRF)</span>
            </label>

            <label className={styles.settingItem}>
              <input
                type="checkbox"
                checked={searchSettings.explainScores}
                onChange={handleToggleExplainScores}
              />
              <span>评分解释</span>
            </label>
          </div>

          <div className={styles.searchTest}>
            <input
              type="text"
              placeholder="输入查询测试IR搜索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchTest()}
              className={styles.searchInput}
            />
            <IconButton
              icon={<SearchIcon />}
              onClick={handleSearchTest}
              title="测试搜索"
              disabled={!searchQuery.trim()}
            />
          </div>
        </div>

        {/* Upload Area */}
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
                {isUploading ? "正在上传..." : "拖拽文件到此处或点击上传"}
              </div>
              <div className={styles.uploadHint}>
                支持格式: PDF, TXT, MD, JSON, CSV, XML
              </div>
              <div className={styles.uploadHint}>
                IR系统特性: 400-800 tokens分块, BM25评分, 层次搜索
              </div>
            </div>
          </div>
        </div>

        {/* Document List */}
        <div className={styles.documentList}>
          {documents.length === 0 ? (
            <div className={styles.emptyState}>
              <DocumentIcon className={styles.emptyIcon} />
              <div className={styles.emptyText}>暂无文档</div>
              <div className={styles.emptyHint}>
                上传您的业务文档开始使用IR系统
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
                    <span>{formatFileSize(document.size)}</span>
                    <span>•</span>
                    <span>{formatDate(document.uploadedAt)}</span>
                    <span>•</span>
                    <span>{document.chunks.length} 块</span>
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

        {/* Index Statistics */}
        {stats.indexStats && (
          <div className={styles.indexStats}>
            <h3>📊 索引统计</h3>
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>平均文档长度:</span>
                <span className={styles.statValue}>
                  {Math.round(stats.indexStats.avgDocumentLength)} tokens
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>平均块长度:</span>
                <span className={styles.statValue}>
                  {Math.round(stats.indexStats.avgChunkLength)} tokens
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>总词汇数:</span>
                <span className={styles.statValue}>
                  {stats.indexStats.totalTerms}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
