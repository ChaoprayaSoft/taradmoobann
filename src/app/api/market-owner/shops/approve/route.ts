import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";
import { sendNotificationToUser } from "@/lib/sendNotification";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const roles = (session?.user as any)?.roles || [];
    
    // Allow market_owner OR admin
    if (!session || (!roles.includes("market_owner") && !roles.includes("admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { shopId, action = "approve", feedback = "" } = body;

    if (!shopId) {
      return NextResponse.json({ error: "Missing shopId" }, { status: 400 });
    }

    const shopRef = adminDb.collection("shops").doc(shopId);
    const shopDoc = await shopRef.get();
    
    if (!shopDoc.exists) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const shopData = shopDoc.data();
    const marketId = shopData?.marketId;

    // Verify the user actually owns the market this shop is in
    const marketRef = adminDb.collection("markets").doc(marketId);
    const marketDoc = await marketRef.get();
    
    if (!marketDoc.exists) {
      return NextResponse.json({ error: "Associated Market not found" }, { status: 404 });
    }
    
    if (marketDoc.data()?.ownerEmail !== session.user?.email && !roles.includes("admin")) {
      return NextResponse.json({ error: "You do not own the market this shop is in." }, { status: 403 });
    }

    if (action === "approve") {
      await shopRef.update({
        status: "approved",
        feedback: feedback || "",
        updatedAt: new Date().toISOString(),
      });
      if (shopData?.ownerEmail) {
        await sendNotificationToUser(
          shopData.ownerEmail,
          "Shop Approved!",
          `Your shop "${shopData.name || 'Unknown'}" has been approved. You can now manage it from your Shop Owner dashboard.`,
          { url: "/shop-owner" }
        );
      }
    } else if (action === "request_revision") {
      await shopRef.update({
        status: "needs_revision",
        feedback: feedback || "",
        updatedAt: new Date().toISOString(),
      });
      if (shopData?.ownerEmail) {
        await sendNotificationToUser(
          shopData.ownerEmail,
          "Action Required: Shop Request",
          `The market owner has requested a revision for your shop "${shopData.name || 'Unknown'}". Feedback: ${feedback || "Please check your shop details."}`,
          { url: "/shop-owner" }
        );
      }
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to update shop status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
