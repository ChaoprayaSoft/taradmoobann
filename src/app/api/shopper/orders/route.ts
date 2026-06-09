import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { sendNotificationToUser } from "@/lib/sendNotification";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { cartItems, deliveryAddress } = await req.json();

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    if (!deliveryAddress || typeof deliveryAddress !== "string") {
      return NextResponse.json({ error: "Invalid delivery address" }, { status: 400 });
    }

    const shopperEmail = session.user.email;
    const shopperName = session.user.name || "Unknown Shopper";

    // Group items by shopId
    const ordersByShop: Record<string, any[]> = {};
    for (const item of cartItems) {
      const shopId = item.product.shopId;
      if (!shopId) continue;
      
      if (!ordersByShop[shopId]) {
        ordersByShop[shopId] = [];
      }
      ordersByShop[shopId].push({
        productId: item.product.id,
        productName: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        selectedOptions: item.selectedOptions || {},
        note: item.note || "",
        imageUrl: (item.product.imageUrls && item.product.imageUrls.length > 0) ? item.product.imageUrls[0] : null
      });
    }

    // Create a batch
    const batch = adminDb.batch();

    const timestamp = new Date().toISOString();

    // Create an order for each shop
    for (const [shopId, items] of Object.entries(ordersByShop)) {
      // Calculate total
      const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Create new document ref
      const orderRef = adminDb.collection("orders").doc();
      
      batch.set(orderRef, {
        id: orderRef.id,
        shopId,
        shopperEmail,
        shopperName,
        deliveryAddress,
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
          await sendNotificationToUser(
            ownerEmail,
            "New Order Received!",
            `You have a new order from ${shopperName}.`,
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
