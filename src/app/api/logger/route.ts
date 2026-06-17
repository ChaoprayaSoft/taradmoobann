import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";
import * as admin from "firebase-admin";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const { action, details } = body;

    if (!action || !details) {
      return NextResponse.json({ error: "Missing action or details" }, { status: 400 });
    }

    const email = session?.user?.email || "anonymous";

    await adminDb.collection("activity_logs").add({
      userEmail: email,
      action: action,
      details: details,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to log activity:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
