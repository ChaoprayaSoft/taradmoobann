import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebaseAdmin";
import MarketShoppingClient from "./MarketShoppingClient";

export const dynamic = "force-dynamic";

export default async function MarketShoppingPage({ params, searchParams }: { params: { marketId: string }, searchParams?: { [key: string]: string | string[] | undefined } }) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/");
  }

  const userEmail = session.user?.email || "";
  const { marketId } = params;

  let isMember = false;
  let marketData: any = null;
  let shops: any[] = [];
  let products: any[] = [];
  let userAccessibleMarkets: any[] = [];
  let activeAds: any[] = [];
  let carouselSpeed = 5;

  try {
    // 1. Verify Market Exists
    const marketDoc = await adminDb.collection("markets").doc(marketId).get();
    if (!marketDoc.exists) {
      redirect("/"); // Market not found
    }
    const shopsCountSnap = await adminDb.collection("shops").where("marketId", "==", marketId).where("status", "==", "approved").count().get();
    const membersCountSnap = await adminDb.collection("market_memberships").where("marketId", "==", marketId).where("status", "==", "approved").count().get();

    marketData = { 
      id: marketDoc.id, 
      ...marketDoc.data(),
      shopsCount: shopsCountSnap.data().count,
      membersCount: membersCountSnap.data().count
    };

    // 2. Check Membership (or if they own a shop in it)
    const memSnapshot = await adminDb
      .collection("market_memberships")
      .where("userEmail", "==", userEmail)
      .where("marketId", "==", marketId)
      .where("status", "==", "approved")
      .get();
    
    if (!memSnapshot.empty) {
      isMember = true;
    }

    if (!isMember) {
      const shopOwnerSnapshot = await adminDb
        .collection("shops")
        .where("ownerEmail", "==", userEmail)
        .where("marketId", "==", marketId)
        .get();
      
      if (!shopOwnerSnapshot.empty) {
        isMember = true;
      }
    }

    // Admins and Market Owners can bypass membership
    const roles = (session.user as any)?.roles || [];
    if (roles.includes("admin") || marketData.ownerEmail === userEmail) {
      isMember = true;
    }

    if (!isMember) {
      redirect("/shopper"); // Not approved to enter, redirect to request page
    }

    // Fetch all markets the user is approved for to populate dropdown
    const allMarketsSnapshot = await adminDb.collection("markets").get();
    const allMarkets = allMarketsSnapshot.docs.map(doc => doc.data());
    
    const allMembershipsSnapshot = await adminDb
      .collection("market_memberships")
      .where("userEmail", "==", userEmail)
      .where("status", "==", "approved")
      .get();
    const allUserMemberships = allMembershipsSnapshot.docs.map(d => d.data());

    const allOwnedShopsSnapshot = await adminDb
      .collection("shops")
      .where("ownerEmail", "==", userEmail)
      .get();
    const allOwnedShops = allOwnedShopsSnapshot.docs.map(d => d.data());

    userAccessibleMarkets = allMarkets.filter(m => {
      if (roles.includes("admin") || m.ownerEmail === userEmail) return true;
      if (allUserMemberships.some(mem => mem.marketId === m.id)) return true;
      if (allOwnedShops.some(shop => shop.marketId === m.id)) return true;
      return false; 
    });

    // 3. Fetch Shops
    const shopsSnapshot = await adminDb
      .collection("shops")
      .where("marketId", "==", marketId)
      .where("status", "==", "approved")
      .get();
      
    shops = shopsSnapshot.docs.map(doc => doc.data());

    // 4. Fetch Products for those shops
    if (shops.length > 0) {
      const shopIds = shops.map(s => s.id);
      // Firestore 'in' query limit is 10. If there are >10 shops, we should chunk it.
      // For now, let's chunk it.
      const chunkArray = (arr: any[], size: number) =>
        Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
          arr.slice(i * size, i * size + size)
        );
      
      const shopChunks = chunkArray(shopIds, 10);
      
      for (const chunk of shopChunks) {
        const prodSnapshot = await adminDb
          .collection("products")
          .where("shopId", "in", chunk)
          .get();
          
        products.push(...prodSnapshot.docs.map(doc => {
          const productData = doc.data();
          const shop = shops.find(s => s.id === productData.shopId);
          return {
            ...productData,
            shopName: shop ? shop.name : "Unknown Shop"
          };
        }));
      }
    }

    // 5. Fetch Active Ads for Carousel
    const settingsDoc = await adminDb.collection("settings").doc("ads").get();
    const maxAds = settingsDoc.exists ? (settingsDoc.data()?.maxAds || 3) : 3;
    if (settingsDoc.exists && settingsDoc.data()?.carouselSpeed) {
      carouselSpeed = settingsDoc.data()!.carouselSpeed;
    }

    const adsSnapshot = await adminDb.collection("ads").where("status", "==", "ON").get();
    const todayStr = new Date().toISOString().split('T')[0];
    
    let fetchedAds = adsSnapshot.docs
      .map(doc => doc.data())
      .filter(ad => ad.validUntil >= todayStr && ad.placement === "Market Page");

    if (fetchedAds.length === 0) {
      fetchedAds = [
        { id: "mock1", title: "Fresh Organic Produce", description: "Get the freshest organic fruits and vegetables delivered to your door.", imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80", linkUrl: "https://example.com" },
        { id: "mock2", title: "Local Bakery Deals", description: "Buy 1 get 1 free on all artisan breads today only!", imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80", linkUrl: "https://example.com" },
        { id: "mock3", title: "Weekend Night Market", description: "Join us this weekend for live music, street food, and local crafts.", imageUrl: "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&w=600&q=80", linkUrl: "https://example.com" }
      ];
    } else {
      fetchedAds = fetchedAds.sort(() => 0.5 - Math.random()).slice(0, maxAds);
    }
    
    activeAds = fetchedAds;

  } catch (error) {
    console.error("Error loading market shopping page:", error);
  }

  const initialShopId = searchParams?.shopId && typeof searchParams.shopId === 'string' ? searchParams.shopId : null;

  return (
    <MarketShoppingClient 
      market={marketData} 
      shops={shops} 
      products={products} 
      userAccessibleMarkets={userAccessibleMarkets}
      initialShopId={initialShopId}
      activeAds={activeAds}
      carouselSpeed={carouselSpeed}
    />
  );
}
