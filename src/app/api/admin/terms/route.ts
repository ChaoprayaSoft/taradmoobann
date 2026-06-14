import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const roles = (session?.user as any)?.roles || [];
    if (!session || !roles.includes("admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { content, content_th } = await req.json();

    if (typeof content !== "string" || (content_th !== undefined && typeof content_th !== "string")) {
      return NextResponse.json({ error: "Invalid content" }, { status: 400 });
    }

    await adminDb.collection("settings").doc("terms_of_use").set(
      { 
        content, 
        ...(content_th !== undefined && { content_th }),
        updatedAt: new Date().toISOString() 
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving terms of use:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
