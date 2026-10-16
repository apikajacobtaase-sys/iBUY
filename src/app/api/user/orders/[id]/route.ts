// src/app/api/user/orders/[orderId]/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await params;

    const order = await db.order.findFirst({
      where: {
        id: orderId,
        userId: session.user.id, // Security: Ensure user owns this order
      },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    id: true,
                    slug: true,
                    images: { where: { isPrimary: true }, take: 1 },
                  },
                },
              },
            },
            seller: {
              select: {
                id: true,
                businessName: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Format the order to perfectly match the frontend Order interface
    const formattedOrder = {
      id: order.id,
      status: order.status,
      paidAt: order.createdAt.toISOString(), // Using createdAt as paidAt fallback
      totalAmount: parseFloat(order.totalAmount.toString()),
      deliveryFee: parseFloat(order.deliveryFee.toString()),
      subtotal: parseFloat(order.totalAmount.toString()) - parseFloat(order.deliveryFee.toString()),
      paymentMethod: "PAYSTACK", // Or pull from your payment relation if stored
      paymentReference: order.paymentReference,
      customerName: order.deliveryRecipient || "Customer",
      customerPhone: order.deliveryPhone || "N/A",
      shippingAddress: {
        recipientName: order.deliveryRecipient || "Customer",
        phone: order.deliveryPhone || "N/A",
        full: `${order.deliveryStreet || ""}, ${order.deliveryLandmark ? order.deliveryLandmark + ", " : ""}${order.deliveryLocality || ""}, ${order.deliveryDistrict || ""}, ${order.deliveryRegion || ""}`.trim(),
      },
      hasReviewableItems: order.status === "DELIVERED",
      hasExistingReview: false, // You can query the Review model here if needed
      items: order.items.map((item: any) => ({
        id: item.id,
        title: item.title,
        slug: item.variant?.product?.slug || null,
        productId: item.variant?.product?.id || null,
        variantId: item.variantId,
        quantity: item.quantity,
        price: parseFloat(item.price.toString()),
        subtotal: parseFloat(item.price.toString()) * item.quantity,
        status: item.status,
        trackingNumber: item.trackingNumber,
        trackingCarrier: item.trackingCarrier,
        shippedAt: item.shippedAt?.toISOString() || null,
        deliveredAt: item.deliveredAt?.toISOString() || null,
        imageUrl: item.variant?.product?.images?.[0]?.url || null,
        sku: item.variant?.sku || "N/A",
        sellerId: item.seller?.id || null,
        sellerName: item.seller?.businessName || "Unknown Seller",
      })),
    };

    return NextResponse.json({ order: formattedOrder });
  } catch (error) {
    console.error("🚨 Fetch order details error:", error);
    return NextResponse.json({ error: "Failed to fetch order details" }, { status: 500 });
  }
}