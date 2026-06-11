import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebaseAdmin";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "dummy_key");

export async function sendNotificationToUser(email: string, title: string, body: string, data?: any) {
  try {
    const userDoc = await adminDb.collection("users").doc(email).get();
    if (!userDoc.exists) return;

    const userData = userDoc.data();

    // 1. Firebase Cloud Messaging Push Notification
    if (userData?.fcmToken && userData?.pushNotificationsEnabled !== false) {
      const message: admin.messaging.Message = {
        notification: {
          title,
          body,
        },
        token: userData.fcmToken,
        data: data || {},
      };

      try {
        await admin.messaging().send(message);
        console.log(`Successfully sent push notification to ${email}`);
      } catch (err) {
        console.error(`Error sending push notification:`, err);
      }
    }

    // 2. Email Notification via Resend
    if (userData?.emailNotificationsEnabled !== false) {
      if (process.env.RESEND_API_KEY) {
        try {
          await resend.emails.send({
            from: 'TaradMooBann <noreply@taradmoobann.com>',
            to: email,
            subject: title,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
                <h2 style="color: #111827;">${title}</h2>
                <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">${body}</p>
                ${data?.url ? `<a href="https://taradmoobann.com${data.url}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold;">View Details</a>` : ''}
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin-top: 40px; margin-bottom: 20px;" />
                <p style="color: #9ca3af; font-size: 12px;">You are receiving this email because you have notifications enabled in your TaradMooBann dashboard. You can turn them off from your My Page Settings.</p>
              </div>
            `
          });
          console.log(`Successfully sent email notification to ${email}`);
        } catch (emailErr) {
          console.error(`Error sending email to ${email}:`, emailErr);
        }
      } else {
        console.warn(`Resend API Key is missing. Skipping email to ${email}`);
      }
    }
  } catch (error) {
    console.error(`Error processing notifications for ${email}:`, error);
  }
}
