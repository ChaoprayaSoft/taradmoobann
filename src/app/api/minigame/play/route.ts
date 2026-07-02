import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email;

    if (!session || !userEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { gameType } = await req.json().catch(() => ({ gameType: 'unknown' }));

    const usersSnapshot = await adminDb.collection("users").where("email", "==", userEmail).limit(1).get();
    if (usersSnapshot.empty) {
      return NextResponse.json({ error: "User not found in database" }, { status: 404 });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    const currentCoins = userData.coins || 0;
    
    // Check if free play is available
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastFreePlay = userData.lastFreeMinigamePlay;
    
    const isFreePlay = lastFreePlay !== todayStr;
    const cost = isFreePlay ? 0 : 1;

    if (!isFreePlay && currentCoins < cost) {
      return NextResponse.json({ error: "Insufficient coins", code: "INSUFFICIENT_COINS" }, { status: 400 });
    }

    // Determine Reward
    // 0.5, 1, 1.5, 3, 4, 5 coins
    // Probabilities: Loss (40%), 0.5 (20%), 1 (15%), 1.5 (10%), 3 (8%), 4 (5%), 5 (2%)
    const rand = Math.random();
    let reward = 0;
    if (rand < 0.40) reward = 0;
    else if (rand < 0.60) reward = 0.5;
    else if (rand < 0.75) reward = 1;
    else if (rand < 0.85) reward = 1.5;
    else if (rand < 0.93) reward = 3;
    else if (rand < 0.98) reward = 4;
    else reward = 5;

    const netCoins = reward - cost;

    const batch = adminDb.batch();

    const updateData: any = {};
    if (netCoins !== 0) {
      updateData.coins = FieldValue.increment(netCoins);
    }
    if (isFreePlay) {
      updateData.lastFreeMinigamePlay = todayStr;
    }
    
    if (Object.keys(updateData).length > 0) {
      batch.update(userDoc.ref, updateData);
    }

    // Record transactions
    if (cost > 0) {
      const feeTxRef = adminDb.collection("transactions").doc();
      batch.set(feeTxRef, {
        id: feeTxRef.id,
        userId: userDoc.id,
        userEmail: userEmail,
        type: "minigame_fee",
        amount: -cost,
        description: `Mini-game fee (${gameType})`,
        createdAt: new Date().toISOString(),
      });
    }

    if (reward > 0) {
      const rewardTxRef = adminDb.collection("transactions").doc();
      batch.set(rewardTxRef, {
        id: rewardTxRef.id,
        userId: userDoc.id,
        userEmail: userEmail,
        type: "minigame_reward",
        amount: reward,
        description: `Mini-game reward (${gameType})`,
        createdAt: new Date().toISOString(),
      });
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      reward,
      cost,
      netCoins,
      isFreePlay,
      newCoinBalance: currentCoins + netCoins
    });
  } catch (error: any) {
    console.error("Failed to process mini-game play:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
