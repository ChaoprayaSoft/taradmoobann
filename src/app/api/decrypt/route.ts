import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { decryptAddress } from "@/lib/encryption";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { encryptedData } = await req.json();
    if (!encryptedData) {
      return NextResponse.json({ error: "Missing encryptedData" }, { status: 400 });
    }

    if (Array.isArray(encryptedData)) {
      const decryptedArray = encryptedData.map(data => typeof data === "string" ? decryptAddress(data) : data);
      return NextResponse.json({ success: true, decrypted: decryptedArray });
    }

    if (typeof encryptedData === "string") {
      const decrypted = decryptAddress(encryptedData);
      return NextResponse.json({ success: true, decrypted });
    }

    return NextResponse.json({ error: "Invalid encryptedData format" }, { status: 400 });
  } catch (error) {
    console.error("Decryption API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
