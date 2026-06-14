import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebaseAdmin";
import ShopOwnerDashboardClient from "./ShopOwnerDashboardClient";

export default async function ShopOwnerDashboard() {
  const session = await getServerSession(authOptions);
  
  // Route Protection: Redirect if not logged in or not a shop_owner/admin
  const roles = (session?.user as any)?.roles || [];
  if (!session || (!roles.includes("shop_owner") && !roles.includes("admin"))) {
    redirect("/");
  }

  const userEmail = session.user?.email || "";

  // Fetch shops owned by the user
  let ownedShops: any[] = [];
  let products: any[] = [];
  let markets: any[] = [];
  let orders: any[] = [];
  let initialCoins = 0;
  let userMaxShopSlots = 1;
  
  try {
    const shopSnapshot = await adminDb
      .collection("shops")
      .where("ownerEmail", "==", userEmail)
      .get();
    const serialize = (doc: any) => {
      const data = doc.data();
      return JSON.parse(JSON.stringify({ id: doc.id, ...data }));
    };
      
    ownedShops = shopSnapshot.docs.map(serialize);
    
    // Sort so approved shops appear first, then by date
    ownedShops.sort((a, b) => {
      if (a.status === "approved" && b.status !== "approved") return -1;
      if (a.status !== "approved" && b.status === "approved") return 1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    if (ownedShops.length > 0) {
      const shopIds = ownedShops.map(s => s.id);
      const marketIds = Array.from(new Set(ownedShops.map(s => s.marketId)));
      
      // Fetch markets for these shops
      if (marketIds.length > 0) {
        const marketSnapshot = await adminDb
          .collection("markets")
          .where("id", "in", marketIds)
          .get();
        markets = marketSnapshot.docs.map(serialize);
      }
      
      // Fetch all products for all owned shops
      const productSnapshot = await adminDb
        .collection("products")
        .where("shopId", "in", shopIds)
        .get();
        
      products = productSnapshot.docs.map(serialize);
      products.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      
      // Fetch all orders for all owned shops
      const orderSnapshot = await adminDb
        .collection("orders")
        .where("shopId", "in", shopIds)
        .get();
        
      orders = orderSnapshot.docs.map(serialize);
      orders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }

    // Fetch user coins
    if (userEmail) {
      const userSnap = await adminDb.collection("users").where("email", "==", userEmail).limit(1).get();
      if (!userSnap.empty) {
        const userData = userSnap.docs[0].data();
        initialCoins = userData.coins || 0;
        userMaxShopSlots = Math.max(userData?.maxShopSlots || 0, ownedShops.length);
      }
    }

  } catch (error) {
    console.error("Error fetching data for Shop Owner Dashboard:", error);
  }

  return <ShopOwnerDashboardClient userEmail={userEmail} initialShops={ownedShops} initialProducts={products} initialMarkets={markets} initialOrders={orders} initialCoins={initialCoins} userMaxShopSlots={userMaxShopSlots} />;
}
