import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: "Missing order ID" }, { status: 400 });
    }

    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const orderData = orderDoc.data();

    if (orderData?.shopperEmail !== session.user.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // A shopper can only complete an order if it's "Out for Delivery" (via QR scan) 
    // or "Pending Completion" (via explicit button accept).
    const allowedStatuses = ["Out for Delivery", "Pending Completion"];
    if (!allowedStatuses.includes(orderData?.status)) {
      return NextResponse.json({ error: "Order is not ready to be completed" }, { status: 400 });
    }

    await orderRef.update({
      status: "Completed",
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to complete order:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
