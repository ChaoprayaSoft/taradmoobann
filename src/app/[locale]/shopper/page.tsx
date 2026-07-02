import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebaseAdmin";
import { decryptAddress } from "@/lib/encryption";
import ShopperDashboardClient from "./ShopperDashboardClient";

export default async function ShopperDashboard() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/");
  }

  const userEmail = session.user?.email || "";

  let allMarkets: any[] = [];
  let allShops: any[] = [];
  let memberships: any[] = [];
  let userAddresses: string[] = [];
  let orders: any[] = [];
  let userCoins: number = 0;
  let userMaxShopSlots: number = 1;
  let emailNotificationsEnabled: boolean = true;
  let pushNotificationsEnabled: boolean = true;
  let shopNamesMap: Record<string, string> = {};
  let isWalletEnabled: boolean = true;

  try {
    const marketSnapshot = await adminDb.collection("markets").get();
    allMarkets = marketSnapshot.docs.map((doc: any) => doc.data());
    allMarkets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const allShopsSnapshot = await adminDb.collection("shops").get();
    const rawAllShops = allShopsSnapshot.docs.map((doc: any) => doc.data());
    allShops = rawAllShops.filter(shop => shop.status === "approved");

    const usersSnapshot = await adminDb.collection("users").get();
    const userCoinsMap = new Map<string, number>();
    usersSnapshot.docs.forEach((doc: any) => userCoinsMap.set(doc.id, doc.data()?.coins || 0));

    allShops = allShops.filter(shop => (userCoinsMap.get(shop.ownerEmail) ?? 0) > 0);

    // Populate shopsCount for each market
    allMarkets = allMarkets.map(market => {
      const count = allShops.filter(shop => shop.marketId === market.id).length;
      return { ...market, shopsCount: count };
    });

    // Fetch user's shops
    const shopsSnapshot = await adminDb
      .collection("shops")
      .where("ownerEmail", "==", userEmail)
      .get();
    
    const ownedShops = shopsSnapshot.docs.map((doc: any) => doc.data());

    // Fetch user's profile/addresses
    const userProfileSnapshot = await adminDb.collection("users").doc(userEmail).get();
    if (userProfileSnapshot.exists) {
      const data = userProfileSnapshot.data();
      userAddresses = (data?.addresses || []).map(decryptAddress);
      if (data?.address && userAddresses.length === 0) {
        userAddresses = [data.address]; // Fallback for old single address format
      }
      userCoins = data?.coins || 0;
      userMaxShopSlots = Math.max(data?.maxShopSlots || 0, ownedShops.length);
      emailNotificationsEnabled = data?.emailNotificationsEnabled !== false;
      pushNotificationsEnabled = data?.pushNotificationsEnabled !== false;
    }

    // Fetch user's orders
    const orderSnapshot = await adminDb
      .collection("orders")
      .where("shopperEmail", "==", userEmail)
      .get();
      
    orders = orderSnapshot.docs.map((doc: any) => doc.data());
    orders = orders.map(o => {
      const shop = rawAllShops.find(s => s.id === o.shopId);
      return {
        ...o,
        deliveryAddress: decryptAddress(o.deliveryAddress || ""),
        shopName: o.shopName || (shop ? shop.name : "Unknown Shop")
      };
    });
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    rawAllShops.forEach(s => shopNamesMap[s.id] = s.name);

    const platformSettingsDoc = await adminDb.collection("settings").doc("platform").get();
    if (platformSettingsDoc.exists) {
      isWalletEnabled = platformSettingsDoc.data()?.isWalletEnabled !== false;
    }

  } catch (error) {
    console.error("Error fetching data for Shopper Dashboard:", error);
  }

  return (
    <ShopperDashboardClient 
      allMarkets={allMarkets}
      initialShops={allShops}
      initialAddresses={userAddresses} 
      initialOrders={orders} 
      userCoins={userCoins}
      userMaxShopSlots={userMaxShopSlots}
      initialEmailNotificationsEnabled={emailNotificationsEnabled}
      initialPushNotificationsEnabled={pushNotificationsEnabled}
      shopNamesMap={shopNamesMap}
      isWalletEnabled={isWalletEnabled}
    />
  );
}
