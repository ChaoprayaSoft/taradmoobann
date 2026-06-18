const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory() && !fullPath.includes('node_modules') && !fullPath.includes('.next')) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;
      
      // Fix authOptions.ts
      if (fullPath.includes('authOptions.ts')) {
          content = content.replace(/import \* as admin from "firebase-admin";/, "import { FieldValue } from 'firebase-admin/firestore';");
          content = content.replace(/admin\.firestore\.FieldValue\.serverTimestamp\(\)/g, "FieldValue.serverTimestamp()");
      }
      // Fix sendNotification.ts
      else if (fullPath.includes('sendNotification.ts')) {
          content = content.replace(/import \* as admin from "firebase-admin";/, "import { Message } from 'firebase-admin/messaging';\nimport { adminMessaging } from '@/lib/firebaseAdmin';");
          content = content.replace(/admin\.messaging\.Message/g, "Message");
          content = content.replace(/admin\.messaging\(\)\.send/g, "adminMessaging.send");
      }
      else {
          // Standard API routes
          content = content.replace(/import \* as admin from "firebase-admin";/g, "import { FieldValue } from 'firebase-admin/firestore';");
          content = content.replace(/admin\.firestore\.FieldValue\.serverTimestamp\(\)/g, "FieldValue.serverTimestamp()");
          content = content.replace(/admin\.firestore\.FieldValue\.increment\(([^)]+)\)/g, "FieldValue.increment($1)");
          content = content.replace(/admin\.firestore\.FieldValue\.arrayUnion\(([^)]+)\)/g, "FieldValue.arrayUnion($1)");
      }

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content);
        console.log('Fixed', fullPath);
      }
    }
  }
}

processDir('c:/WebApp/TaradMooBann/src');
