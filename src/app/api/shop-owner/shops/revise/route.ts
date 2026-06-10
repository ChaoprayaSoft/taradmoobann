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

    // Update the shop and push it back to pending status
    const updateData: any = {
      name,
      description: description || "",
      status: "pending",
      updatedAt: new Date().toISOString(),
    };
    if (category) updateData.category = category;
    if (houseNumber !== undefined) updateData.houseNumber = houseNumber;
    if (location !== undefined) updateData.location = location;
    if (coverImage !== undefined) updateData.coverImage = coverImage;

    await shopRef.update(updateData);

    // Notify Market Owner
    const marketId = shopDoc.data()?.marketId;
    if (marketId) {
      const marketDoc = await adminDb.collection("markets").doc(marketId).get();
      const marketData = marketDoc.data();
      if (marketData?.ownerEmail) {
        await sendNotificationToUser(
          marketData.ownerEmail,
          "Shop Resubmitted",
          `The shop "${name}" has been revised and resubmitted for your review in market "${marketData.name || 'Unknown'}".`,
          { url: "/market-owner" }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to revise shop:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
