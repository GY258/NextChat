import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { IconButton } from "./button";
import { ErrorBoundary } from "./error";

import styles from "./document-manager.module.scss";

import CloseIcon from "../icons/close.svg";
import SettingsIcon from "../icons/settings.svg";

import { DocumentManagerPage } from "./document-manager";
import { IRDocumentManagerPage } from "./ir-document-manager";

type DocumentSystemType = "original" | "ir";

export function DocumentManagerSwitcher() {
  const navigate = useNavigate();
  const [activeSystem, setActiveSystem] = useState<DocumentSystemType>("ir");

  const handleSystemSwitch = (system: DocumentSystemType) => {
    setActiveSystem(system);
  };

  return (
    <ErrorBoundary>
      <div className="window-header">
        <div className="window-header-title">
          <div className="window-header-main-title">文档管理系统</div>
          <div className="window-header-sub-title">选择文档处理和检索模式</div>
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
        {/* System Selector */}
        <div className={styles.systemSelector}>
          <div className={styles.selectorHeader}>
            <SettingsIcon />
            <span>选择文档系统</span>
          </div>

          <div className={styles.systemOptions}>
            <button
              className={`${styles.systemOption} ${
                activeSystem === "original" ? styles.active : ""
              }`}
              onClick={() => handleSystemSwitch("original")}
            >
              <div className={styles.optionIcon}>📄</div>
              <div className={styles.optionInfo}>
                <div className={styles.optionTitle}>原始系统</div>
                <div className={styles.optionDescription}>
                  基于向量嵌入的语义搜索
                </div>
                <div className={styles.optionFeatures}>
                  • 语义相似度匹配
                  <br />
                  • OpenAI Embeddings
                  <br />• 余弦相似度评分
                </div>
              </div>
            </button>

            <button
              className={`${styles.systemOption} ${
                activeSystem === "ir" ? styles.active : ""
              }`}
              onClick={() => handleSystemSwitch("ir")}
            >
              <div className={styles.optionIcon}>🔍</div>
              <div className={styles.optionInfo}>
                <div className={styles.optionTitle}>IR系统 (推荐)</div>
                <div className={styles.optionDescription}>
                  基于BM25的专业信息检索系统
                </div>
                <div className={styles.optionFeatures}>
                  • BM25评分算法
                  <br />
                  • 层次搜索 (文档→块)
                  <br />
                  • 倒排索引
                  <br />
                  • 字段权重
                  <br />• 伪相关反馈
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Feature Comparison */}
        <div className={styles.featureComparison}>
          <h3>功能对比</h3>

          <div className={styles.comparisonTable}>
            <div className={styles.comparisonHeader}>
              <div>功能</div>
              <div>原始系统</div>
              <div>IR系统</div>
            </div>

            <div className={styles.comparisonRow}>
              <div>搜索方式</div>
              <div>语义相似度</div>
              <div>关键词匹配 + 语义</div>
            </div>

            <div className={styles.comparisonRow}>
              <div>分块策略</div>
              <div>固定长度</div>
              <div>400-800 tokens, 重叠</div>
            </div>

            <div className={styles.comparisonRow}>
              <div>评分算法</div>
              <div>余弦相似度</div>
              <div>BM25 + 字段权重</div>
            </div>

            <div className={styles.comparisonRow}>
              <div>索引结构</div>
              <div>向量索引</div>
              <div>双层倒排索引</div>
            </div>

            <div className={styles.comparisonRow}>
              <div>查询优化</div>
              <div>无</div>
              <div>停用词、同义词、PRF</div>
            </div>

            <div className={styles.comparisonRow}>
              <div>性能</div>
              <div>需要API调用</div>
              <div>本地计算，更快</div>
            </div>

            <div className={styles.comparisonRow}>
              <div>适用场景</div>
              <div>语义理解需求高</div>
              <div>精确信息检索</div>
            </div>
          </div>
        </div>
      </div>

      {/* Render Selected System */}
      <div className={styles.systemContainer}>
        {activeSystem === "original" ? (
          <DocumentManagerPage />
        ) : (
          <IRDocumentManagerPage />
        )}
      </div>
    </ErrorBoundary>
  );
}

// Add styles for system selector
const selectorStyles = `
.systemSelector {
  background-color: var(--white);
  border: 1px solid var(--border-in-light);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.selectorHeader {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  font-size: 18px;
  font-weight: 500;
  color: var(--black);
}

.systemOptions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.systemOption {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  border: 2px solid var(--border-in-light);
  border-radius: 12px;
  background-color: var(--white);
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;

  &:hover {
    border-color: var(--primary);
    background-color: var(--hover-color);
  }

  &.active {
    border-color: var(--primary);
    background-color: var(--primary-alpha);
  }
}

.optionIcon {
  font-size: 32px;
  flex-shrink: 0;
}

.optionInfo {
  flex: 1;
}

.optionTitle {
  font-size: 18px;
  font-weight: 600;
  color: var(--black);
  margin-bottom: 8px;
}

.optionDescription {
  font-size: 14px;
  color: var(--gray);
  margin-bottom: 12px;
}

.optionFeatures {
  font-size: 12px;
  color: var(--gray);
  line-height: 1.5;
}

.featureComparison {
  background-color: var(--white);
  border: 1px solid var(--border-in-light);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;

  h3 {
    margin: 0 0 16px 0;
    font-size: 18px;
    color: var(--black);
  }
}

.comparisonTable {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1px;
  background-color: var(--border-in-light);
  border-radius: 8px;
  overflow: hidden;
}

.comparisonHeader {
  display: contents;
  
  > div {
    padding: 12px 16px;
    background-color: var(--hover-color);
    font-weight: 600;
    font-size: 14px;
    color: var(--black);
  }
}

.comparisonRow {
  display: contents;
  
  > div {
    padding: 12px 16px;
    background-color: var(--white);
    font-size: 14px;
    color: var(--black);
    
    &:first-child {
      font-weight: 500;
    }
  }
}

.systemContainer {
  margin-top: 20px;
}

@media (max-width: 768px) {
  .systemOptions {
    grid-template-columns: 1fr;
  }
  
  .comparisonTable {
    font-size: 12px;
  }
}
`;
