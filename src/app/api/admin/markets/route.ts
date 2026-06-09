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

    const { name, description, coverImage, ownerEmail, operatingStatus, validDates } = await req.json();

    if (!name || !ownerEmail) {
      return NextResponse.json({ error: "Name and owner email are required" }, { status: 400 });
    }

    // Assign market_owner role to the user
    const usersSnapshot = await adminDb.collection("users").where("email", "==", ownerEmail).get();
    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      const userData = userDoc.data();
      const currentRoles = userData.roles || [];
      if (!currentRoles.includes("market_owner")) {
        await userDoc.ref.update({
          roles: [...currentRoles, "market_owner"]
        });
      }
    } else {
      await adminDb.collection("users").add({
        email: ownerEmail,
        roles: ["shopper", "market_owner"],
        createdAt: new Date().toISOString()
      });
    }

    const newMarketRef = adminDb.collection("markets").doc();
    await newMarketRef.set({
      id: newMarketRef.id,
      name,
      description: description || "",
      coverImage: coverImage || "",
      ownerEmail,
      operatingStatus: operatingStatus || "always_open",
      validDates: validDates || "",
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error creating market:", error);
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

    const { id, name, description, coverImage, ownerEmail, operatingStatus, validDates } = await req.json();

    if (!id || !name || !ownerEmail) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const updateData = {
      name,
      description: description || "",
      coverImage: coverImage || "",
      ownerEmail,
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
      return NextResponse.json({ error: "Missing market id" }, { status: 400 });
    }

    await adminDb.collection("markets").doc(id).delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting market:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
