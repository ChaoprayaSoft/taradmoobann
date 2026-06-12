import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { sendNotificationToUser } from "@/lib/sendNotification";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId, status } = await req.json();

    if (!orderId || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const orderData = orderDoc.data();

    // Verify ownership: user must own the shop this order belongs to
    const shopRef = adminDb.collection("shops").doc(orderData?.shopId);
    const shopDoc = await shopRef.get();

    if (!shopDoc.exists || shopDoc.data()?.ownerEmail !== session.user.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Allowed statuses from Shop Owner: "Preparing", "Out for Delivery", "Pending Completion"
    const allowedStatuses = ["Preparing", "Out for Delivery", "Pending Completion"];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status update from shop owner" }, { status: 400 });
    }

    const updateData: any = {
      status,
      updatedAt: new Date().toISOString()
    };

    // If moving to Out for Delivery, we could optionally generate a QR code token here, 
    // or just use the orderId itself as the payload to be scanned.
    if (status === "Out for Delivery") {
      updateData.deliveryToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    await orderRef.update(updateData);

    // Notify shopper
    if (orderData?.shopperEmail) {
      const shopName = shopDoc.data()?.name || "Your Shop";
      await sendNotificationToUser(
        orderData.shopperEmail,
        { key: "Notifications.orderUpdateTitle" },
        { key: "Notifications.orderUpdateBody", params: { shopName, status } },
        { url: "/shopper" }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to update order status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
