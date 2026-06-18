import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { FieldValue } from 'firebase-admin/firestore';

import { adminStorage } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert Web File to a Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Use Firebase Admin Storage (Google Cloud Storage)
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const bucket = adminStorage.bucket(bucketName);
    
    // Generate a unique file name
    const filename = `uploads/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
    const fileUpload = bucket.file(filename);

    // Upload the file buffer to Firebase Storage
    await fileUpload.save(buffer, {
      metadata: {
        contentType: file.type,
      },
    });

    // Make the file publicly readable
    await fileUpload.makePublic();

    // Get the public URL
    const fileUrl = fileUpload.publicUrl();

    return NextResponse.json({ success: true, url: fileUrl });
  } catch (error: any) {
    console.error("Error uploading to Firebase Admin Storage:", error);
    return NextResponse.json({ error: error.message || "Failed to upload" }, { status: 500 });
  }
}
