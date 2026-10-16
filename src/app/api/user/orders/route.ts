// src/app/api/user/orders/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = searchParams.get("status");

    const skip = (page - 1) * limit;

    const whereClause: any = {
      userId: session.user.id,
    };

    if (status && status !== "ALL") {
      whereClause.status = status;
    }

    // Fetch orders and total count in parallel
    const [orders, total] = await Promise.all([
      db.order.findMany({
        where: whereClause,
        include: {
          shippingAddress: {
            select: {
              recipientName: true,
              phone: true,
              neighbourhood: true,
              region: { select: { name: true } },
              district: { select: { name: true } },
              locality: { select: { name: true } },
            },
          },
          items: {
            include: {
              variant: {
                select: {
                  sku: true,
                  product: {
                    select: {
                      id: true,
                      title: true,
                      slug: true,
                      // ✅ FIX: Get seller from the product, not the order item
                      seller: {
                        select: {
                          businessName: true,
                        },
                      },
                      images: {
                        take: 1,
                        select: { url: true },
                      },
                    },
                  },
                },
              },
            },
            orderBy: { id: "asc" },
          },
        },
        orderBy: { id: "desc" },
        skip,
        take: limit,
      }),
      db.order.count({ where: whereClause }),
    ]);

    // Check which orders are eligible for review
    const orderIds = orders.map((o) => o.id);
    const existingReviews = orderIds.length > 0
      ? await db.sellerReview.findMany({
          where: {
            orderId: { in: orderIds },
            buyerId: session.user.id,
          },
          select: { orderId: true },
        })
      : [];

    const reviewedOrderIds = new Set(existingReviews.map((r) => r.orderId));

    // Format data for frontend
    const formattedOrders = orders.map((order) => {
      const primaryImage = order.items[0]?.variant?.product?.images?.[0]?.url || null;
      const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
      
      const hasReviewableItems = order.items.some(
        (item) => item.status === "DELIVERED" && !reviewedOrderIds.has(order.id)
      );

      return {
        id: order.id,
        status: order.status,
        paidAt: order.paidAt,
        deliveredAt: order.deliveredAt,
        cancelledAt: order.cancelledAt,
        cancellationReason: order.cancellationReason,
        paymentMethod: order.paymentMethod,
        totalAmount: Number(order.totalAmount),
        deliveryFee: Number(order.deliveryFee),
        
        customerName: order.shippingAddress?.recipientName || "Customer",
        customerPhone: order.shippingAddress?.phone || "N/A",
        
        shippingAddress: order.shippingAddress
          ? {
              recipientName: order.shippingAddress.recipientName,
              phone: order.shippingAddress.phone,
              full: `${order.shippingAddress.neighbourhood}, ${order.shippingAddress.locality?.name || ""}, ${order.shippingAddress.district?.name || ""}, ${order.shippingAddress.region?.name || ""}`,
            }
          : null,
        
        itemCount,
        primaryImage,
        hasReviewableItems,
        
        items: order.items.map((item) => {
          const productImage = item.variant?.product?.images?.[0]?.url || null;
          const productTitle = item.variant?.product?.title || item.title;
          const productSlug = item.variant?.product?.slug || null;
          // ✅ FIX: Access seller via product
          const sellerName = item.variant?.product?.seller?.businessName || "Unknown Seller";
          
          return {
            id: item.id,
            title: productTitle,
            slug: productSlug,
            quantity: item.quantity,
            price: Number(item.price),
            subtotal: Number(item.price) * item.quantity,
            status: item.status,
            trackingNumber: item.trackingNumber,
            trackingCarrier: item.trackingCarrier,
            shippedAt: item.shippedAt,
            deliveredAt: item.deliveredAt,
            imageUrl: productImage,
            sku: item.variant?.sku || "N/A",
            sellerName: sellerName,
          };
        }),
      };
    });

    return NextResponse.json({
      orders: formattedOrders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("🚨 Fetch customer orders error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch orders" }, { status: 500 });
  }
}