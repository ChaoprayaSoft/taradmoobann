import * as admin from "firebase-admin";
import { adminDb } from "@/lib/firebaseAdmin";
import { Resend } from "resend";
import * as fs from "fs";
import * as path from "path";

const resend = new Resend(process.env.RESEND_API_KEY || "dummy_key");

export type TranslationMessage = {
  key: string;
  params?: Record<string, any>;
};

function translate(locale: string, key: string, params?: Record<string, any>) {
  try {
    const filePath = path.join(process.cwd(), `messages/${locale}.json`);
    if (!fs.existsSync(filePath)) return key;
    const fileData = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(fileData);
    
    const keys = key.split('.');
    let template = json;
    for (const k of keys) {
      if (template[k] === undefined) return key;
      template = template[k];
    }
    
    if (typeof template !== 'string') return key;
    
    let result = template;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(new RegExp(`{${k}}`, 'g'), String(v));
      }
    }
    return result;
  } catch (e) {
    console.error("Translation error:", e);
    return key;
  }
}

export async function sendNotificationToUser(
  email: string, 
  title: string | TranslationMessage, 
  body: string | TranslationMessage, 
  data?: any
) {
  try {
    const userDoc = await adminDb.collection("users").doc(email).get();
    if (!userDoc.exists) return;

    const userData = userDoc.data();
    
    // Default to 'th' as requested
    const locale = userData?.locale || 'th';

    let finalTitle = typeof title === 'string' ? title : translate(locale, title.key, title.params);
    let finalBody = typeof body === 'string' ? body : translate(locale, body.key, body.params);

    // 1. Firebase Cloud Messaging Push Notification
    if (userData?.fcmToken && userData?.pushNotificationsEnabled !== false) {
      const fcmBody = finalBody.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>?/gm, '');
      const message: admin.messaging.Message = {
        notification: {
          title: finalTitle,
          body: fcmBody,
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
          const { data: resendData, error } = await resend.emails.send({
            from: 'TaradMooBann <noreply@taradmoobann.com>',
            to: email,
            subject: finalTitle,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
                <h2 style="color: #111827;">${finalTitle}</h2>
                <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">${finalBody}</p>
                ${data?.url ? `<a href="https://taradmoobann.com${data.url}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold;">View Details</a>` : ''}
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin-top: 40px; margin-bottom: 20px;" />
                <p style="color: #9ca3af; font-size: 12px;">You are receiving this email because you have notifications enabled in your TaradMooBann dashboard. You can turn them off from your My Page Settings.</p>
              </div>
            `
          });
          
          if (error) {
            console.error(`Resend API error for ${email}:`, error);
          } else {
            console.log(`Successfully sent email notification to ${email}`, resendData);
          }
        } catch (emailErr) {
          console.error(`Error sending email to ${email}:`, emailErr);
        }
      } else {
        console.log(`[SIMULATED EMAIL TO ${email}] Title: ${finalTitle} | Body: ${finalBody}`);
      }
    }
  } catch (error) {
    console.error(`Failed to send notification to ${email}:`, error);
  }
}
