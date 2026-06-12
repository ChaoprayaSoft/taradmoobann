import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rating, comment } = await req.json();

    if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
    }

    if (!comment || typeof comment !== "string" || comment.trim() === "") {
      return NextResponse.json({ error: "Comment is required" }, { status: 400 });
    }

    const newFeedback = {
      userEmail: session.user.email,
      rating,
      comment: comment.trim(),
      createdAt: new Date().toISOString()
    };

    const docRef = await adminDb.collection("app_feedback").add(newFeedback);

    return NextResponse.json({ id: docRef.id, ...newFeedback });
  } catch (error: any) {
    console.error("Failed to submit feedback:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
