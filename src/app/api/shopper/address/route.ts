import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { encryptAddress } from "@/lib/encryption";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { addresses } = await req.json();

    if (!Array.isArray(addresses) || addresses.length > 3) {
      return NextResponse.json({ error: "Invalid addresses format. Max 3 addresses allowed." }, { status: 400 });
    }

    const userEmail = session.user.email;

    // Save to users collection using the email as document ID
    await adminDb.collection("users").doc(userEmail).set({
      addresses: addresses.map(a => typeof a === "string" ? a.trim() : "").filter(a => a.length > 0).map(encryptAddress),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to save delivery address:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
