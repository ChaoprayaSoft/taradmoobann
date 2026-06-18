import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from 'firebase-admin/firestore';
import { sendNotificationToUser } from "@/lib/sendNotification";

export const dynamic = 'force-dynamic';

// Trigger this endpoint daily using Vercel Cron
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    
    // In production, require CRON_SECRET. For local testing, allow if not set.
    if (process.env.NODE_ENV === 'production') {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
      }
    }

    const now = new Date();
    const batch = adminDb.batch();
    let updatesCount = 0;
    
    // 1. Fetch all approved shops
    const shopsSnapshot = await adminDb.collection("shops").where("status", "==", "approved").get();
    
    // 2. We need users' document references to deduct coins
    const usersSnapshot = await adminDb.collection("users").get();
    const userDocsMap = new Map<string, any>();
    usersSnapshot.docs.forEach((doc: any) => userDocsMap.set(doc.id, doc));

    for (const shopDoc of shopsSnapshot.docs) {
      const shopData = shopDoc.data();
      const shopId = shopDoc.id;
      const ownerEmail = shopData.ownerEmail;
      
      if (!shopData.createdAt || !ownerEmail) continue;

      const shopCreatedDate = new Date(shopData.createdAt);
      
      // Calculate diff Time
      const diffTime = now.getTime() - shopCreatedDate.getTime();
      if (diffTime < 0) continue; // Shop created in the future?
      
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      const cyclesDue = Math.floor(diffDays / 30);
      const daysIntoCurrentCycle = diffDays % 30;
      const daysUntilNextFee = 30 - daysIntoCurrentCycle;
      
      const maintenanceBilledCycles = shopData.maintenanceBilledCycles || 0;
      const lastReminderCycle = shopData.lastReminderCycle || -1;
      
      let needsShopUpdate = false;
      const shopUpdateData: any = {};

      // Logic A: 7-Day Reminder Notification
      if (daysUntilNextFee === 7 && lastReminderCycle < cyclesDue) {
        let nextDeductionDate = new Date(now.getTime());
        nextDeductionDate.setDate(nextDeductionDate.getDate() + 7);
        const nextDeductionDateStr = nextDeductionDate.toLocaleDateString('en-GB');

        await sendNotificationToUser(
          ownerEmail,
          { key: "Notifications.maintenanceFeeReminderTitle" },
          { 
            key: "Notifications.maintenanceFeeReminderBody", 
            params: { date: nextDeductionDateStr } 
          },
          { url: "/shop-owner" }
        );

        shopUpdateData.lastReminderCycle = cyclesDue;
        needsShopUpdate = true;
      }

      // Logic B: Bill Due
      if (cyclesDue > maintenanceBilledCycles) {
        // Calculate the fee
        // Find completed orders for this shop strictly within the immediate 30 days prior to the cycle end
        
        const currentCycleEnd = new Date(shopCreatedDate.getTime());
        currentCycleEnd.setDate(shopCreatedDate.getDate() + (cyclesDue * 30));
        
        const currentCycleStart = new Date(currentCycleEnd.getTime());
        currentCycleStart.setDate(currentCycleStart.getDate() - 30);

        const ordersSnapshot = await adminDb.collection("orders")
          .where("shopId", "==", shopId)
          .where("status", "==", "Completed")
          .get();

        const completedOrdersInCycle = ordersSnapshot.docs.filter(doc => {
          const orderDate = new Date(doc.data().createdAt);
          return orderDate >= currentCycleStart && orderDate < currentCycleEnd;
        });

        const fee = completedOrdersInCycle.length >= 5 ? 2 : 5;

        const userDoc = userDocsMap.get(ownerEmail);
        if (userDoc && userDoc.exists) {
          // 1. Deduct fee
          batch.update(userDoc.ref, {
            coins: FieldValue.increment(-fee)
          });

          // 2. Transaction Record
          const txRef = adminDb.collection("transactions").doc();
          batch.set(txRef, {
            id: txRef.id,
            userId: userDoc.id,
            userEmail: ownerEmail,
            type: "maintenance_fee",
            amount: -fee,
            description: `Monthly maintenance fee for shop: ${shopData.name}`,
            relatedShopId: shopId,
            createdAt: new Date().toISOString(),
          });

          // 3. Notification
          await sendNotificationToUser(
            ownerEmail,
            { key: "Notifications.maintenanceFeeDeductedTitle" },
            { 
              key: "Notifications.maintenanceFeeDeductedBody", 
              params: { fee: fee.toString() } 
            },
            { url: "/shop-owner" }
          );

          updatesCount++;
        }

        // 4. Update shop document
        shopUpdateData.maintenanceBilledCycles = cyclesDue;
        needsShopUpdate = true;
      }

      if (needsShopUpdate) {
        batch.update(shopDoc.ref, shopUpdateData);
        updatesCount++;
      }
    }

    // --- Activity Log Cleanup (Older than 90 days) ---
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const oldLogsSnapshot = await adminDb
      .collection("activity_logs")
      .where("timestamp", "<", admin.firestore.Timestamp.fromDate(ninetyDaysAgo))
      .limit(500) // Delete in batches to avoid timeout
      .get();

    for (const doc of oldLogsSnapshot.docs) {
      batch.delete(doc.ref);
      updatesCount++;
    }
    // ------------------------------------------------

    if (updatesCount > 0) {
      // Commit all batch operations
      await batch.commit();
    }

    return NextResponse.json({ success: true, processedUpdates: updatesCount });
  } catch (error: any) {
    console.error("Cron Job Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
