import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";
import { decryptAddress } from "@/lib/encryption";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const shopId = url.searchParams.get("shopId");
    
    if (!shopId) {
      return NextResponse.json({ error: "Missing shopId" }, { status: 400 });
    }

    const shopRef = adminDb.collection("shops").doc(shopId);
    const shopDoc = await shopRef.get();
    
    if (!shopDoc.exists) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const shopData = shopDoc.data();
    
    // Decrypt the PromptPay ID
    const promptpayId = shopData?.promptpayId ? decryptAddress(shopData.promptpayId) : null;
    const promptpayName = shopData?.promptpayName || "";

    if (!promptpayId) {
      return NextResponse.json({ error: "No PromptPay configured for this shop" }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      promptpayId, 
      promptpayName 
    });
  } catch (error: any) {
    console.error("Failed to fetch shop promptpay:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
