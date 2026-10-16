import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Auto-create seller profile if it doesn't exist (using CORRECT schema fields)
    let sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!sellerProfile) {
      sellerProfile = await db.sellerProfile.create({
        data: {
          userId: session.user.id,
          businessName: session.user.name || "My Store",
          isActive: true, // 👈 Use isActive instead of status
        },
      });
    }

    // 2. Fetch records safely
    const records = await db.sellerFinancialRecord.findMany({
      where: { sellerId: sellerProfile.id },
      select: { id: true, amount: true, type: true, description: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // 3. Fetch pending payouts safely
    const pendingPayouts = await db.payout.findMany({
      where: { 
        sellerId: sellerProfile.id,
        status: "PENDING"
      },
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    let grossSales = 0;
    let commissions = 0;
    let netBalance = 0;
    let totalPaidOut = 0;

    for (const record of records) {
      const amount = record.amount ? record.amount.toNumber() : 0;
      netBalance += amount;
      
      if (record.type === "SALE") {
        grossSales += amount;
      } else if (record.type === "FEE") {
        commissions += Math.abs(amount);
      } else if (record.type === "PAYOUT") {
        totalPaidOut += Math.abs(amount);
      }
    }

    const commissionRate = sellerProfile.commissionRate 
      ? sellerProfile.commissionRate.toNumber() 
      : 0;

    return NextResponse.json({
      grossSales: Math.round(grossSales * 100) / 100,
      marketplaceFees: Math.round(commissions * 100) / 100,
      netBalance: Math.round(netBalance * 100) / 100,
      netEarnings: Math.round(netBalance * 100) / 100,
      availableBalance: Math.round(netBalance * 100) / 100,
      totalEarnings: Math.round(netBalance * 100) / 100,
      totalPaidOut: Math.round(totalPaidOut * 100) / 100,
      pendingPayouts: pendingPayouts.map((p) => ({
        id: p.id,
        amount: p.amount ? p.amount.toNumber() : 0,
        paymentMethod: p.paymentMethod,
        createdAt: p.createdAt,
      })),
      currency: "GHS",
      records: records.map((r) => ({
        id: r.id,
        type: r.type,
        amount: r.amount ? r.amount.toNumber() : 0,
        description: r.description,
        createdAt: r.createdAt,
      })),
      recentTransactions: records.map((r) => ({
        id: r.id,
        type: r.type,
        amount: r.amount ? r.amount.toNumber() : 0,
        description: r.description,
        createdAt: r.createdAt,
      })),
      commissionRate,
    });
  } catch (error) {
    console.error("🚨 Fetch seller finances error:", error);
    return NextResponse.json({ error: "Failed to fetch finances" }, { status: 500 });
  }
}

const PayoutRequestSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  paymentMethod: z.enum(["BANK_TRANSFER", "MOBILE_MONEY"]),
  paymentDetails: z.object({
    accountName: z.string().min(2),
    accountNumber: z.string().min(5),
    bankName: z.string().min(2).optional(),
    network: z.string().min(2).optional(),
  }),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Auto-create seller profile if it doesn't exist (using CORRECT schema fields)
    let sellerProfile = await db.sellerProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!sellerProfile) {
      sellerProfile = await db.sellerProfile.create({
        data: {
          userId: session.user.id,
          businessName: session.user.name || "My Store",
          isActive: true, // 👈 Use isActive instead of status
        },
      });
    }

    const body = await req.json();
    const parseResult = PayoutRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { amount, paymentMethod, paymentDetails } = parseResult.data;

    const records = await db.sellerFinancialRecord.findMany({
      where: { sellerId: sellerProfile.id },
      select: { amount: true, id: true },
    });

    const balance = records.reduce((sum, record) => sum + (record.amount ? record.amount.toNumber() : 0), 0);

    if (amount > balance) {
      return NextResponse.json(
        { error: "Insufficient balance. Available: GHS " + balance.toFixed(2) },
        { status: 400 }
      );
    }

    const payout = await db.payout.create({
      data: {
        sellerId: sellerProfile.id,
        amount,
        currency: "GHS",
        status: "PENDING",
        paymentMethod,
        paymentDetails: paymentDetails as any,
      },
    });

    return NextResponse.json({ success: true, payoutId: payout.id }, { status: 201 });
  } catch (error: any) {
    console.error("🚨 Payout request error:", error);
    return NextResponse.json({ error: error.message || "Failed to request payout" }, { status: 500 });
  }
}