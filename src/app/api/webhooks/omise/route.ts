import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import * as admin from "firebase-admin";

export async function POST(req: Request) {
  try {
    const event = await req.json();

    // Verify event is charge.complete
    if (event.key === "charge.complete") {
      const charge = event.data;
      
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
