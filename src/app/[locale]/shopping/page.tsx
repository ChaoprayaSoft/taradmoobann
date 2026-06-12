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
  const marketsSnapshot = await adminDb.collection("markets").get();
  const allMarkets = marketsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

  // 2. Determine user's default village
  let userVillageName = "";
  if (userEmail) {
    const userDoc = await adminDb.collection("users").doc(userEmail).get();
    if (userDoc.exists) {
      const addresses = userDoc.data()?.addresses || [];
      if (addresses.length > 0) {
        try {
          const firstAddr = JSON.parse(addresses[0]);
          userVillageName = firstAddr.villageName || "";
        } catch(e) {
          userVillageName = "";
        }
      }
    }
  }

  // 3. Fetch all approved shops
  const shopsSnapshot = await adminDb.collection("shops").where("status", "==", "approved").get();
  const allShops = shopsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

  // 4. Fetch all available products
  const productsSnapshot = await adminDb.collection("products").get();
  const allProducts = productsSnapshot.docs.map(doc => {
    const data = doc.data();
    const shop = allShops.find(s => s.id === data.shopId);
    return {
      id: doc.id,
      ...data,
      shopName: shop ? shop.name : "Unknown Shop",
      marketId: shop ? shop.marketId : null
    } as any;
  }).filter(p => p.marketId && (p.isAvailable === undefined || p.isAvailable === true)); // Only include products whose shop and market exist and are available

  // Separate products into village and global
  let whatsUpTodayProducts: any[] = [];
  if (userVillageName) {
    const villageMarkets = allMarkets.filter(m => m.villageName === userVillageName).map(m => m.id);
    whatsUpTodayProducts = allProducts.filter(p => villageMarkets.includes(p.marketId));
  }
  
  // Shuffle arrays
  whatsUpTodayProducts = whatsUpTodayProducts.sort(() => 0.5 - Math.random()).slice(0, 10);
  const nearbyProducts = allProducts.sort(() => 0.5 - Math.random()).slice(0, 15);

  return (
    <ShoppingClient 
      markets={allMarkets} 
      userVillageName={userVillageName} 
      userEmail={userEmail} 
      whatsUpTodayProducts={whatsUpTodayProducts}
      nearbyProducts={nearbyProducts}
    />
  );
}
