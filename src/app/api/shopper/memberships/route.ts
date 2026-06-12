import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";
import { sendNotificationToUser } from "@/lib/sendNotification";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { marketId, applicationNote } = body;
    const userEmail = session.user.email;

    if (!marketId) {
      return NextResponse.json({ error: "Market ID is required" }, { status: 400 });
    }

    // Verify the market exists
    const marketRef = adminDb.collection("markets").doc(marketId);
    const marketDoc = await marketRef.get();
    
    if (!marketDoc.exists) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }
    const marketData = marketDoc.data();

    // Check if membership already exists
    const membershipQuery = await adminDb
      .collection("market_memberships")
      .where("userEmail", "==", userEmail)
      .where("marketId", "==", marketId)
      .limit(1)
      .get();

    if (!membershipQuery.empty) {
      const doc = membershipQuery.docs[0];
      const data = doc.data();
      
      // If it exists and is 'needs_revision', we update it back to pending
      if (data.status === "needs_revision") {
        await doc.ref.update({
          applicationNote: applicationNote || "",
          status: "pending",
          updatedAt: new Date().toISOString()
        });

        if (marketData?.ownerEmail) {
          await sendNotificationToUser(
            marketData.ownerEmail,
            { key: "Notifications.newMemberTitle" },
            { key: "Notifications.newMemberBody", params: { userName: userEmail, marketName: marketData.name || "Unknown" } },
            { url: "/admin" }
          );
        }

        return NextResponse.json({ success: true, status: "resubmitted" });
      }
      
      return NextResponse.json({ error: "You have already requested to join this market." }, { status: 400 });
    }

    // Create new membership request
    const membershipRef = adminDb.collection("market_memberships").doc();
    await membershipRef.set({
      id: membershipRef.id,
      marketId,
      userEmail,
      applicationNote: applicationNote || "",
      status: "pending", // pending, approved, needs_revision
      feedback: "", // Market owner can leave feedback here
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (marketData?.ownerEmail) {
      await sendNotificationToUser(
        marketData.ownerEmail,
        { key: "Notifications.newMemberTitle" },
        { key: "Notifications.newMemberBody", params: { userName: userEmail, marketName: marketData.name || "Unknown" } },
        { url: "/admin" }
      );
    }

    return NextResponse.json({ success: true, id: membershipRef.id });
  } catch (error: any) {
    console.error("Failed to submit membership:", error);
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
    const { membershipId } = body;
    if (!membershipId) return NextResponse.json({ error: "Missing membershipId" }, { status: 400 });

    const memRef = adminDb.collection("market_memberships").doc(membershipId);
    const memDoc = await memRef.get();
    
    if (!memDoc.exists) {
      return NextResponse.json({ error: "Membership request not found" }, { status: 404 });
    }
    
    if (memDoc.data()?.userEmail !== session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (memDoc.data()?.status === "approved") {
      return NextResponse.json({ error: "Cannot withdraw approved memberships here" }, { status: 400 });
    }

    await memRef.delete();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to withdraw membership request:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
