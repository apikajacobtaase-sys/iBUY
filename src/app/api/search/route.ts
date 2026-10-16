// src/app/api/search/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.replace(/\n/g, " ").substring(0, 8000),
    encoding_format: "float",
  });
  return response.data[0].embedding;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() || "";

    if (!query) {
      return NextResponse.json({ products: [], total: 0 });
    }

    // 1. Traditional Keyword Search (Fast, exact matches)
    const keywordProducts = await db.product.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        variants: { take: 1, select: { price: true, stockQuantity: true } },
        images: { take: 1, select: { url: true } },
        category: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // 2. Semantic Search (For longer, intent-based queries)
    let semanticProducts: any[] = [];
    if (query.length > 3) {
      try {
        const queryEmbedding = await generateEmbedding(query);
        
        // Use raw SQL for cosine similarity (<=>) with pgvector
        const rawResults = await db.$queryRaw<any[]>`
          SELECT 
            id, title, slug, description, status, "categoryId", "sellerId", "createdAt",
            (1 - (embedding <=> ${queryEmbedding}::vector)) as similarity
          FROM "Product"
          WHERE status = 'ACTIVE' AND embedding IS NOT NULL
          ORDER BY similarity DESC
          LIMIT 10
        `;

        // Fetch full relations for the semantic results
        const productIds = rawResults.map((r: any) => r.id);
        semanticProducts = await db.product.findMany({
          where: { id: { in: productIds } },
          include: {
            variants: { take: 1, select: { price: true, stockQuantity: true } },
            images: { take: 1, select: { url: true } },
            category: { select: { name: true } },
          },
        });

        // Sort semantic products to match the raw SQL order
        semanticProducts.sort((a, b) => {
          const simA = rawResults.find((r: any) => r.id === a.id)?.similarity || 0;
          const simB = rawResults.find((r: any) => r.id === b.id)?.similarity || 0;
          return simB - simA;
        });
      } catch (embedError) {
        console.error("Semantic search embedding failed:", embedError);
      }
    }

    // 3. Merge and deduplicate results (Keyword first, then Semantic)
    const combinedMap = new Map();
    
    keywordProducts.forEach((p) => {
      combinedMap.set(p.id, {
        ...p,
        price: p.variants[0]?.price || 0,
        stock: p.variants[0]?.stockQuantity || 0,
        imageUrl: p.images[0]?.url || null,
        categoryName: p.category?.name || "Uncategorized",
        searchType: "keyword",
      });
    });

    semanticProducts.forEach((p) => {
      if (!combinedMap.has(p.id)) {
        combinedMap.set(p.id, {
          ...p,
          price: p.variants[0]?.price || 0,
          stock: p.variants[0]?.stockQuantity || 0,
          imageUrl: p.images[0]?.url || null,
          categoryName: p.category?.name || "Uncategorized",
          searchType: "semantic",
        });
      }
    });

    const finalProducts = Array.from(combinedMap.values()).slice(0, 20);

    return NextResponse.json({
      products: finalProducts,
      total: finalProducts.length,
      query,
    });
  } catch (error) {
    console.error("🚨 Search error:", error);
    return NextResponse.json({ error: "Failed to search products" }, { status: 500 });
  }
}