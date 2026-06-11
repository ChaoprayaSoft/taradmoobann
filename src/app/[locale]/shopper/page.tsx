import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebaseAdmin";
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

  try {
    const marketSnapshot = await adminDb.collection("markets").get();
    allMarkets = marketSnapshot.docs.map(doc => doc.data());
    allMarkets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const allShopsSnapshot = await adminDb.collection("shops").get();
    allShops = allShopsSnapshot.docs.map(doc => doc.data());

    // Fetch user's memberships
    const membershipSnapshot = await adminDb
      .collection("market_memberships")
      .where("userEmail", "==", userEmail)
      .get();
    
    memberships = membershipSnapshot.docs.map(doc => doc.data());

    // Fetch user's shops
    const shopsSnapshot = await adminDb
      .collection("shops")
      .where("ownerEmail", "==", userEmail)
      .get();
    
    const ownedShops = shopsSnapshot.docs.map(doc => doc.data());

    // Automatically grant "approved" membership for any market where the user owns a shop
    ownedShops.forEach(shop => {
      // Check if they already have an explicit membership for this market
      const existingMembership = memberships.find(m => m.marketId === shop.marketId);
      
      if (!existingMembership) {
        // Create an implicit approved membership
        memberships.push({
          id: `implicit_shop_owner_${shop.id}`,
          marketId: shop.marketId,
          userEmail,
          status: "approved",
          applicationNote: "Auto-approved as a Shop Owner",
          createdAt: shop.createdAt,
        });
      } else if (existingMembership.status !== "approved") {
        // Upgrade existing membership to approved
        existingMembership.status = "approved";
        existingMembership.applicationNote = "Auto-approved as a Shop Owner";
      }
    });

    // Fetch user's profile/addresses
    const userProfileSnapshot = await adminDb.collection("users").doc(userEmail).get();
    if (userProfileSnapshot.exists) {
      const data = userProfileSnapshot.data();
      userAddresses = data?.addresses || [];
      if (data?.address && userAddresses.length === 0) {
        userAddresses = [data.address]; // Fallback for old single address format
      }
      userCoins = data?.coins || 0;
      userMaxShopSlots = data?.maxShopSlots !== undefined && data.maxShopSlots < 2 
        ? data.maxShopSlots + 1 
        : (data?.maxShopSlots || 1);
      emailNotificationsEnabled = data?.emailNotificationsEnabled !== false;
      pushNotificationsEnabled = data?.pushNotificationsEnabled !== false;
    }

    // Fetch user's orders
    const orderSnapshot = await adminDb
      .collection("orders")
      .where("shopperEmail", "==", userEmail)
      .get();
      
    orders = orderSnapshot.docs.map(doc => doc.data());
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  } catch (error) {
    console.error("Error fetching data for Shopper Dashboard:", error);
  }

  return (
    <ShopperDashboardClient 
      allMarkets={allMarkets}
      initialShops={allShops}
      memberships={memberships} 
      initialAddresses={userAddresses} 
      initialOrders={orders} 
      userCoins={userCoins}
      userMaxShopSlots={userMaxShopSlots}
      initialEmailNotificationsEnabled={emailNotificationsEnabled}
      initialPushNotificationsEnabled={pushNotificationsEnabled}
    />
  );
}
