// src/app/api/search/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import OpenAI from "openai";

 const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-dummy-key-for-build",
});

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.replace(/\n/g, " ").substring(0, 8000),
    encoding_format: "float",
  });
  return response.data[0].embedding;
}


// src/app/api/search/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Example Prisma query (adjust to match your actual schema)
    const [products, total] = await Promise.all([
      db.product.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
          isActive: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          variants: {
            include: {
              offers: {
                where: { isActive: true },
                orderBy: { price: 'asc' },
                take: 1,
              },
            },
          },
          seller: { select: { storeName: true } },
        },
      }),
      db.product.count({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
          isActive: true,
        },
      }),
    ]);

    // Format products for the frontend
    const formattedProducts = products.map((product) => {
      const bestVariant = product.variants[0];
      const bestOffer = bestVariant?.offers[0];
      return {
        id: product.id,
        title: product.title,
        slug: product.slug,
        price: bestOffer ? parseFloat(bestOffer.price.toString()) : 0,
        compareAtPrice: bestVariant ? parseFloat(bestVariant.basePrice.toString()) : 0,
        imageUrl: product.images[0]?.url || null,
        sellerName: product.seller?.storeName || "Unknown Seller",
        stockQuantity: bestVariant?.stockQuantity || 0,
      };
    });

    return NextResponse.json({ 
      products: formattedProducts, 
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error("Search API Error:", error);
    // ✅ CRITICAL: Always return JSON, even on error
    return NextResponse.json(
      { error: "Failed to fetch products", details: String(error) },
      { status: 500 }
    );
  }
}