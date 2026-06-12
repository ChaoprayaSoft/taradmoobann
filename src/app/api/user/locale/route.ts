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

    const { locale } = await req.json();
    if (!locale) {
      return NextResponse.json({ error: "Missing locale" }, { status: 400 });
    }

    await adminDb.collection("users").doc(session.user.email).set(
      { locale },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to update user locale:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
