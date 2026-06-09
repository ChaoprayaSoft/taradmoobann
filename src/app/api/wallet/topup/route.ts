import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { amountTHB } = await req.json();

    if (!amountTHB || typeof amountTHB !== "number" || amountTHB <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const amountSatang = amountTHB * 100;
    
    // Omise API requires Basic Auth with the Secret Key as username and empty password
    const secretKey = process.env.OMISE_SECRET_KEY || "";
    const authHeader = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;

    // 1. Create a source for PromptPay
    const sourceRes = await fetch("https://api.omise.co/sources", {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "promptpay",
        amount: amountSatang,
        currency: "thb"
      })
    });
    
    const sourceData = await sourceRes.json();
    if (!sourceRes.ok) {
      throw new Error(sourceData.message || "Failed to create Omise source");
    }

    // 2. Create a charge using that source
    const chargeRes = await fetch("https://api.omise.co/charges", {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: amountSatang,
        currency: "thb",
        source: sourceData.id,
        return_uri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/shopper/wallet`,
        metadata: {
          userId: session.user?.email,
          coins: amountTHB, // Assuming 1 THB = 1 Coin for now
        }
      })
    });

    const chargeData = await chargeRes.json();
    if (!chargeRes.ok) {
      throw new Error(chargeData.message || "Failed to create Omise charge");
    }

    // The PromptPay QR code URL is in chargeData.source.scannable_code.image.download_uri
    const qrCodeUrl = chargeData.source?.scannable_code?.image?.download_uri;

    if (!qrCodeUrl) {
        throw new Error("Could not generate PromptPay QR Code");
    }

    return NextResponse.json({ 
        success: true, 
        chargeId: chargeData.id, 
        qrCodeUrl: qrCodeUrl,
        amountTHB: amountTHB
    });

  } catch (error: any) {
    console.error("Error creating topup charge:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

