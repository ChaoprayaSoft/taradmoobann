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

    const { reviewId, replyText } = await req.json();

    if (!reviewId || !replyText) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const reviewDoc = await adminDb.collection("reviews").doc(reviewId).get();
    if (!reviewDoc.exists) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const reviewData = reviewDoc.data();
    
    // Verify shop ownership
    const shopDoc = await adminDb.collection("shops").doc(reviewData?.shopId).get();
    if (!shopDoc.exists || shopDoc.data()?.ownerEmail !== session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Update review with reply
    await reviewDoc.ref.update({
      ownerReply: replyText,
      repliedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error replying to review:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
