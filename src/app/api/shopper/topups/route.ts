import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";
import { sendNotificationToUser } from "@/lib/sendNotification";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { amountTHB, slipImageUrl } = await req.json();

    if (!amountTHB || typeof amountTHB !== "number" || amountTHB <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    
    if (!slipImageUrl || typeof slipImageUrl !== "string") {
      return NextResponse.json({ error: "Slip image is required" }, { status: 400 });
    }

    const topupRef = adminDb.collection("topups").doc();
    
    await topupRef.set({
      id: topupRef.id,
      userEmail: session.user.email,
      amountTHB: amountTHB,
      slipImageUrl: slipImageUrl,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    try {
      const adminsSnapshot = await adminDb.collection("users").where("roles", "array-contains", "admin").get();
      const notificationPromises = adminsSnapshot.docs.map(doc => {
        const adminEmail = doc.id;
        return sendNotificationToUser(
          adminEmail,
          "New Top-up Request",
          `User ${session.user?.email} has requested a top-up of ฿${amountTHB}. Please review it in the Admin Dashboard.`
        );
      });
      await Promise.all(notificationPromises);
    } catch (notifErr) {
      console.error("Failed to notify admins:", notifErr);
    }

    return NextResponse.json({ success: true, id: topupRef.id });

  } catch (error: any) {
    console.error("Error creating topup request:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
