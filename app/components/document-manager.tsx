import React, { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";

import { IconButton } from "./button";
import { ErrorBoundary } from "./error";
import { showConfirm, showToast } from "./ui-lib";

import styles from "./document-manager.module.scss";

import CloseIcon from "../icons/close.svg";
import SearchIcon from "../icons/search.svg";
import ReloadIcon from "../icons/reload.svg";

import { useDocumentStore } from "../store/document";

export function DocumentManagerPage() {
  const navigate = useNavigate();
  const documentStore = useDocumentStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const documents = documentStore.getAllDocuments();
  const stats = documentStore.getDocumentStats();

  const filteredDocuments = documents.filter((doc) =>
    doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleFileUpload = useCallback(
    async (files: FileList) => {
      setIsProcessing(true);

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          // Check file size (max 10MB)
          if (file.size > 10 * 1024 * 1024) {
            showToast(`File ${file.name} is too large. Maximum size is 10MB.`);
            continue;
          }

          // Check file type
          const supportedTypes = [
            "text/plain",
            "application/json",
            "text/markdown",
            "text/csv",
            "text/xml",
            "application/xml",
            "application/pdf",
          ];

          const isSupported =
            supportedTypes.includes(file.type) ||
            file.name.endsWith(".md") ||
            file.name.endsWith(".txt") ||
            file.name.endsWith(".json") ||
            file.name.endsWith(".csv") ||
            file.name.endsWith(".xml") ||
            file.name.endsWith(".pdf");

          if (!isSupported) {
            showToast(
              `File ${file.name} is not supported. Please upload PDF, TXT, MD, JSON, CSV, or XML files.`,
            );
            continue;
          }

          await documentStore.uploadDocument(file);
          showToast(`Successfully uploaded ${file.name}`);
        }
      } catch (error) {
        console.error("Upload failed:", error);
        showToast("Failed to upload file. Please try again.");
      } finally {
        setIsProcessing(false);
      }
    },
    [documentStore],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileUpload(files);
      }
    },
    [handleFileUpload],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileUpload(files);
      }
      // Reset input value to allow uploading the same file again
      e.target.value = "";
    },
    [handleFileUpload],
  );

  const handleDeleteDocument = useCallback(
    async (documentId: string, fileName: string) => {
      if (await showConfirm(`Are you sure you want to delete "${fileName}"?`)) {
        documentStore.deleteDocument(documentId);
        showToast(`Deleted ${fileName}`);
      }
    },
    [documentStore],
  );

  const handleReindex = useCallback(async () => {
    try {
      setIsProcessing(true);
      await documentStore.reindexDocuments();
      showToast("Successfully reindexed all documents");
    } catch (error) {
      console.error("Reindexing failed:", error);
      showToast("Failed to reindex documents");
    } finally {
      setIsProcessing(false);
    }
  }, [documentStore]);

  const getFileIcon = (fileType: string, fileName: string) => {
    if (fileName.endsWith(".pdf") || fileType === "application/pdf")
      return "pdf";
    if (fileName.endsWith(".md")) return "md";
    if (fileName.endsWith(".json")) return "json";
    if (fileName.endsWith(".csv")) return "csv";
    if (fileName.endsWith(".xml")) return "xml";
    if (fileType.includes("text")) return "txt";
    return "default";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <ErrorBoundary>
      <div className={styles["document-manager"]}>
        <div className={styles["document-page"]}>
          <div className="window-header">
            <div className="window-header-title">
              <div className="window-header-main-title">Business Documents</div>
              <div className="window-header-submai-title">
                Manage your business documentation for AI assistance
              </div>
            </div>

            <div className="window-actions">
              <div className="window-action-button">
                <IconButton
                  icon={<ReloadIcon />}
                  bordered
                  onClick={handleReindex}
                  title="Reindex all documents"
                />
              </div>
              <div className="window-action-button">
                <IconButton
                  icon={<CloseIcon />}
                  bordered
                  onClick={() => navigate(-1)}
                />
              </div>
            </div>
          </div>

          <div className={styles["document-page-body"]}>
            {/* Upload Area */}
            <div
              className={clsx(styles["document-upload"], {
                [styles["drag-over"]]: isDragOver,
              })}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className={styles["upload-icon"]}>📄</div>
              <div className={styles["upload-text"]}>
                Click to upload or drag & drop files here
              </div>
              <div className={styles["upload-hint"]}>
                Supports: PDF, TXT, MD, JSON, CSV, XML (max 10MB each)
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.txt,.md,.json,.csv,.xml,text/*,application/json,application/xml,application/pdf"
                onChange={handleFileInputChange}
              />
            </div>

            {/* Search Bar */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 40px 12px 16px",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    fontSize: "14px",
                  }}
                />
                <SearchIcon
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "16px",
                    height: "16px",
                    color: "var(--gray)",
                  }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className={styles["document-stats"]}>
              <div className={styles["stat-card"]}>
                <div className={styles["stat-value"]}>
                  {stats.totalDocuments}
                </div>
                <div className={styles["stat-label"]}>Total Documents</div>
              </div>
              <div className={styles["stat-card"]}>
                <div className={styles["stat-value"]}>{stats.totalChunks}</div>
                <div className={styles["stat-label"]}>Text Chunks</div>
              </div>
              <div className={styles["stat-card"]}>
                <div className={styles["stat-value"]}>
                  {formatFileSize(stats.totalSize)}
                </div>
                <div className={styles["stat-label"]}>Total Size</div>
              </div>
              <div className={styles["stat-card"]}>
                <div className={styles["stat-value"]}>
                  {stats.processingDocuments}
                </div>
                <div className={styles["stat-label"]}>Processing</div>
              </div>
            </div>

            {/* Document List */}
            <div className={styles["document-list"]}>
              {filteredDocuments.length === 0 ? (
                <div className={styles["empty-state"]}>
                  <div className={styles["empty-icon"]}>📚</div>
                  <div className={styles["empty-title"]}>
                    {documents.length === 0
                      ? "No documents uploaded"
                      : "No documents match your search"}
                  </div>
                  <div className={styles["empty-description"]}>
                    {documents.length === 0
                      ? "Upload your business documents to get started with AI-powered assistance"
                      : "Try a different search term"}
                  </div>
                </div>
              ) : (
                filteredDocuments.map((doc) => (
                  <div key={doc.id} className={styles["document-item"]}>
                    <div
                      className={clsx(
                        styles["document-icon"],
                        styles[getFileIcon(doc.fileType, doc.fileName)],
                      )}
                    >
                      📄
                    </div>

                    <div className={styles["document-info"]}>
                      <div className={styles["document-name"]}>
                        {doc.fileName}
                      </div>
                      <div className={styles["document-meta"]}>
                        <span className={styles["meta-item"]}>
                          📏 {formatFileSize(doc.size)}
                        </span>
                        <span className={styles["meta-item"]}>
                          📅 {formatDate(doc.uploadedAt)}
                        </span>
                        <span className={styles["meta-item"]}>
                          🧩 {doc.chunks.length} chunks
                        </span>
                      </div>
                      {doc.error && (
                        <div
                          style={{
                            color: "#e74c3c",
                            fontSize: "12px",
                            marginTop: "5px",
                          }}
                        >
                          Error: {doc.error}
                        </div>
                      )}
                    </div>

                    <div
                      className={clsx(
                        styles["document-status"],
                        styles[doc.status],
                      )}
                    >
                      {doc.status === "processing" && "🔄 Processing"}
                      {doc.status === "completed" && "✅ Ready"}
                      {doc.status === "error" && "❌ Error"}
                    </div>

                    <div className={styles["document-actions"]}>
                      <button
                        className={clsx(
                          styles["action-button"],
                          styles["delete"],
                        )}
                        onClick={() =>
                          handleDeleteDocument(doc.id, doc.fileName)
                        }
                        title="Delete document"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Processing Overlay */}
          {(isProcessing || documentStore.isIndexing) && (
            <div className={styles["processing-overlay"]}>
              <div className={styles["processing-modal"]}>
                <div className={styles["processing-spinner"]}></div>
                <div className={styles["processing-text"]}>
                  {isProcessing
                    ? "Processing documents..."
                    : "Indexing documents..."}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
