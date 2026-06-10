import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const shopId = url.searchParams.get("shopId");
    const orderId = url.searchParams.get("orderId");

    let query: any = adminDb.collection("reviews");

    if (shopId) {
      query = query.where("shopId", "==", shopId);
    } else if (orderId) {
      query = query.where("orderId", "==", orderId).limit(1);
    } else {
      return NextResponse.json({ error: "Missing shopId or orderId" }, { status: 400 });
    }

    const snapshot = await query.get();
    const reviews = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    if (shopId) {
      reviews.sort((a: any, b: any) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
    }

    return NextResponse.json(reviews);
  } catch (error) {
    console.error("Error fetching public reviews:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
