// src/app/api/cart/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ items: [] });
    }

    const cart = await db.cart.findUnique({
      where: { userId: session.user.id },
      include: {
        items: {
          include: {
            // 👇 NEW: Include offer data to get seller-specific price/stock
            offer: {
              include: {
                seller: { select: { id: true, businessName: true } },
                variant: {
                  include: {
                    product: {
                      select: { id: true, title: true, slug: true, images: { where: { isPrimary: true }, take: 1 } }
                    }
                  }
                }
              }
            },
            variant: {
              include: {
                product: {
                  select: {
                    id: true, 
                    title: true, 
                    slug: true, 
                    sellerId: true,
                    seller: { select: { businessName: true, id: true } },
                    images: { where: { isPrimary: true }, take: 1 }
                  }
                }
              }
            }
          }
        }
      }
    });

    const formattedItems = cart?.items.map((item) => {
      // 👇 If it has an offer, prioritize the seller's offer data
      if (item.offer) {
        return {
          id: item.id,
          productId: item.offer.variant.productId,
          variantId: item.variantId,
          offerId: item.offerId,
          title: item.offer.variant.product.title,
          price: parseFloat(item.offer.price.toString()),
          quantity: item.quantity,
          imageUrl: item.offer.variant.product.images[0]?.url || null,
          slug: item.offer.variant.product.slug,
          stockQuantity: item.offer.stockQuantity,
          sellerId: item.offer.seller.id,
          sellerName: item.offer.seller.businessName,
          isSelected: item.isSelected,
        };
      }
      
      // 👇 Fallback to legacy global variant data
      return {
        id: item.id,
        productId: item.variant.productId,
        variantId: item.variantId,
        offerId: null,
        title: item.variant.product.title,
        price: parseFloat(item.variant.price.toString()),
        quantity: item.quantity,
        imageUrl: item.variant.product.images[0]?.url || null,
        slug: item.variant.product.slug,
        stockQuantity: item.variant.stockQuantity,
        sellerId: item.variant.product.sellerId,
        sellerName: item.variant.product.seller?.businessName || "iBUY Marketplace",
        isSelected: item.isSelected,
      };
    }) || [];

    return NextResponse.json({ items: formattedItems });
  } catch (error) {
    console.error("🚨 Cart GET error:", error);
    return NextResponse.json({ error: "Failed to fetch cart" }, { status: 500 });
  }
}
   
// src/app/api/cart/route.ts (Inside POST handler)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    // ... session check ...

    const body = await req.json();
    const { variantId, offerId, quantity } = body;

    if (!variantId) return NextResponse.json({ error: "Variant ID is required" }, { status: 400 });
    
    // ✅ FIX: Validate that an Offer ID is provided for multi-vendor support
    if (!offerId) return NextResponse.json({ error: "Offer ID is required" }, { status: 400 });

    // Verify the offer exists and is active
    const offer = await db.sellerOffer.findUnique({
      where: { id: offerId },
    });

    if (!offer || !offer.isActive) {
      return NextResponse.json({ error: "Invalid or inactive offer" }, { status: 400 });
    }

    // ... upsert logic ...
    const cartItem = await db.cartItem.upsert({
      where: {
        cartId_variantId_offerId: { // Ensure you have this unique constraint in schema
          cartId: cart.id,
          variantId: variantId,
          offerId: offerId,
        }
      },
      update: { quantity: { increment: quantity } },
      create: {
        cartId: cart.id,
        variantId: variantId,
        offerId: offerId, // ✅ CRITICAL: Save the offerId
        quantity: quantity,
      },
    });

    return NextResponse.json({ success: true, item: cartItem });
  } catch (error) {
    console.error("Cart API Error:", error);
    return NextResponse.json({ error: "Failed to update cart" }, { status: 500 });
  }
}
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: true, message: "Guest cart updated locally" });
    }

    const { cartItemId, quantity, isSelected } = await req.json();

    const item = await db.cartItem.findUnique({
      where: { id: cartItemId },
      include: { 
        cart: true, 
        variant: true,
        offer: true 
      }
    });

    if (!item || item.cart.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const updateData: any = {};
    
    if (quantity !== undefined) {
      const availableStock = item.offer ? item.offer.stockQuantity : item.variant.stockQuantity;
      if (quantity > availableStock) {
        return NextResponse.json({ error: "Exceeds available stock" }, { status: 400 });
      }
      updateData.quantity = quantity;
    }
    
    if (isSelected !== undefined) {
      updateData.isSelected = isSelected;
    }

    await db.cartItem.update({
      where: { id: cartItemId },
      data: updateData
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("🚨 Cart PATCH error:", error);
    return NextResponse.json({ error: "Failed to update cart" }, { status: 500 });
  }
}
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: true, message: "Guest cart updated locally" });
    }

    const { cartItemId } = await req.json();

    const item = await db.cartItem.findUnique({
      where: { id: cartItemId },
      include: { cart: true }
    });

    if (!item || item.cart.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await db.cartItem.delete({ where: { id: cartItemId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("🚨 Cart DELETE error:", error);
    return NextResponse.json({ error: "Failed to remove item" }, { status: 500 });
  }
}