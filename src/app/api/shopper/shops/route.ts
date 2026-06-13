import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";
import * as admin from "firebase-admin";
import { sendNotificationToUser } from "@/lib/sendNotification";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    // User must be logged in to create a shop
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, category, coverImage, marketId, houseNumber, location } = body;

    if (!name || !marketId || !category || !houseNumber || !location) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const email = session.user.email.toLowerCase().trim();

    // Verify the market exists
    const marketRef = adminDb.collection("markets").doc(marketId);
    const marketDoc = await marketRef.get();
    
    if (!marketDoc.exists) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    // Check user's current shops and max slots
    const userRef = adminDb.collection("users").doc(email);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const userData = userDoc.data();
    
    const shopsQuery = await adminDb.collection("shops").where("ownerEmail", "==", email).get();
    const shopsCount = shopsQuery.size;
    
    const maxShopSlots = userData?.maxShopSlots || 0;
    let cost = 0;
    
    if (shopsCount >= maxShopSlots) {
      cost = 20;
      const currentCoins = userData?.coins || 0;
      if (currentCoins < cost) {
        return NextResponse.json({ 
          error: `You have reached the maximum of ${maxShopSlots} shop slots. It costs 20 coins to unlock another shop slot. Insufficient coins.`, 
          code: "INSUFFICIENT_COINS" 
        }, { status: 400 });
      }
    }

    // Prepare batch
    const batch = adminDb.batch();

    // 1. Create the Shop in Firestore
    const shopRef = adminDb.collection("shops").doc();
    const shopId = shopRef.id;

    batch.set(shopRef, {
      id: shopId,
      marketId,
      name,
      description: description || "",
      category,
      coverImage: coverImage || "",
      houseNumber,
      location,
      ownerEmail: email,
      status: "approved",
      maxProductSlots: 1, // New shops start with 1 free product slot
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 2. Update user roles, coins, and maxShopSlots
    const updates: any = {};
    const currentRoles = userData?.roles || ["shopper"];
    if (!currentRoles.includes("shop_owner")) {
      currentRoles.push("shop_owner");
      updates.roles = currentRoles;
    }
    if (cost > 0) {
      updates.coins = admin.firestore.FieldValue.increment(-cost);
      updates.maxShopSlots = maxShopSlots + 1;
    }
    
    if (Object.keys(updates).length > 0) {
      batch.update(userRef, updates);
    }
    
    if (cost > 0) {
      const txRef = adminDb.collection("transactions").doc();
      batch.set(txRef, {
        id: txRef.id,
        userId: userDoc.id,
        userEmail: email,
        type: "shop_slot_fee",
        amount: -cost,
        description: `Fee for unlocking shop slot #${maxShopSlots + 1}`,
        relatedShopId: shopId,
        createdAt: new Date().toISOString(),
      });
    }

    await batch.commit();

    const marketData = marketDoc.data();
    if (marketData?.ownerEmail) {
      await sendNotificationToUser(
        marketData.ownerEmail,
        { key: "Notifications.newShopTitle" },
        { key: "Notifications.newShopBody", params: { ownerName: session.user.name || "A user", shopName: name } },
        { url: "/admin" }
      );
    }

    return NextResponse.json({ success: true, shopId, status: "approved" });
  } catch (error: any) {
    console.error("Failed to create self-service shop:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { shopId } = body;
    if (!shopId) return NextResponse.json({ error: "Missing shopId" }, { status: 400 });

    const shopRef = adminDb.collection("shops").doc(shopId);
    const shopDoc = await shopRef.get();
    
    if (!shopDoc.exists) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }
    
    if (shopDoc.data()?.ownerEmail !== session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (shopDoc.data()?.status === "approved") {
      return NextResponse.json({ error: "Cannot withdraw approved shops here" }, { status: 400 });
    }

    await shopRef.delete();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to withdraw shop request:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
