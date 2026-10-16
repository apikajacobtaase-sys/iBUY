// src/app/api/checkout/validate-discount/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { code, orderTotal, sellerIds } = await req.json(); // sellerIds is an array of seller IDs in the cart

    if (!code || !orderTotal) {
      return NextResponse.json({ error: "Code and order total are required" }, { status: 400 });
    }

    const discount = await db.discountCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!discount) {
      return NextResponse.json({ error: "Invalid discount code" }, { status: 404 });
    }

    if (!discount.isActive) {
      return NextResponse.json({ error: "This discount code is no longer active" }, { status: 400 });
    }

    if (discount.expiresAt && discount.expiresAt < new Date()) {
      return NextResponse.json({ error: "This discount code has expired" }, { status: 400 });
    }

    if (discount.usageLimit && discount.usedCount >= discount.usageLimit) {
      return NextResponse.json({ error: "This discount code has reached its usage limit" }, { status: 400 });
    }

    if (discount.minOrderAmount && orderTotal < Number(discount.minOrderAmount)) {
      return NextResponse.json({ 
        error: `Minimum order amount of GH₵ ${Number(discount.minOrderAmount).toFixed(2)} required` 
      }, { status: 400 });
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (discount.type === "PERCENTAGE") {
      discountAmount = orderTotal * (Number(discount.value) / 100);
      if (discount.maxDiscount && discountAmount > Number(discount.maxDiscount)) {
        discountAmount = Number(discount.maxDiscount);
      }
    } else {
      discountAmount = Number(discount.value);
    }

    // Ensure discount doesn't exceed order total
    if (discountAmount > orderTotal) {
      discountAmount = orderTotal;
    }

    const newTotal = orderTotal - discountAmount;

    return NextResponse.json({
      valid: true,
      discountId: discount.id,
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      newTotal: parseFloat(newTotal.toFixed(2)),
      code: discount.code,
      type: discount.type,
      value: Number(discount.value),
    });
  } catch (error: any) {
    console.error("🚨 Validate discount error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}