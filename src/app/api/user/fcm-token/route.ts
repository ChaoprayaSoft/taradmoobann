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

    const { token } = await req.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(session.user.email);
    
    await userRef.update({
      fcmToken: token,
      fcmTokenUpdatedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving FCM token:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
