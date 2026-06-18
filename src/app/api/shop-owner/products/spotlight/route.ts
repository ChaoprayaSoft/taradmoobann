import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;
    const roles = (session?.user as any)?.roles || [];

    if (!session || !userEmail || (!roles.includes("shop_owner") && !roles.includes("admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId, shopId, coins } = await req.json();

    if (!productId || !shopId) {
      return NextResponse.json({ error: "Missing productId or shopId" }, { status: 400 });
    }

    // Verify shop ownership
    const shopRef = adminDb.collection("shops").doc(shopId);
    const shopDoc = await shopRef.get();
    
    if (!shopDoc.exists) return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    const shopData = shopDoc.data();
    
    if (shopData?.ownerEmail !== userEmail && !roles.includes("admin")) {
      return NextResponse.json({ error: "You do not own this shop." }, { status: 403 });
    }

    // Get product
    const productRef = adminDb.collection("products").doc(productId);
    const productDoc = await productRef.get();
    
    if (!productDoc.exists || productDoc.data()?.shopId !== shopId) {
      return NextResponse.json({ error: "Product not found or access denied" }, { status: 404 });
    }

    // Verify user coins
    const usersSnapshot = await adminDb.collection("users").where("email", "==", userEmail).limit(1).get();
    if (usersSnapshot.empty) {
      return NextResponse.json({ error: "User not found in database" }, { status: 404 });
    }
    
    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    const currentCoins = userData.coins || 0;
    
    let COST = 2;
    let hours = 24;

    if (coins === 3) {
      COST = 3;
      hours = 40;
    } else if (coins === 5) {
      COST = 5;
      hours = 72;
    }

    if (currentCoins < COST) {
      return NextResponse.json({ error: "Insufficient coins", code: "INSUFFICIENT_COINS" }, { status: 400 });
    }

    // Set expiration based on hours
    let expiryDate = new Date();
    const productData = productDoc.data();
    if (productData?.isSpotlight && productData?.spotlightExpiry) {
      const currentExpiry = new Date(productData.spotlightExpiry);
      if (currentExpiry > expiryDate) {
        expiryDate = currentExpiry;
      }
    }
    expiryDate.setHours(expiryDate.getHours() + hours);

    // Batch write to deduct coins, add transaction, update product
    const batch = adminDb.batch();

    // 1. Deduct coins
    batch.update(userDoc.ref, {
      coins: FieldValue.increment(-COST)
    });

    // 2. Add transaction
    const txRef = adminDb.collection("transactions").doc();
    batch.set(txRef, {
      id: txRef.id,
      userId: userDoc.id,
      userEmail: userEmail,
      type: "spotlight_fee",
      amount: -COST,
      description: `Spotlight promotion fee for product: ${productDoc.data()?.name}`,
      relatedProductId: productId,
      createdAt: new Date().toISOString(),
    });

    // 3. Update product
    batch.update(productRef, {
      isSpotlight: true,
      spotlightExpiry: expiryDate.toISOString(),
      updatedAt: new Date().toISOString()
    });

    await batch.commit();

    return NextResponse.json({ success: true, newCoinBalance: currentCoins - COST, expiry: expiryDate.toISOString() });
  } catch (error: any) {
    console.error("Failed to promote product to spotlight:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
