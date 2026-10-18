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

    // Inside src/app/api/search/route.ts

        // Inside src/app/api/search/route.ts

const formattedProducts = products.map((product) => {
  // ✅ FIX: Safely find the best active offer
  const bestOffer = product.offers?.find((o: any) => o.isActive && o.stockQuantity > 0);
  
  // ✅ FIX: Safely find the first variant
  const bestVariant = product.variants?.[0];

  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    
    // ✅ FIX: Use Offer data if it exists, otherwise fall back to Variant
    price: bestOffer 
      ? parseFloat(bestOffer.price.toString()) 
      : (bestVariant ? parseFloat(bestVariant.price.toString()) : 0),
      
    stockQuantity: bestOffer 
      ? bestOffer.stockQuantity 
      : (bestVariant ? bestVariant.stockQuantity : 0),
      
    // ✅ CRITICAL: Pass these IDs so the cart knows which one to use
    bestOfferId: bestOffer?.id || null,
    bestVariantId: bestVariant?.id || null,
    
    imageUrl: product.images?.[0]?.url || null,
    sellerName: bestOffer ? bestOffer.seller?.businessName : "iBUY Marketplace",
    sellerId: bestOffer ? bestOffer.sellerId : product.sellerId,
    inStock: (bestOffer ? bestOffer.stockQuantity : (bestVariant?.stockQuantity || 0)) > 0,
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