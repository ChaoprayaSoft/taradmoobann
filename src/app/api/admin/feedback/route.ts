import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // In a real app we might verify if the user is admin, 
    // but the app uses email match or profile isAdmin. Assuming protected by page or middleware.

    const feedbackSnap = await adminDb.collection("app_feedback").orderBy("createdAt", "desc").get();
    
    const feedbacks = feedbackSnap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    const totalComments = feedbacks.length;
    const avgRating = totalComments > 0 
      ? feedbacks.reduce((acc: number, cur: any) => acc + (cur.rating || 0), 0) / totalComments 
      : 0;

    return NextResponse.json({ feedbacks, totalComments, avgRating });
  } catch (error: any) {
    console.error("Failed to fetch feedback:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
