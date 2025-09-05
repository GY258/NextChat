import { NextRequest, NextResponse } from "next/server";
import { getServerSideConfig } from "../../config/server";
import { OPENAI_BASE_URL } from "../../constant";

export async function POST(req: NextRequest) {
  try {
    const { input } = await req.json();

    if (!input || typeof input !== "string") {
      return NextResponse.json(
        { error: "Invalid input provided" },
        { status: 400 },
      );
    }

    const serverConfig = getServerSideConfig();

    // Use OpenAI's embedding API if available
    if (serverConfig.apiKey) {
      const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serverConfig.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-ada-002",
          input: input,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          embedding: data.data[0].embedding,
          model: "text-embedding-ada-002",
        });
      }
    }

    // Fallback to simple hash-based embedding
    const embedding = createSimpleEmbedding(input);

    return NextResponse.json({
      embedding,
      model: "simple-hash",
    });
  } catch (error) {
    console.error("Embedding API error:", error);
    return NextResponse.json(
      { error: "Failed to generate embedding" },
      { status: 500 },
    );
  }
}

function createSimpleEmbedding(text: string): number[] {
  const words = text.toLowerCase().split(/\W+/);
  const embedding = new Array(384).fill(0); // 384-dimensional vector

  for (const word of words) {
    if (word.length > 2) {
      const hash = simpleHash(word);
      const index = Math.abs(hash) % embedding.length;
      embedding[index] += 1;
    }
  }

  // Normalize
  const magnitude = Math.sqrt(
    embedding.reduce((sum, val) => sum + val * val, 0),
  );
  return magnitude > 0 ? embedding.map((val) => val / magnitude) : embedding;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}
