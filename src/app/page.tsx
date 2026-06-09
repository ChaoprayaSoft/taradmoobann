import { adminDb } from "@/lib/firebaseAdmin";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import AdsSection from "@/components/AdsSection";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email || "";

  let markets: any[] = [];
  let marketStatusMap = new Map<string, string>();
  let activeAds: any[] = [];
  let spotlightProducts: any[] = [];

  try {
    const snapshot = await adminDb.collection("markets").get();
    markets = snapshot.docs.map(doc => doc.data());
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
          <span>Welcome to</span>
          <div className="bg-brand-50 p-2 sm:p-3 rounded-2xl shadow-sm">
            <Logo className="w-10 h-10 sm:w-14 sm:h-14 text-brand-600" />
          </div>
          <span className="text-brand-600">TaradMooBann</span>
        </h1>
      </div>
      <p className="text-lg sm:text-xl text-gray-600 max-w-2xl">
        Your local neighborhood online market. Discover local shops, and get notified when your favorite vendors open.
      </p>

      <div className="w-full mt-12 text-left">
        {spotlightProducts.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-6 px-4">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-yellow-500">
                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
              </svg>
              <h2 className="text-2xl font-bold text-gray-900">Spotlight Products</h2>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 px-4">
              {spotlightProducts.map(product => (
                <div key={product.id} className="bg-white rounded-xl shadow-sm border border-yellow-200 overflow-hidden hover:shadow-md transition relative flex flex-col group">
                  <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full z-10 shadow-sm flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                      <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                    </svg>
                    Spotlight
                  </div>
                  
                  {product.imageUrl || (product.imageUrls && product.imageUrls.length > 0) ? (
                    <img 
                      src={product.imageUrl || product.imageUrls[0]} 
                      alt={product.name} 
                      className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                  ) : (
                    <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-gray-200 transition-colors">
                      No Image
                    </div>
                  )}
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-gray-900 line-clamp-1">{product.name}</h3>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mt-0.5">In {product.marketName}</p>
                    <p className="text-brand-600 font-bold mt-1">฿{product.price}</p>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-2 flex-1">{product.description}</p>
                    <Link href={`/shopper`} className="mt-3 block text-center text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline">
                      View in Market &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-2xl font-bold text-gray-900 mb-6 px-4">Discover Local Markets</h2>
        {markets.length === 0 ? (
          <div className="text-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-gray-500">No markets have been created yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {markets.map(market => {
              const status = marketStatusMap.get(market.id);

              return (
                <div key={market.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition flex flex-col">
                  {market.coverImage ? (
                    <img src={market.coverImage} alt={market.name} className="w-full h-48 object-cover" />
                  ) : (
                    <div className="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-400">
                      No Image
                    </div>
                  )}
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-bold text-xl text-gray-900">{market.name}</h3>
                    <p className="text-gray-600 text-sm mt-2 line-clamp-2 flex-1">{market.description}</p>

                    {status === "approved" && (
                      <Link href={`/market/${market.id}`} className="mt-4 block w-full text-center bg-green-600 text-white font-medium py-2 rounded-md hover:bg-green-700 transition">
                        Enter Market
                      </Link>
                    )}

                    {status === "pending" && (
                      <Link href="/shopper" className="mt-4 block w-full text-center bg-yellow-100 text-yellow-800 font-medium py-2 rounded-md hover:bg-yellow-200 transition">
                        Pending Approval
                      </Link>
                    )}

                    {status === "needs_revision" && (
                      <Link href="/shopper" className="mt-4 block w-full text-center bg-red-100 text-red-800 font-medium py-2 rounded-md hover:bg-red-200 transition">
                        Needs Revision
                      </Link>
                    )}

                    {!status && (
                      <Link href="/shopper" className="mt-4 block w-full text-center bg-brand-50 text-brand-700 font-medium py-2 rounded-md hover:bg-brand-100 transition">
                        Request to Enter
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AdsSection ads={activeAds} />
    </div>
  );
}
