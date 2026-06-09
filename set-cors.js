const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, ".env.local");
const envData = fs.readFileSync(envPath, "utf8");

const env = {};
envData.split("\n").forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
  }
});

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
});

async function configureCors() {
  try {
    console.log("Configuring CORS for bucket:", env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
    const bucket = admin.storage().bucket();
    
    await bucket.setCorsConfiguration([
      {
        origin: ["*"],
        method: ["GET", "PUT", "POST", "DELETE", "HEAD", "OPTIONS"],
        responseHeader: ["*"],
        maxAgeSeconds: 3600
      }
    ]);
    
    console.log("Successfully updated CORS configuration!");
    process.exit(0);
  } catch (err) {
    console.error("Failed to update CORS:", err);
    process.exit(1);
  }
}

configureCors();
