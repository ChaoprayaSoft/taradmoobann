import { adminDb } from "@/lib/firebaseAdmin";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import AdsSection from "@/components/AdsSection";
import Logo from "@/components/Logo";
import HomePageMarketsClient from "./HomePageMarketsClient";

import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const t = await getTranslations("HomePage");
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email || "";

  let markets: any[] = [];
  let marketStatusMap = new Map<string, string>();
  let activeAds: any[] = [];
  let spotlightProducts: any[] = [];

  try {
    const snapshot = await adminDb.collection("markets").get();
    markets = await Promise.all(snapshot.docs.map(async doc => {
      const data = doc.data();
      const mId = doc.id;
      const shopsCountSnap = await adminDb.collection("shops").where("marketId", "==", mId).where("status", "==", "approved").count().get();
      const membersCountSnap = await adminDb.collection("market_memberships").where("marketId", "==", mId).where("status", "==", "approved").count().get();
      return {
        id: mId,
        ...data,
        shopsCount: shopsCountSnap.data().count,
        membersCount: membersCountSnap.data().count
      };
    }));
    // Sort by newest
    markets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (userEmail) {
      // Fetch all memberships for user
      const memSnapshot = await adminDb
        .collection("market_memberships")
        .where("userEmail", "==", userEmail)
        .get();

      memSnapshot.docs.forEach(doc => {
        const data = doc.data();
        marketStatusMap.set(data.marketId, data.status);
      });

      // Fetch owned shops (implicit membership -> approved)
      const shopsSnapshot = await adminDb
        .collection("shops")
        .where("ownerEmail", "==", userEmail)
        .get();

      shopsSnapshot.docs.forEach(doc => {
        marketStatusMap.set(doc.data().marketId, "approved");
      });
    }

    // Fetch Ads and Ads Settings
    const settingsDoc = await adminDb.collection("settings").doc("ads").get();
    const maxAds = settingsDoc.exists ? (settingsDoc.data()?.maxAds || 3) : 3;

    const adsSnapshot = await adminDb.collection("ads").where("status", "==", "ON").get();
    const todayStr = new Date().toISOString().split('T')[0];

    let fetchedAds = adsSnapshot.docs
      .map(doc => doc.data())
      .filter(ad => ad.validUntil >= todayStr && (!ad.placement || ad.placement === "Main Page"));

    // If no ads exist, inject mock ads automatically as requested
    if (fetchedAds.length === 0) {
      fetchedAds = [
        { id: "mock1", title: "Fresh Organic Produce", description: "Get the freshest organic fruits and vegetables delivered to your door.", imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80", linkUrl: "https://example.com" },
        { id: "mock2", title: "Local Bakery Deals", description: "Buy 1 get 1 free on all artisan breads today only!", imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80", linkUrl: "https://example.com" },
        { id: "mock3", title: "Weekend Night Market", description: "Join us this weekend for live music, street food, and local crafts.", imageUrl: "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&w=600&q=80", linkUrl: "https://example.com" }
      ];
    } else {
      // Shuffle and limit ads
      fetchedAds = fetchedAds.sort(() => 0.5 - Math.random()).slice(0, maxAds);
    }

    activeAds = fetchedAds;

    // Fetch Spotlight Products
    const spotlightSnapshot = await adminDb
      .collection("products")
      .where("isSpotlight", "==", true)
      .get();

    spotlightProducts = spotlightSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as any))
      .filter(p => p.spotlightExpiry && new Date(p.spotlightExpiry) > new Date());

    // Sort spotlight products randomly
    spotlightProducts = spotlightProducts.sort(() => 0.5 - Math.random()).slice(0, 8);

    if (spotlightProducts.length > 0) {
      const shopIds = Array.from(new Set(spotlightProducts.map(p => p.shopId)));
      if (shopIds.length > 0) {
        const shopDocs = await Promise.all(shopIds.map(id => adminDb.collection("shops").doc(id).get()));
        const shopMap = new Map();
        shopDocs.forEach(doc => {
          if (doc.exists) {
            shopMap.set(doc.id, doc.data());
          }
        });

        spotlightProducts = spotlightProducts.map(p => {
          const shop = shopMap.get(p.shopId);
          // markets was mapped as doc.data(), assuming id was included if it's there. 
          // Wait, if 'id' wasn't natively in the document, we should find by doc id.
          // Let's just find where id matches marketId or name.
          const market = markets.find(m => m.id === shop?.marketId);
          return {
            ...p,
            marketId: market?.id || "",
            marketName: market?.name || "Local Market"
          };
        });
      }
    }

  } catch (error) {
    console.error("Failed to load markets for homepage:", error);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8">
      <div className="flex flex-col items-center mt-12 mb-2">
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-gray-900 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          <span>{t('welcome')}</span>
          <div className="bg-brand-50 p-2 sm:p-3 rounded-2xl shadow-sm">
            <Logo className="w-10 h-10 sm:w-14 sm:h-14 text-brand-600" />
          </div>
          <span className="text-brand-600">TaradMooBann</span>
        </h1>
      </div>
      <p className="text-lg sm:text-xl text-gray-600 max-w-2xl">
        {t('description')}
      </p>

      <HomePageMarketsClient 
        markets={markets} 
        userEmail={userEmail}
        spotlightProducts={spotlightProducts}
      />

      <AdsSection ads={activeAds} />
    </div>
  );
}
