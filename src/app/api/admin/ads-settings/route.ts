import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

export const dynamic = 'force-dynamic';

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const roles = (session?.user as any)?.roles || [];
    if (!session || !roles.includes("admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { maxAds, carouselSpeed } = await req.json();

    const settingsRef = adminDb.collection("settings").doc("ads");
    await settingsRef.set({
      maxAds: typeof maxAds === "number" ? maxAds : 3,
      carouselSpeed: typeof carouselSpeed === "number" ? carouselSpeed : 5,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating ads settings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
