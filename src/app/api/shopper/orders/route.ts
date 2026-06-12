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
          const items = ordersByShop[shopId];
          const itemsList = items.map(i => `${i.quantity}x ${i.productName} (฿${i.price})`).join("<br/>");
          const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          
          const emailBody = `You have a new order from ${shopperName}.<br/><br/>
<strong>Delivery Address:</strong><br/>
${deliveryAddress}<br/><br/>
<strong>Items Ordered:</strong><br/>
${itemsList}<br/><br/>
<strong>Total Amount:</strong> ฿${totalAmount}`;

          await sendNotificationToUser(
            ownerEmail,
            "New Order Received!",
            emailBody,
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
