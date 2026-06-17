import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import * as admin from "firebase-admin";

export async function POST(req: Request) {
  try {
    const incomingEvent = await req.json();

    const eventId = incomingEvent.id;
    if (!eventId || !eventId.startsWith('evnt_')) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    }

    const omiseSecretKey = process.env.OMISE_SECRET_KEY;
    if (!omiseSecretKey) {
      console.error("OMISE_SECRET_KEY is missing");
      return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    // Verify the event directly with Omise
    const authHeader = `Basic ${Buffer.from(`${omiseSecretKey}:`).toString('base64')}`;
    const response = await fetch(`https://api.omise.co/events/${eventId}`, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error("Omise webhook verification failed", response.status);
      return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });
    }

    const verifiedEvent = await response.json();

    // Verify event is charge.complete
    if (verifiedEvent.key === "charge.complete") {
      const charge = verifiedEvent.data;
      
      // We only care if it's successful
      if (charge.status === "successful") {
        const userId = charge.metadata?.userId;
        const coinsToAdd = charge.metadata?.coins;

        if (userId && coinsToAdd) {
          const userRef = adminDb.collection("users").doc(userId);
          const txRef = adminDb.collection("transactions").doc(charge.id);

          // Check if this transaction has already been processed to avoid double counting
          const txDoc = await txRef.get();
          if (!txDoc.exists) {
            const batch = adminDb.batch();

            // 1. Add transaction record
            batch.set(txRef, {
              userId: userId,
              chargeId: charge.id,
              amountTHB: charge.amount / 100, // Amount is in satang
              coinsAdded: coinsToAdd,
              status: "successful",
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // 2. Increment user coins
            batch.update(userRef, {
              coins: admin.firestore.FieldValue.increment(coinsToAdd)
            });

            await batch.commit();
            console.log(`Successfully added ${coinsToAdd} coins to user ${userId}`);
          } else {
            console.log(`Transaction ${charge.id} already processed.`);
          }
        }
      }
    }

    // Always return 200 OK to Omise so they stop retrying
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Error processing Omise webhook:", error);
    return NextResponse.json(
      { error: "Webhook Error" },
      { status: 400 }
    );
  }
}
