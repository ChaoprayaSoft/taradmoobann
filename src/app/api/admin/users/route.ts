import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const roles = (session?.user as any)?.roles || [];
    
    if (!session || !session.user?.email || !roles.includes("admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, action } = await req.json();

    if (!email || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(email);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (action === "toggleStatus") {
      const currentStatus = userDoc.data()?.isActive;
      // Default is true if undefined, so toggling makes it false
      const newStatus = currentStatus === false ? true : false;
      
      await userRef.update({
        isActive: newStatus,
        updatedAt: new Date().toISOString()
      });
      
      return NextResponse.json({ success: true, isActive: newStatus });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    console.error("Error managing user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const roles = (session?.user as any)?.roles || [];
    
    if (!session || !session.user?.email || !roles.includes("admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const email = url.searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(email);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const batch = adminDb.batch();

    // 1. Delete all shops owned by user
    const shopsQuery = await adminDb.collection("shops").where("ownerEmail", "==", email).get();
    for (const shopDoc of shopsQuery.docs) {
      batch.delete(shopDoc.ref);
      
      // Delete all products for each shop
      const productsQuery = await adminDb.collection("products").where("shopId", "==", shopDoc.id).get();
      for (const productDoc of productsQuery.docs) {
        batch.delete(productDoc.ref);
      }
    }

    // 2. Delete all memberships owned by user
    const membershipsQuery = await adminDb.collection("memberships").where("userEmail", "==", email).get();
    for (const membershipDoc of membershipsQuery.docs) {
      batch.delete(membershipDoc.ref);
    }

    // 3. Delete user document
    batch.delete(userRef);

    await batch.commit();

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
