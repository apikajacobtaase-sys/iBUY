 // src/app/api/search/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // 1. Fetch Products with Variants and their Seller Offers
    const [products, total] = await Promise.all([
      db.product.findMany({
        where: {
          status: "ACTIVE",
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          seller: { select: { businessName: true, id: true } },
          variants: {
            where: { isActive: true },
            include: {
              sellerOffers: {
                where: { status: "ACTIVE", stockQuantity: { gt: 0 } },
                include: { seller: { select: { businessName: true, id: true } } },
                orderBy: { price: 'asc' },
                take: 1 // Get the cheapest active offer for this variant
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

    // 2. Map the data to find the absolute best offer across all variants
    const formattedProducts = products.map((product) => {
      let bestOffer: any = null;
      let bestVariantId: string | null = null;

      // Loop through variants to find the cheapest offer with stock
      for (const variant of product.variants) {
        if (variant.sellerOffers && variant.sellerOffers.length > 0) {
          const offer = variant.sellerOffers[0]; // Already sorted by price asc
          if (!bestOffer || parseFloat(offer.price.toString()) < parseFloat(bestOffer.price.toString())) {
            bestOffer = offer;
            bestVariantId = variant.id;
          }
        }
      }

      return {
        id: product.id,
        title: product.title,
        slug: product.slug,
        
        // ✅ Use Offer data exclusively
        price: bestOffer ? parseFloat(bestOffer.price.toString()) : 0,
        stockQuantity: bestOffer ? bestOffer.stockQuantity : 0,
        
        // ✅ CRITICAL: Pass IDs to frontend
        bestOfferId: bestOffer?.id || null,
        bestVariantId: bestVariantId, // Keep for schema relations, but logic uses offerId
        
        imageUrl: product.images[0]?.url || null,
        sellerName: bestOffer ? bestOffer.seller.businessName : (product.seller?.businessName || "iBUY Marketplace"),
        sellerId: bestOffer ? bestOffer.seller.id : product.sellerId,
        inStock: !!bestOffer,
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