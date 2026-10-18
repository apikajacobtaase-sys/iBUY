 // src/app/api/checkout/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

// ✅ FIX 1: Add discount fields to the schema
const checkoutSchema = z.object({
  cartItemIds: z.array(z.string()).min(1, "At least one item is required"),
  localityId: z.string().min(1, "Locality ID is required"),
  discountId: z.string().optional(), // ✅ Added
  discountAmount: z.number().optional(), // ✅ Added
  address: z.object({
    recipientName: z.string().min(1, "Recipient name is required"),
    phone: z.string().min(1, "Phone number is required"),
    country: z.string().optional().default("Ghana"),
    landmark: z.string().optional(),
    street: z.string().min(1, "Street details are required"),
    instructions: z.string().optional(),
  }),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = checkoutSchema.parse(body);

    // 1. Fetch cart items securely
    const cartItems = await db.cartItem.findMany({
      where: {
        id: { in: validated.cartItemIds },
        cart: { userId: session.user.id },
      },
      include: {
        offer: {
          include: {
            variant: { include: { product: { select: { title: true } } } },
            seller: { select: { id: true } },
          },
        },
        variant: {
          include: {
            product: { select: { title: true, sellerId: true } },
          },
        },
      },
    });

    if (cartItems.length === 0) {
      return NextResponse.json({ error: "No valid items to checkout." }, { status: 400 });
    }

    // 2. Validate Delivery Zone
    const zoneLocality = await db.deliveryZoneLocality.findFirst({
      where: {
        localityId: validated.localityId,
        deliveryZone: { status: "ACTIVE" },
      },
      include: {
        deliveryZone: true,
        locality: { include: { district: { include: { region: true } } } },
      },
    });

    if (!zoneLocality) {
      return NextResponse.json({ error: "Delivery is no longer available to this location." }, { status: 400 });
    }

    const zone = zoneLocality.deliveryZone;
    const deliveryFee = parseFloat(zone.baseDeliveryFee.toString());
    
    // 3. Calculate Server-Side Subtotal
    let serverSubtotal = 0;
    for (const item of cartItems) {
      const price = item.offer ? parseFloat(item.offer.price.toString()) : parseFloat(item.variant.price.toString());
      serverSubtotal += price * item.quantity;
    }

    // Apply Discount to Total
    const discountAmount = validated.discountAmount || 0;
    const finalTotal = Math.max(0, serverSubtotal + deliveryFee - discountAmount);

    // 4. Atomic Transaction
    const order = await db.$transaction(async (tx) => {
      
      // A. Concurrency Safety: Re-validate stock
      for (const item of cartItems) {
        const currentStock = item.offer ? item.offer.stockQuantity : item.variant.stockQuantity;
        const itemName = item.offer ? item.offer.variant.product.title : item.variant.product.title;

        if (currentStock < item.quantity) {
          throw new Error(`Insufficient stock for "${itemName}". Only ${currentStock} left.`);
        }
        if (item.offer && item.offer.status !== "ACTIVE") {
          throw new Error(`The offer for "${itemName}" is no longer available.`);
        }
      }

      // B. Create Order
      const newOrder = await tx.order.create({
        data: {
          userId: session.user.id,
          totalAmount: finalTotal,
          status: "PENDING",
          discountCodeId: validated.discountId || null,
          discountAmount: discountAmount,
          deliveryRecipient: validated.address.recipientName,
          deliveryPhone: validated.address.phone,
          deliveryFee: deliveryFee,
          deliveryRegion: zoneLocality.locality.district.region.name,
          deliveryDistrict: zoneLocality.locality.district.name,
          deliveryLocality: zoneLocality.locality.name,
          deliveryLandmark: validated.address.landmark || null,
          deliveryStreet: validated.address.street,
          payment: {
            create: {
              provider: "PAYSTACK",
              status: "PENDING",
              amount: finalTotal,
              currency: "GHS",
            },
          },
          items: {
            create: cartItems.map((item) => {
              const isOffer = !!item.offer;
              const sellerId = isOffer ? item.offer?.sellerId : item.variant?.product?.sellerId;

              return {
                variant: { connect: { id: item.variantId } },
                title: isOffer ? item.offer!.variant.product.title : item.variant!.product.title,
                price: isOffer ? parseFloat(item.offer!.price.toString()) : parseFloat(item.variant!.price.toString()),
                quantity: item.quantity,
                sellerId: sellerId || "unknown",
                offer: isOffer ? { connect: { id: item.offer!.id } } : undefined,
                status: "PENDING",
              };
            }),
          },
        },
      });

      // ✅ FIX 2: Atomically increment discount usage OUTSIDE the items map
      if (validated.discountId) {
        await tx.discountCode.update({
          where: { id: validated.discountId },
          data: { usedCount: { increment: 1 } },
        });
      }
      
      // C. Deduct Stock
      for (const item of cartItems) {
        if (item.offerId) {
          await tx.sellerOffer.update({
            where: { id: item.offerId },
            data: { stockQuantity: { decrement: item.quantity } },
          });
        } else if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQuantity: { decrement: item.quantity } },
          });
        }
      }
      
      // D. Clear purchased items from cart
      await tx.cartItem.deleteMany({
        where: { id: { in: validated.cartItemIds } },
      });
      
      return newOrder;
    });

    // 5. Initialize Paystack
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: session.user.email,
        amount: Math.round(finalTotal * 100),
        reference: `ORDER-${order.id}-${Date.now()}`,
        callback_url: `https://ibuy-apikajacobtaase-sys.vercel.app/payment/success`,
        metadata: { order_id: order.id },
      }),
    });

    const paystackData = await paystackResponse.json();
    if (!paystackData.status) {
      throw new Error(paystackData.message || "Paystack initialization failed");
    }

    await db.order.update({
      where: { id: order.id },
      data: { paymentReference: paystackData.data.reference },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      authorizationUrl: paystackData.data.authorization_url,
    });

  } catch (error: any) {
    console.error("🚨 Checkout error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues?.[0]?.message || "Invalid form data" }, { status: 400 });
    }
    if (error.message?.includes("Insufficient stock")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to process checkout" }, { status: 500 });
  }
}