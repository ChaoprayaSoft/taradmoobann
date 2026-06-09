import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET() {
  const usersSnapshot = await adminDb.collection("users").get();
  const users = usersSnapshot.docs.map(doc => ({
    id: doc.id,
    hasFcmToken: !!doc.data().fcmToken,
    roles: doc.data().roles,
    fcmTokenUpdatedAt: doc.data().fcmTokenUpdatedAt
  }));

  const shopsSnapshot = await adminDb.collection("shops").get();
  const shops = shopsSnapshot.docs.map(doc => ({
    id: doc.id,
    ownerEmail: doc.data().ownerEmail
  }));

  return NextResponse.json({ users, shops });
}
