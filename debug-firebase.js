const admin = require("firebase-admin");
const fs = require("fs");
require("dotenv").config({ path: ".env.local" });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

async function debug() {
  const db = admin.firestore();
  const users = await db.collection("users").get();
  console.log("USERS:");
  users.docs.forEach(doc => {
    console.log(`- ${doc.id}: fcmToken exists? ${!!doc.data().fcmToken}, roles: ${doc.data().roles}`);
  });

  const shops = await db.collection("shops").get();
  console.log("\nSHOPS:");
  shops.docs.forEach(doc => {
    console.log(`- ${doc.id}: ownerEmail: ${doc.data().ownerEmail}`);
  });
}

debug().catch(console.error);
