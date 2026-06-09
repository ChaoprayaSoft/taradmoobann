import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const roles = (session?.user as any)?.roles || [];
    if (!session || !roles.includes("admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, description, imageUrl, linkUrl, status, validUntil, placement } = await req.json();

    const adRef = adminDb.collection("ads").doc();
    const newAd = {
      id: adRef.id,
      title,
      description,
      imageUrl,
      linkUrl,
      status, // "ON" or "OFF"
      placement: placement || "Main Page", // "Main Page" | "Market Page"
      validUntil, // YYYY-MM-DD
      createdAt: new Date().toISOString()
    };

    await adRef.set(newAd);
    return NextResponse.json(newAd);
  } catch (error: any) {
    console.error("Error creating ad:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const roles = (session?.user as any)?.roles || [];
    if (!session || !roles.includes("admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, title, description, imageUrl, linkUrl, status, validUntil, placement } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Ad ID required" }, { status: 400 });
    }

    const adRef = adminDb.collection("ads").doc(id);
    await adRef.update({
      title,
      description,
      imageUrl,
      linkUrl,
      status,
      placement: placement || "Main Page",
      validUntil,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating ad:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const roles = (session?.user as any)?.roles || [];
    if (!session || !roles.includes("admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Ad ID required" }, { status: 400 });
    }

    await adminDb.collection("ads").doc(id).delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting ad:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
