import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const roles = (session?.user as any)?.roles || [];
    
    // Must be shop_owner or admin
    if (!session || (!roles.includes("shop_owner") && !roles.includes("admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const shopId = url.searchParams.get("shopId");
    
    if (!shopId) {
      return NextResponse.json({ error: "Missing shopId" }, { status: 400 });
    }

    const shopRef = adminDb.collection("shops").doc(shopId);
    const shopDoc = await shopRef.get();
    
    if (!shopDoc.exists) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const shopData = shopDoc.data();
    
    // Verify ownership
    if (shopData?.ownerEmail !== session.user?.email && !roles.includes("admin")) {
      return NextResponse.json({ error: "You do not own this shop." }, { status: 403 });
    }

    // Step 1: Find all products associated with this shop
    const productsSnapshot = await adminDb.collection("products").where("shopId", "==", shopId).get();
    
    const batch = adminDb.batch();
    
    // Step 2: Add product deletions to batch
    productsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    // Step 3: Add shop deletion to batch
    batch.delete(shopRef);

    // Step 4: Execute the batch delete
    await batch.commit();

    return NextResponse.json({ success: true, message: "Shop and products deleted successfully." });
  } catch (error: any) {
    console.error("Failed to delete shop:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const roles = (session?.user as any)?.roles || [];
    
    // Must be shop_owner or admin
    if (!session || (!roles.includes("shop_owner") && !roles.includes("admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { shopId, operatingStatus } = body;
    
    if (!shopId || !operatingStatus) {
      return NextResponse.json({ error: "Missing shopId or operatingStatus" }, { status: 400 });
    }

    const shopRef = adminDb.collection("shops").doc(shopId);
    const shopDoc = await shopRef.get();
    
    if (!shopDoc.exists) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const shopData = shopDoc.data();
    
    if (shopData?.ownerEmail !== session.user?.email && !roles.includes("admin")) {
      return NextResponse.json({ error: "You do not own this shop." }, { status: 403 });
    }

    await shopRef.update({
      operatingStatus,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true, operatingStatus });
  } catch (error: any) {
    console.error("Failed to update shop status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
