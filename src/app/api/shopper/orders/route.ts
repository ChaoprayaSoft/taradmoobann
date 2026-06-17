import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { encryptAddress } from "@/lib/encryption";
import { sendNotificationToUser } from "@/lib/sendNotification";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { cartItems, deliveryAddress, rawDeliveryAddress } = await req.json();

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    if (!deliveryAddress || typeof deliveryAddress !== "string") {
      return NextResponse.json({ error: "Invalid delivery address" }, { status: 400 });
    }

    const shopperEmail = session.user.email;
    const shopperName = session.user.name || "Unknown Shopper";

    // Extract user's villageName from raw address
    let userVillageName = "";
    if (rawDeliveryAddress) {
      try {
        const parsedAddr = JSON.parse(rawDeliveryAddress);
        userVillageName = parsedAddr.villageName || "";
      } catch (e) {}
    }

    // Pre-flight check: Verify that the shopper's village matches all markets involved in the cart
    const shopIds = Array.from(new Set(cartItems.map((item: any) => item.product.shopId).filter(Boolean)));
    const marketsToVerify = Array.from(new Set<string>());

    for (const shopId of shopIds) {
      const shopDoc = await adminDb.collection("shops").doc(shopId as string).get();
      if (!shopDoc.exists) continue;
      
      const shopData = shopDoc.data();
      if (shopData?.marketId && !marketsToVerify.includes(shopData.marketId)) {
        marketsToVerify.push(shopData.marketId);
      }
    }

    for (const marketId of marketsToVerify) {
      const marketDoc = await adminDb.collection("markets").doc(marketId).get();
      if (marketDoc.exists) {
        const marketData = marketDoc.data();
        if (marketData?.villageName && userVillageName && marketData.villageName !== userVillageName) {
          return NextResponse.json({ error: "cross_village_error" }, { status: 400 });
        }
      }
    }

    // Group items by shopId and validate prices against the database
    const ordersByShop: Record<string, any[]> = {};
    for (const item of cartItems) {
      const shopId = item.product.shopId;
      if (!shopId || !item.product.id) continue;
      
      // CRITICAL FIX: Never trust the price sent by the client. Fetch authoritative price from DB.
      const productDoc = await adminDb.collection("products").doc(item.product.id).get();
      if (!productDoc.exists) continue; // Skip if product doesn't exist anymore
      
      const realProduct = productDoc.data();
      const realPrice = realProduct?.price || 0;

      if (!ordersByShop[shopId]) {
        ordersByShop[shopId] = [];
      }
      ordersByShop[shopId].push({
        productId: item.product.id,
        productName: realProduct?.name || item.product.name,
        price: realPrice, // Authoritative price from DB
        quantity: Math.max(1, item.quantity), // Prevent negative or zero quantities
        selectedOptions: item.selectedOptions || {},
        note: item.note || "",
        imageUrl: (realProduct?.imageUrls && realProduct?.imageUrls.length > 0) ? realProduct?.imageUrls[0] : null
      });
    }

    // Create a batch
    const batch = adminDb.batch();

    const timestamp = new Date().toISOString();

    // Create an order for each shop
    for (const [shopId, items] of Object.entries(ordersByShop)) {
      // Calculate total
      const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      const shopDoc = await adminDb.collection("shops").doc(shopId).get();
      const shopName = shopDoc.exists ? (shopDoc.data()?.name || "Unknown Shop") : "Unknown Shop";

      // Create new document ref
      const orderRef = adminDb.collection("orders").doc();
      
      batch.set(orderRef, {
        id: orderRef.id,
        shopId,
        shopName,
        shopperEmail,
        shopperName,
        deliveryAddress: encryptAddress(deliveryAddress),
        items,
        totalAmount,
        status: "Pending", // Statuses: Pending, Preparing, Out for Delivery, Completed
        qrCodeUrl: null, // Used for delivery confirmation Option 1
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }

    await batch.commit();

    // Send notifications to shop owners
    for (const shopId of Object.keys(ordersByShop)) {
      const shopDoc = await adminDb.collection("shops").doc(shopId).get();
      if (shopDoc.exists) {
        const ownerEmail = shopDoc.data()?.ownerEmail;
        if (ownerEmail) {
          const items = ordersByShop[shopId];
          const itemsList = items.map(i => `${i.quantity}x ${i.productName} (฿${i.price})`).join("<br/>");
          const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          
          await sendNotificationToUser(
            ownerEmail,
            { key: "Notifications.newOrderTitle" },
            { 
              key: "Notifications.newOrderBody", 
              params: { shopperName, deliveryAddress, itemsList, totalAmount } 
            },
            { url: "/shop-owner" }
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to create order:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
