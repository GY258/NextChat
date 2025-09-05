import { usePluginStore } from "../store/plugin";
import {
  createDocumentRAGPlugin,
  DOCUMENT_RAG_PLUGIN_ID,
} from "./document-rag-plugin";

let initialized = false;

export function initializeDocumentRAG() {
  if (initialized) return;

  try {
    const pluginStore = usePluginStore.getState();

    // Check if the plugin already exists
    const existingPlugin = pluginStore.get(DOCUMENT_RAG_PLUGIN_ID);

    if (!existingPlugin) {
      // Create and register the RAG plugin
      const ragPlugin = createDocumentRAGPlugin();
      pluginStore.create(ragPlugin);
      console.log("[Document RAG] Plugin initialized successfully");
    }

    initialized = true;
  } catch (error) {
    console.error("[Document RAG] Failed to initialize plugin:", error);
  }
}

// Auto-initialize when the module is loaded
if (typeof window !== "undefined") {
  // Wait for stores to be ready
  setTimeout(initializeDocumentRAG, 1000);
}
