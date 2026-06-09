import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const roles = (session?.user as any)?.roles || [];

    if (!session || !roles.includes("admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, operatingStatus, validDates } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Shop ID is required" }, { status: 400 });
    }

    await adminDb.collection("shops").doc(id).update({
      operatingStatus: operatingStatus || "always_open",
      validDates: validDates || "",
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating shop status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
