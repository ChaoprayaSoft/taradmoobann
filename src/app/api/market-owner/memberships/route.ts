import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";
import { sendNotificationToUser } from "@/lib/sendNotification";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const roles = (session?.user as any)?.roles || [];
    
    // User must be logged in and have market_owner or admin role
    if (!session || (!roles.includes("market_owner") && !roles.includes("admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { membershipId, action, feedback } = body; // action = "approve" or "request_revision"

    if (!membershipId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const membershipRef = adminDb.collection("market_memberships").doc(membershipId);
    const membershipDoc = await membershipRef.get();

    if (!membershipDoc.exists) {
      return NextResponse.json({ error: "Membership request not found" }, { status: 404 });
    }

    const membershipData = membershipDoc.data();

    // Ensure the current user is the owner of the market (or an admin)
    const marketRef = adminDb.collection("markets").doc(membershipData?.marketId);
    const marketDoc = await marketRef.get();
    
    if (marketDoc.exists && marketDoc.data()?.ownerEmail !== session.user?.email && !roles.includes("admin")) {
      return NextResponse.json({ error: "You do not own the market for this request." }, { status: 403 });
    }

    if (action === "approve") {
      await membershipRef.update({
        status: "approved",
        feedback: feedback || "",
        updatedAt: new Date().toISOString()
      });
      if (membershipData?.userEmail) {
        await sendNotificationToUser(
          membershipData.userEmail,
          "Market Membership Approved",
          `Your request to join the market has been approved!`,
          { url: "/shopper" }
        );
      }
      return NextResponse.json({ success: true, status: "approved" });
    } else if (action === "request_revision") {
      await membershipRef.update({
        status: "needs_revision",
        feedback: feedback || "",
        updatedAt: new Date().toISOString()
      });
      if (membershipData?.userEmail) {
        await sendNotificationToUser(
          membershipData.userEmail,
          "Action Required: Membership Request",
          `The market owner has requested a revision to your membership request. Feedback: ${feedback || "Please provide more details."}`,
          { url: "/shopper" }
        );
      }
      return NextResponse.json({ success: true, status: "needs_revision" });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

  } catch (error: any) {
    console.error("Failed to update membership:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
