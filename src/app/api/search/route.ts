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



export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // ✅ CORRECTED PRISMA QUERY MATCHING YOUR SCHEMA
    const [products, total] = await Promise.all([
      db.product.findMany({
        where: {
          status: "ACTIVE", // Ensure we only show active products
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        
        // 👇 INCLUDE THE RELATIONSHIPS DEFINED IN YOUR SCHEMA
        include: {
          images: {
            where: { isPrimary: true },
            take: 1,
          },
          seller: {
            select: {
              businessName: true
            },
          },
          variants: {
            where: { isActive: true },
            take: 1, // Get the first active variant
            include: {
              sellerOffers: {
                where: { status: "ACTIVE" },
                orderBy: { price: 'asc' },
                take: 1, // Get the cheapest active offer
              },
            },
          },
        },
      }),
      db.product.count({
        where: {
          status: "ACTIVE",
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
      }),
    ]);

    // ✅ FORMAT DATA FOR FRONTEND
    const formattedProducts = products.map((product) => {
      const bestVariant = product.variants[0];
      const bestOffer = bestVariant?.sellerOffers[0];

      return {
        id: product.id,
        title: product.title,
        slug: product.slug,
        // Use Offer price if available, otherwise Variant base price
        price: bestOffer ? parseFloat(bestOffer.price.toString()) : (bestVariant ? parseFloat(bestVariant.price.toString()) : 0),
        compareAtPrice: bestVariant ? parseFloat(bestVariant.compareAtPrice?.toString() || "0") : 0,
        imageUrl: product.images[0]?.url || null,
        sellerName: product.seller?.businessName || "iBUY Marketplace",
        stockQuantity: bestOffer ? bestOffer.stockQuantity : (bestVariant?.stockQuantity || 0),
        bestVariantId: bestVariant?.id || null,
        bestOfferId: bestOffer?.id || null,
        sellerId: product.sellerId || "unknown",
      };
    });

    return NextResponse.json({ 
      products: formattedProducts, 
      total,
      page,
      hasMore: total > skip + limit
    });

  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products", details: String(error) },
      { status: 500 }
    );
  }
}