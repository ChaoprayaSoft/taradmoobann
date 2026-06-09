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

    const { orderId, shopId, rating, comment } = await req.json();

    if (!orderId || !shopId || !rating) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify order exists and belongs to the shopper
    const orderDoc = await adminDb.collection("orders").doc(orderId).get();
    if (!orderDoc.exists) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const orderData = orderDoc.data();
    if (orderData?.shopperEmail !== session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if review already exists for this order
    const existingReviewQuery = await adminDb.collection("reviews")
      .where("orderId", "==", orderId)
      .limit(1)
      .get();

    if (!existingReviewQuery.empty) {
      return NextResponse.json({ error: "Review already exists for this order" }, { status: 400 });
    }

    // Create review
    const reviewData = {
      orderId,
      shopId,
      shopperEmail: session.user.email,
      rating: Number(rating),
      comment: comment || "",
      ownerReply: "",
      createdAt: new Date().toISOString()
    };

    const docRef = await adminDb.collection("reviews").add(reviewData);

    // Update Shop Average Rating
    const shopRef = adminDb.collection("shops").doc(shopId);
    const shopDocToUpdate = await shopRef.get();
    if (shopDocToUpdate.exists) {
      const shopDataToUpdate = shopDocToUpdate.data();
      const currentRating = shopDataToUpdate?.averageRating || 0;
      const currentCount = shopDataToUpdate?.reviewCount || 0;
      
      const newCount = currentCount + 1;
      const newRating = ((currentRating * currentCount) + Number(rating)) / newCount;
      
      await shopRef.update({
        averageRating: newRating,
        reviewCount: newCount
      });
    }

    return NextResponse.json({ id: docRef.id, ...reviewData });
  } catch (error) {
    console.error("Error submitting review:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
