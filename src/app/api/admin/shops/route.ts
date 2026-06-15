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

    const body = await req.json();
    const { id, operatingStatus, validDates, action } = body;

    if (!id) {
      return NextResponse.json({ error: "Shop ID is required" }, { status: 400 });
    }

    const shopRef = adminDb.collection("shops").doc(id);
    
    if (action === "toggleStatus") {
      const shopDoc = await shopRef.get();
      if (!shopDoc.exists) {
         return NextResponse.json({ error: "Shop not found" }, { status: 404 });
      }
      const currentStatus = shopDoc.data()?.status;
      const newStatus = currentStatus === "inactive" ? "approved" : "inactive";
      
      await shopRef.update({
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      return NextResponse.json({ success: true, status: newStatus });
    }

    await shopRef.update({
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

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const roles = (session?.user as any)?.roles || [];

    if (!session || !roles.includes("admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Shop ID is required" }, { status: 400 });
    }

    const shopRef = adminDb.collection("shops").doc(id);
    const shopDoc = await shopRef.get();

    if (!shopDoc.exists) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const batch = adminDb.batch();
    batch.delete(shopRef);

    // Delete all products for the shop
    const productsQuery = await adminDb.collection("products").where("shopId", "==", id).get();
    for (const productDoc of productsQuery.docs) {
      batch.delete(productDoc.ref);
    }

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting shop:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
