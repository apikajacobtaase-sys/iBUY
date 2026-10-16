// src/app/api/seller/metrics/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Get the seller profile
    const seller = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, businessName: true, commissionRate: true },
    });

    if (!seller) {
      return NextResponse.json({ error: "Seller profile not found" }, { status: 404 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 2. Run all queries in parallel
    const [
      totalRevenueResult,
      totalOrdersResult,
      revenueChartResult,
      topProductsResult,
      lowStockResult,
      pendingOrdersCount,
    ] = await Promise.all([
      // Total Gross Revenue (using raw SQL for snake_case)
      db.$queryRaw<any[]>`
        SELECT COALESCE(SUM(oi.price * oi.quantity), 0) as revenue
        FROM "order_items" oi
        JOIN "orders" o ON o.id = oi."order_id"
        WHERE oi."seller_id" = ${seller.id}
          AND o."payment_reference" IS NOT NULL
      `,

      // Total Orders Count
      db.$queryRaw<any[]>`
        SELECT COUNT(DISTINCT oi."order_id")::int as count
        FROM "order_items" oi
        JOIN "orders" o ON o.id = oi."order_id"
        WHERE oi."seller_id" = ${seller.id}
          AND o."payment_reference" IS NOT NULL
      `,

      // 30-Day Revenue Chart
      db.$queryRaw<any[]>`
        SELECT 
          DATE_TRUNC('day', o."created_at")::date as date,
          COALESCE(SUM(oi.price * oi.quantity), 0) as revenue,
          COUNT(DISTINCT oi."order_id")::int as orders
        FROM "order_items" oi
        JOIN "orders" o ON o.id = oi."order_id"
        WHERE oi."seller_id" = ${seller.id}
          AND o."payment_reference" IS NOT NULL
          AND o."created_at" >= ${thirtyDaysAgo}
        GROUP BY DATE_TRUNC('day', o."created_at")
        ORDER BY date ASC
      `,

      // Top 5 Selling Products
      db.$queryRaw<any[]>`
        SELECT 
          p.id,
          p.title,
          p.slug,
          SUM(oi.quantity)::int as units_sold,
          COALESCE(SUM(oi.price * oi.quantity), 0) as revenue
        FROM "order_items" oi
        JOIN "products" p ON p.id = oi."product_id"
        JOIN "orders" o ON o.id = oi."order_id"
        WHERE oi."seller_id" = ${seller.id}
          AND o."payment_reference" IS NOT NULL
        GROUP BY p.id, p.title, p.slug
        ORDER BY revenue DESC
        LIMIT 5
      `,

      // Low Stock Variants (< 5)
      db.productVariant.findMany({
        where: {
          product: { sellerId: seller.id },
          stockQuantity: { lt: 5 },
        },
        select: {
          id: true,
          sku: true,
          stockQuantity: true,
          product: { select: { id: true, title: true, slug: true } },
        },
        orderBy: { stockQuantity: "asc" },
        take: 5,
      }),

      // Pending Orders (Orders where at least one item is PENDING or PROCESSING)
      db.orderItem.count({
        where: {
          sellerId: seller.id,
          status: { in: ["PENDING", "PROCESSING"] },
        },
      }),
    ]);

    const grossRevenue = Number(totalRevenueResult[0]?.revenue || 0);
    const totalOrders = Number(totalOrdersResult[0]?.count || 0);
    const commissionRate = Number(seller.commissionRate);
    const netEarnings = grossRevenue * (1 - commissionRate / 100);
    const avgOrderValue = totalOrders > 0 ? grossRevenue / totalOrders : 0;

    // Format chart data (fill missing days with 0)
    const revenueChart = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      const dayData = revenueChartResult.find(
        (d: any) => new Date(d.date).toISOString().split("T")[0] === dateStr
      );
      revenueChart.push({
        date: dateStr,
        revenue: dayData ? Number(dayData.revenue) : 0,
        orders: dayData ? Number(dayData.orders) : 0,
      });
    }

    return NextResponse.json({
      summary: {
        grossRevenue,
        netEarnings,
        totalOrders,
        avgOrderValue,
        pendingOrders: pendingOrdersCount,
        commissionRate,
      },
      revenueChart,
      topProducts: topProductsResult.map((p: any) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        unitsSold: Number(p.units_sold),
        revenue: Number(p.revenue),
      })),
      lowStock: lowStockResult.map((v: any) => ({
        id: v.id,
        sku: v.sku,
        stockQuantity: v.stockQuantity,
        productTitle: v.product.title,
        productSlug: v.product.slug,
      })),
    });
  } catch (error: any) {
    console.error("🚨 Seller metrics error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}