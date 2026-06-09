import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebaseAdmin";

export async function sendNotificationToUser(email: string, title: string, body: string, data?: any) {
  try {
    const userDoc = await adminDb.collection("users").doc(email).get();
    if (!userDoc.exists) return;

    const userData = userDoc.data();
    if (!userData?.fcmToken) return;

    const message: admin.messaging.Message = {
      notification: {
        title,
        body,
      },
      token: userData.fcmToken,
      data: data || {},
    };

    await admin.messaging().send(message);
    console.log(`Successfully sent notification to ${email}`);
  } catch (error) {
    console.error(`Error sending notification to ${email}:`, error);
  }
}
