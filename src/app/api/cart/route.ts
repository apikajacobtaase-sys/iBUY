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
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ success: true, message: "Guest cart updated locally" });
    }

    const { variantId, offerId, quantity = 1, isSelected = true } = await req.json();

    if (!variantId) {
      return NextResponse.json({ error: "Variant ID is required" }, { status: 400 });
    }

    // 1. Validate Stock
    let targetStock: number;
    if (offerId) {
      const offer = await db.sellerOffer.findUnique({ where: { id: offerId } });
      if (!offer || offer.status !== "ACTIVE" || offer.stockQuantity < quantity) {
        return NextResponse.json({ error: "Offer unavailable or insufficient stock" }, { status: 400 });
      }
      targetStock = offer.stockQuantity;
    } else {
      const variant = await db.productVariant.findUnique({ where: { id: variantId } });
      if (!variant || variant.stockQuantity < quantity) {
        return NextResponse.json({ error: "Invalid or out of stock item" }, { status: 400 });
      }
      targetStock = variant.stockQuantity;
    }

    // 2. Find or Create the user's cart
    let cart = await db.cart.findUnique({ where: { userId: session.user.id } });
    if (!cart) {
      cart = await db.cart.create({ data: { userId: session.user.id } });
    }

    // 3. Find existing cart item or create a new one (No named constraint needed!)
    let cartItem = await db.cartItem.findFirst({
      where: {
        cartId: cart.id,
        variantId: variantId,
        offerId: offerId || null,
      },
    });

    if (cartItem) {
      // Update existing item quantity
      cartItem = await db.cartItem.update({
        where: { id: cartItem.id },
        data: {
          quantity: { increment: quantity },
          isSelected: true,
        },
      });
    } else {
      // Create new item
      cartItem = await db.cartItem.create({
        data: {
          cartId: cart.id,
          variantId: variantId,
          offerId: offerId || null,
          quantity: quantity,
          isSelected: true,
        },
      });
    }

    // 4. Return the real Database ID so the frontend can sync
    return NextResponse.json({ 
      success: true, 
      cartItem: {
        id: cartItem.id,
        quantity: cartItem.quantity,
      }
    });
  } catch (error: any) {
    console.error("🚨 Cart POST error:", error);
    return NextResponse.json({ error: "Failed to add to cart", details: error.message }, { status: 500 });
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