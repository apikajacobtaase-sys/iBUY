 // src/app/api/payments/verify/route.ts
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { VerifyPaymentSchema } from "@/lib/validators/payment";
import https from "https";
import { sendOrderConfirmationEmail, sendSellerNotificationEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    // 1. Authenticate
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse and validate input with Zod
    const body = await req.json();
    const parseResult = VerifyPaymentSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }
    const { reference } = parseResult.data;

    // 3. Cryptographically verify with Paystack
    const verifyResult = await verifyWithPaystack(reference);
    if (!verifyResult.success) {
      return NextResponse.json(
        { error: verifyResult.error || "Payment verification failed" },
        { status: 400 }
      );
    }

    // 4. Find the Order and Payment records
    const order = await db.order.findFirst({
      where: { paymentReference: reference },
      include: {
        payment: true,
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    seller: {
                      include: {
                        user: { select: { email: true, firstName: true, lastName: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        user: {
          select: { email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 5. IDEMPOTENCY CHECK: If payment is already successful, don't process again
    if (order.payment?.status === "SUCCESSFUL") {
      console.log(`⚠️ Payment already verified for order ${order.id}. Skipping duplicate processing.`);
      return NextResponse.json({
        success: true,
        orderId: order.id,
        message: "Payment already verified",
        duplicate: true,
      });
    }

    // 6. ATOMIC TRANSACTION: Update Payment + Order + Create Financial Records
    await db.$transaction(async (tx) => {
      // 6a. ATOMIC UPDATE: Only update if status is currently PENDING.
      // This prevents race conditions with the webhook.
      const paymentUpdate = await tx.payment.updateMany({
        where: { 
          orderId: order.id,
          status: "PENDING" // 👈 CRITICAL: Only touch it if it hasn't been processed yet
        },
        data: {
          status: "SUCCESSFUL",
          providerTransactionId: verifyResult.data?.reference || reference,
          metadata: {
            ...((order.payment?.metadata as any) || {}),
            paystackResponse: verifyResult.data,
            verifiedAt: new Date().toISOString(),
            verifiedVia: "frontend_redirect",
          },
        },
      });

      // 6b. If count is 0, the webhook already handled it. Skip the rest safely.
      if (paymentUpdate.count === 0) {
        console.log(`ℹ️ Payment for order ${order.id} was already processed (likely by webhook). Skipping duplicate financial records.`);
        return; 
      }

      // 6c. Update Order status to CONFIRMED
      await tx.order.update({
        where: { id: order.id },
        data: { status: "CONFIRMED" },
      });

      // 6d. MARKETPLACE FINANCE ENGINE: Create SellerFinancialRecord for each seller
      const sellerTotals = new Map<string, { grossAmount: number; commissionRate: number }>();

      for (const item of order.items) {
        const sellerId = item.variant.product.seller.id;
        const commissionRate = item.variant.product.seller.commissionRate.toNumber();
        const lineTotal = item.price.toNumber() * item.quantity;

        if (!sellerTotals.has(sellerId)) {
          sellerTotals.set(sellerId, { grossAmount: 0, commissionRate });
        }

        const existing = sellerTotals.get(sellerId)!;
        existing.grossAmount += lineTotal;
      }

      // Create financial records for each seller
      for (const [sellerId, data] of sellerTotals.entries()) {
        const commissionAmount = (data.grossAmount * data.commissionRate) / 100;

        // Record the gross sale
        await tx.sellerFinancialRecord.create({
          data: {
            sellerId,
            orderId: order.id,
            type: "SALE",
            amount: data.grossAmount,
            currency: "GHS",
            description: `Order #${order.id.slice(-8).toUpperCase()} - Gross sale`,
          },
        });

        // Record the platform commission
        await tx.sellerFinancialRecord.create({
          data: {
            sellerId,
            orderId: order.id,
            type: "FEE",
            amount: -commissionAmount,
            currency: "GHS",
            description: `Platform commission (${data.commissionRate}%)`,
          },
        });
      }
    }); // Removed Serializable isolation level, as updateMany handles concurrency natively

    // 7. Send Email Notifications (Fire and forget)
    const uniqueSellers = new Map<string, { email: string; name: string; items: any[] }>();

    for (const item of order.items) {
      const sellerId = item.variant.product.seller.id;
      const sellerUser = item.variant.product.seller.user;
      
      if (!uniqueSellers.has(sellerId)) {
        uniqueSellers.set(sellerId, { 
          email: sellerUser.email,
          name: `${sellerUser.firstName || ""} ${sellerUser.lastName || ""}`.trim() || "Seller",
          items: [] 
        });
      }
      uniqueSellers.get(sellerId)!.items.push({
        title: item.title,
        quantity: item.quantity,
        price: item.price.toNumber(),
      });
    }

    // Send customer confirmation
    await sendOrderConfirmationEmail({
      to: order.user.email,
      customerName: `${order.user.firstName || ""} ${order.user.lastName || ""}`.trim() || "Valued Customer",
      orderId: order.id,
      totalAmount: order.totalAmount.toNumber(),
      items: order.items.map((item) => ({
        title: item.title,
        quantity: item.quantity,
        price: item.price.toNumber(),
      })),
    });

    // Send seller notifications
    for (const [_, sellerData] of uniqueSellers.entries()) {
      await sendSellerNotificationEmail({
        to: sellerData.email,
        sellerName: sellerData.name,
        orderId: order.id,
        items: sellerData.items,
      });
    }

    console.log(`📧 Emails triggered for Order #${order.id.slice(-8).toUpperCase()}`);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      message: "Payment verified successfully",
    });
  } catch (error: any) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify payment" },
      { status: 500 }
    );
  }
}

// Helper function to verify with Paystack API
function verifyWithPaystack(reference: string): Promise<{ success: boolean; data?: any; error?: string }> {
  return new Promise((resolve) => {
    const options = {
      hostname: "api.paystack.co",
      port: 443,
      path: `/transaction/verify/${reference}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    };

    const request = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          if (json.status && json.data && json.data.status === "success") {
            resolve({ success: true, data: json.data });
          } else {
            resolve({ success: false, error: json.message || "Payment failed" });
          }
        } catch (e) {
          resolve({ success: false, error: "Invalid response from Paystack" });
        }
      });
    });

    request.on("error", (e) => resolve({ success: false, error: e.message }));
    request.end();
  });
}