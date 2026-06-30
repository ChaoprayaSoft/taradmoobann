import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const roles = (session?.user as any)?.roles || [];

    if (!session || !roles.includes("market_owner")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, name, villageName, description, coverImage, operatingStatus, validDates } = await req.json();

    if (!id || !name || !villageName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify ownership
    const marketDoc = await adminDb.collection("markets").doc(id).get();
    if (!marketDoc.exists) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }
    const marketData = marketDoc.data();
    if (marketData?.ownerEmail !== session.user?.email && !roles.includes("admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updateData = {
      name,
      villageName,
      description: description || "",
      coverImage: coverImage || "",
      operatingStatus: operatingStatus || "always_open",
      validDates: validDates || "",
      updatedAt: new Date().toISOString()
    };

    await adminDb.collection("markets").doc(id).update(updateData);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating market:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
