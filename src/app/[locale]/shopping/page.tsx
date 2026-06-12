import { getTranslations } from "next-intl/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";
import ShoppingClient from "./ShoppingClient";

export default async function ShoppingPage() {
  const session = await getServerSession(authOptions);
  
  // We allow guests to view the page, but they will be prompted to sign in if they try to enter a market.
  const userEmail = session?.user?.email || null;

  // 1. Fetch all markets
  const marketsSnapshot = await adminDb.collection("markets").where("isActive", "==", true).get();
  const allMarkets = marketsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // 2. Determine user's default village
  let userVillageName = "";
  if (userEmail) {
    const addressSnapshot = await adminDb.collection("user_addresses").where("userEmail", "==", userEmail).get();
    if (!addressSnapshot.empty) {
      // Find the default address, or fallback to the first one
      let defaultAddress = addressSnapshot.docs.find(doc => doc.data().isDefault);
      if (!defaultAddress) defaultAddress = addressSnapshot.docs[0];
      userVillageName = defaultAddress.data().villageName || "";
    }
  }

  return (
    <ShoppingClient 
      markets={allMarkets} 
      userVillageName={userVillageName} 
      userEmail={userEmail} 
    />
  );
}
