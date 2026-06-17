import { getTranslations } from "next-intl/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";
import { decryptAddress } from "@/lib/encryption";
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
      const addresses = (userDoc.data()?.addresses || []).map(decryptAddress);
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

  // 3. Fetch all approved shops and their owners' coins
  const shopsSnapshot = await adminDb.collection("shops").where("status", "==", "approved").get();
  let allShops = shopsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

  const usersSnapshot = await adminDb.collection("users").get();
  const userCoinsMap = new Map<string, number>();
  usersSnapshot.docs.forEach(doc => userCoinsMap.set(doc.id, doc.data()?.coins || 0));

  allShops = allShops.filter(shop => (userCoinsMap.get(shop.ownerEmail) ?? 0) > 0);

  // 4. Fetch all available products
  const productsSnapshot = await adminDb.collection("products").get();
  const allProducts = productsSnapshot.docs.map(doc => {
    const data = doc.data();
    const shop = allShops.find(s => s.id === data.shopId);
    const market = shop ? allMarkets.find(m => m.id === shop.marketId) : null;
    return {
      id: doc.id,
      ...data,
      shopName: shop ? shop.name : "Unknown Shop",
      marketId: shop ? shop.marketId : null,
      villageName: market ? market.villageName : ""
    } as any;
  }).filter(p => p.marketId && (p.isAvailable === undefined || p.isAvailable === true)); // Only include products whose shop and market exist and are available

  // Separate products into village and global
  let whatsUpTodayProducts: any[] = [];
  if (userVillageName) {
    const villageMarkets = allMarkets.filter(m => m.villageName === userVillageName).map(m => m.id);
    whatsUpTodayProducts = allProducts.filter(p => villageMarkets.includes(p.marketId));
  }
  
  // Shuffle arrays
  whatsUpTodayProducts = whatsUpTodayProducts.sort(() => 0.5 - Math.random()).slice(0, 4);
  const nearbyProducts = allProducts.sort(() => 0.5 - Math.random()).slice(0, 8);

  // 4.5 Fetch Spotlight Products
  let spotlightProducts: any[] = allProducts.filter(
    (p: any) => p.isSpotlight && p.spotlightExpiry && new Date(p.spotlightExpiry) > new Date()
  );

  if (userVillageName) {
    spotlightProducts = spotlightProducts.filter((p: any) => p.villageName === userVillageName);
  } else {
    spotlightProducts = [];
  }

  // 5. Fetch Ads
  const settingsDoc = await adminDb.collection("settings").doc("ads").get();
  const maxAds = settingsDoc.exists ? (settingsDoc.data()?.maxAds || 3) : 3;
  const adsSnapshot = await adminDb.collection("ads").where("status", "==", "ON").get();
  const todayStr = new Date().toISOString().split('T')[0];
  let fetchedAds = adsSnapshot.docs
    .map(doc => doc.data())
    .filter(ad => ad.validUntil >= todayStr && (!ad.placement || ad.placement === "Main Page"));

  if (fetchedAds.length === 0) {
    fetchedAds = [
      { id: "mock1", title: "Fresh Organic Produce", description: "Get the freshest organic fruits and vegetables delivered to your door.", imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80", linkUrl: "https://example.com" },
      { id: "mock2", title: "Local Bakery Deals", description: "Buy 1 get 1 free on all artisan breads today only!", imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80", linkUrl: "https://example.com" },
    ];
  } else {
    fetchedAds = fetchedAds.sort(() => 0.5 - Math.random()).slice(0, maxAds);
  }

  // 6. Markets count for Discover Local Markets
  const marketsForDisplay = await Promise.all(allMarkets.map(async (m: any) => {
    const shopsCountSnap = await adminDb.collection("shops").where("marketId", "==", m.id).where("status", "==", "approved").count().get();
    const membersCountSnap = await adminDb.collection("market_memberships").where("marketId", "==", m.id).where("status", "==", "approved").count().get();
    return {
      ...m,
      shopsCount: shopsCountSnap.data().count,
      membersCount: membersCountSnap.data().count
    };
  }));
  marketsForDisplay.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Determine user's market memberships
  let marketStatusMap = new Map<string, string>();
  if (userEmail) {
    const memSnapshot = await adminDb.collection("market_memberships").where("userEmail", "==", userEmail).get();
    memSnapshot.docs.forEach(doc => marketStatusMap.set(doc.data().marketId, doc.data().status));
    const ownedShopsSnapshot = await adminDb.collection("shops").where("ownerEmail", "==", userEmail).get();
    ownedShopsSnapshot.docs.forEach(doc => marketStatusMap.set(doc.data().marketId, "approved"));
  }

  return (
    <ShoppingClient 
      markets={marketsForDisplay} 
      userVillageName={userVillageName} 
      userEmail={userEmail}
      whatsUpTodayProducts={whatsUpTodayProducts}
      nearbyProducts={nearbyProducts}
      activeAds={fetchedAds}
      spotlightProducts={spotlightProducts}
    />
  );
}
