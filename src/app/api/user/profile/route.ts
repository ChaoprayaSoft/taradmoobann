import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, emailNotificationsEnabled, pushNotificationsEnabled } = await req.json();

    const updateData: any = {};
    if (name && typeof name === 'string') {
      updateData.name = name.trim();
    }
    if (typeof emailNotificationsEnabled === 'boolean') {
      updateData.emailNotificationsEnabled = emailNotificationsEnabled;
    }
    if (typeof pushNotificationsEnabled === 'boolean') {
      updateData.pushNotificationsEnabled = pushNotificationsEnabled;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(session.user.email);
    
    await userRef.update(updateData);

    return NextResponse.json({ success: true, ...updateData });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
