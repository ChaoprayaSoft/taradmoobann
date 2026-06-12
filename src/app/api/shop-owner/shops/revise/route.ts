import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";
import { sendNotificationToUser } from "@/lib/sendNotification";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const roles = (session?.user as any)?.roles || [];

    if (!session || (!roles.includes("shop_owner") && !roles.includes("admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { shopId, name, description, category, houseNumber, location, coverImage } = body;
    const userEmail = session?.user?.email;

    if (!shopId || !name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const shopRef = adminDb.collection("shops").doc(shopId);
    const shopDoc = await shopRef.get();

    if (!shopDoc.exists) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    if (shopDoc.data()?.ownerEmail !== userEmail && !roles.includes("admin")) {
      return NextResponse.json({ error: "You don't own this shop" }, { status: 403 });
    }

    const currentStatus = shopDoc.data()?.status;
    const isAlreadyApproved = currentStatus === "approved";

    // Update the shop
    const updateData: any = {
      name,
      description: description || "",
      updatedAt: new Date().toISOString(),
    };
    
    // If it's not approved (e.g. needs_revision), push it back to pending
    if (!isAlreadyApproved) {
      updateData.status = "pending";
    }

    if (category) updateData.category = category;
    if (houseNumber !== undefined) updateData.houseNumber = houseNumber;
    if (location !== undefined) updateData.location = location;
    if (coverImage !== undefined) updateData.coverImage = coverImage;

    await shopRef.update(updateData);

    // Notify Market Owner only if it's going back to pending
    if (!isAlreadyApproved) {
      const shopData = shopDoc.data();
      const marketId = shopData?.marketId;
      if (marketId) {
        const marketDoc = await adminDb.collection("markets").doc(marketId).get();
        const marketData = marketDoc.data();
        if (marketData?.ownerEmail) {
          await sendNotificationToUser(
            marketData.ownerEmail,
            { key: "Notifications.shopReviseTitle" },
            { key: "Notifications.shopReviseBody", params: { shopName: shopData?.name || "Your Shop" } },
            { url: "/admin" }
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to revise shop:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
