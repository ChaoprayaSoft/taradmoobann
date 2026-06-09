import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await req.json();

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(session.user.email);
    
    await userRef.update({
      name: name.trim()
    });

    return NextResponse.json({ success: true, name: name.trim() });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
