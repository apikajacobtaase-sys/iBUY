// src/app/api/categories/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Fetch all top-level categories and include their children
    const categories = await db.category.findMany({
      where: {
        parentId: null, // Only get top-level categories
        // isActive: true, // Uncomment if your schema has an isActive field
      },
      include: {
        children: {
          // isActive: true, // Uncomment if your schema has an isActive field
          orderBy: {
            name: "asc",
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("🚨 Fetch categories error:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}