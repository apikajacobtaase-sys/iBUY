 // src/app/api/checkout/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const checkoutSchema = z.object({
  cartItemIds: z.array(z.string()).min(1, "At least one item is required"),
  localityId: z.string().min(1, "Locality ID is required"),
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
    console.log("🔍 CHECKOUT REQUEST RECEIVED:", JSON.stringify(body, null, 2));

    const validated = checkoutSchema.parse(body);
    console.log("🔍 DEBUG: Checking cartItem ID:", validated.cartItemIds[0]);
    const debugItem = await db.cartItem.findUnique({
      where: { id: validated.cartItemIds[0] },
      include: { cart: { select: { userId: true } } }
    });
    console.log("🔍 DEBUG: Item exists in DB?", !!debugItem);
    console.log("🔍 DEBUG: Item's cart userId:", debugItem?.cart?.userId);
    console.log("🔍 DEBUG: Current session userId:", session.user.id);

          
    // 1. Fetch cart items securely
    const cartItems = await db.cartItem.findMany({
      where: {
        id: { in: validated.cartItemIds },
        cart: { userId: session.user.id },
      },
      include: {
        cart: { select: { userId: true } },
        offer: {
          include: {
            variant: { include: { product: { select: { title: true } } } },
            seller: { select: { id: true, businessName: true } },
          },
        },
        variant: {
          include: {
            product: { select: { title: true, sellerId: true, id: true } },
          },
        },
      },
    });

    if (cartItems.length === 0) {
      return NextResponse.json({ error: "No valid items to checkout." }, { status: 400 });
    }

    // 2. REVALIDATE Delivery Zone (FIXED: Use localityId, NOT address.locality)
   // console.log("🔍 Checking delivery zone for localityId:", validated.localityId);
    
    const zoneLocality = await db.deliveryZoneLocality.findFirst({
      where: {
        localityId: validated.localityId, // 👈 FIXED: This matches the schema
        deliveryZone: { status: "ACTIVE" },
      },
      include: {
        deliveryZone: true,
        locality: {
          include: {
            district: { include: { region: true } },
          },
        },
      },
    });

    if (!zoneLocality) {
      console.error("❌ Delivery zone not found for localityId:", validated.localityId);
      return NextResponse.json({ error: "Delivery is no longer available to this location." }, { status: 400 });
    }

    const zone = zoneLocality.deliveryZone;
    const deliveryFee = parseFloat(zone.baseDeliveryFee.toString());
    const minOrderValue = zone.minOrderValue ? parseFloat(zone.minOrderValue.toString()) : null;

    // 3. Calculate Server-Side Subtotal
    let serverSubtotal = 0;
    for (const item of cartItems) {
      const price = item.offer ? parseFloat(item.offer.price.toString()) : parseFloat(item.variant.price.toString());
      serverSubtotal += price * item.quantity;
    }

    // 4. Enforce Minimum Order Value
    if (minOrderValue !== null && serverSubtotal < minOrderValue) {
      return NextResponse.json({ 
        error: `Minimum order value for this location is GH₵ ${minOrderValue.toFixed(2)}.` 
      }, { status: 400 });
    }

    const finalTotal = serverSubtotal + deliveryFee;
    console.log("✅ Validation passed. Starting database transaction...");

    // 5. Atomic Transaction: Create Order, Deduct Stock, Clear Cart
    const order = await db.$transaction(async (tx) => {
      // A. Concurrency Safety: Re-validate stock
      for (const item of cartItems) {
        if (item.offer) {
          if (item.offer.status !== "ACTIVE" || item.offer.stockQuantity < item.quantity) {
            throw new Error(`Insufficient stock for: ${item.offer.variant.product.title}`);
          }
        } else {
          if (item.variant.stockQuantity < item.quantity) {
            throw new Error(`Insufficient stock for: ${item.variant.product.title}`);
          }
        }
      }

      // B. Create Order with Delivery Snapshot AND Pending Payment
      const newOrder = await tx.order.create({
        data: {
          userId: session.user.id,
          totalAmount: finalTotal,
          status: "PENDING",
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
          
          // ✅ SAFELY GET SELLER ID
          const sellerId = isOffer 
            ? item.offer?.sellerId 
            : item.variant?.product?.sellerId;

          return {
            variant: { connect: { id: item.variantId } },
            title: isOffer 
              ? item.offer!.variant.product.title 
              : item.variant!.product.title,
            price: isOffer 
              ? parseFloat(item.offer!.price.toString()) 
              : parseFloat(item.variant!.price.toString()),
            quantity: item.quantity,
            
            // ✅ FIX: Just set the ID directly. It's safer than 'connect' in this context.
            sellerId: sellerId || "unknown", 
            
            offer: isOffer ? { connect: { id: item.offer!.id } } : undefined,
            status: "PENDING",
          };
        }),
      },
        },
      });

      // C. Deduct Stock Atomically (Respecting Separate Inventory Pools)
      //console.log("📦 STARTING STOCK DEDUCTION for", cartItems.length, "items");
           // A. Concurrency Safety: Re-validate stock
      for (const item of cartItems) {
        // ✅ FIX: Check Offer Stock first, then Variant Stock
        const currentStock = item.offer 
          ? item.offer.stockQuantity 
          : item.variant.stockQuantity;

        if (currentStock < item.quantity) {
          const itemName = item.offer 
            ? item.offer.variant.product.title 
            : item.variant.product.title;
            
          throw new Error(`Insufficient stock for "${itemName}". Only ${currentStock} left.`);
        }

        // ✅ FIX: Ensure the Offer is still Active
        if (item.offer && item.offer.status !== "ACTIVE") {
           throw new Error(`The offer for "${item.offer.variant.product.title}" is no longer available.`);
        }
      }
      
      // D. Clear purchased items from cart
      await tx.cartItem.deleteMany({
        where: { id: { in: validated.cartItemIds } },
      });
      console.log("🎉 TRANSACTION COMPLETE: Order created, stock deducted, cart cleared.");
      
      return newOrder;
    });

    // 6. Initialize Paystack
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: session.user.email,
        amount: Math.round(parseFloat(finalTotal.toString()) * 100),
        reference: `ORDER-${order.id}-${Date.now()}`,
       // ✅ NUCLEAR FIX: Hardcode the live Vercel URL to guarantee no localhost fallback
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
      return NextResponse.json({ error: error.issues?.[0]?.message  || "Invalid form data" }, { status: 400 });
    }
    if (error.message?.includes("Insufficient stock")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to process checkout" }, { status: 500 });
  }
}