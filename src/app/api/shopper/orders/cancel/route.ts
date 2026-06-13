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

    const { orderId, reason } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const orderData = orderDoc.data();

    // Verify ownership
    if (orderData?.shopperEmail !== session.user.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const currentStatus = orderData?.status;
    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    let notificationKey = "";
    let notificationBodyKey = "";

    if (currentStatus === "Pending") {
      updateData.status = "Cancelled";
      notificationKey = "Notifications.orderCancelledTitle";
      notificationBodyKey = "Notifications.orderCancelledBody";
    } else if (currentStatus === "Preparing") {
      updateData.status = "Cancel Requested";
      updateData.cancelReason = reason || "";
      notificationKey = "Notifications.cancelRequestedTitle";
      notificationBodyKey = "Notifications.cancelRequestedBody";
    } else {
      return NextResponse.json({ error: "Cannot cancel order in its current status" }, { status: 400 });
    }

    await orderRef.update(updateData);

    // Notify shop owner
    if (orderData?.shopId) {
      const shopDoc = await adminDb.collection("shops").doc(orderData.shopId).get();
      if (shopDoc.exists) {
        const ownerEmail = shopDoc.data()?.ownerEmail;
        if (ownerEmail) {
          const shopperName = orderData.shopperName || "A shopper";
          await sendNotificationToUser(
            ownerEmail,
            { key: notificationKey },
            { 
              key: notificationBodyKey, 
              params: { shopperName, orderId: orderId.substring(0, 8) } 
            },
            { url: "/shop-owner" }
          );
        }
      }
    }

    return NextResponse.json({ success: true, status: updateData.status });
  } catch (error: any) {
    console.error("Failed to cancel order:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
