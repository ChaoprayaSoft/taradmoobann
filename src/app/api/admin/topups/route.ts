import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { sendNotificationToUser } from "@/lib/sendNotification";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email || !(session.user as any)?.roles?.includes("admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, action, reason } = await req.json();

    if (!id || !action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const topupRef = adminDb.collection("topups").doc(id);
    const topupDoc = await topupRef.get();

    if (!topupDoc.exists) {
      return NextResponse.json({ error: "Top-up request not found" }, { status: 404 });
    }

    const topupData = topupDoc.data()!;
    
    if (topupData.status !== "pending") {
      return NextResponse.json({ error: "Top-up is already processed" }, { status: 400 });
    }

    if (action === "approve") {
      // 1. Update status
      await topupRef.update({
        status: "approved",
        updatedAt: new Date().toISOString(),
        approvedBy: session.user.email
      });

      // 2. Increment user coins
      const userRef = adminDb.collection("users").doc(topupData.userEmail);
      await userRef.update({
        coins: FieldValue.increment(topupData.amountTHB)
      });
      
      // Optional: Send success email/push
      await sendNotificationToUser(
        topupData.userEmail,
        "Top-up Successful!",
        `Your top-up of ฿${topupData.amountTHB} has been approved and coins have been added to your wallet.`
      );

    } else if (action === "reject") {
      if (!reason) {
        return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
      }

      await topupRef.update({
        status: "rejected",
        rejectionReason: reason,
        updatedAt: new Date().toISOString(),
        rejectedBy: session.user.email
      });

      // Send rejection email
      await sendNotificationToUser(
        topupData.userEmail,
        "Top-up Request Rejected",
        `Your top-up request for ฿${topupData.amountTHB} has been rejected. Reason: ${reason}. Please contact support if you need further assistance.`
      );
    }

    const updatedDoc = await topupRef.get();
    return NextResponse.json({ success: true, topup: updatedDoc.data() });

  } catch (error: any) {
    console.error("Error processing topup:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
