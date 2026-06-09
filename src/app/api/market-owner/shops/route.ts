import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const roles = (session?.user as any)?.roles || [];
    
    // Allow market_owner OR admin
    if (!session || (!roles.includes("market_owner") && !roles.includes("admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, category, coverImage, ownerEmail, marketId } = body;

    if (!name || !ownerEmail || !marketId || !category) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const email = ownerEmail.toLowerCase().trim();

    // Ensure the user actually owns the market (unless they are an admin)
    const marketRef = adminDb.collection("markets").doc(marketId);
    const marketDoc = await marketRef.get();
    
    if (!marketDoc.exists) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }
    
    if (marketDoc.data()?.ownerEmail !== session.user?.email && !roles.includes("admin")) {
      return NextResponse.json({ error: "You do not have permission to add a shop to this market." }, { status: 403 });
    }

    // 1. Create the Shop in Firestore
    const shopRef = adminDb.collection("shops").doc();
    const shopId = shopRef.id;

    await shopRef.set({
      id: shopId,
      marketId,
      name,
      description: description || "",
      category,
      coverImage: coverImage || "",
      ownerEmail: email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 2. Update or pre-create the user (Option B) for Shop Owner
    const userRef = adminDb.collection("users").doc(email);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      const currentRoles = userData?.roles || ["shopper"];
      if (!currentRoles.includes("shop_owner")) {
        currentRoles.push("shop_owner");
        await userRef.update({ roles: currentRoles });
      }
    } else {
      // Pre-create the ghost user record for the shop owner
      await userRef.set({
        email: email,
        roles: ["shopper", "shop_owner"],
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, shopId });
  } catch (error: any) {
    console.error("Failed to create shop:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
