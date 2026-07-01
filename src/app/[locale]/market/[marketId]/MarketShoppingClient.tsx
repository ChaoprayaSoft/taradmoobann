"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ProductCard from "@/components/ProductCard";
import ShopperShopChatModal from "@/components/ShopperShopChatModal";
import AdsCarousel from "@/components/AdsCarousel";
import { useTranslations } from "next-intl";

export default function MarketShoppingClient({
  market,
  shops,
  products,
  userAccessibleMarkets = [],
  initialShopId,
  activeAds = [],
  carouselSpeed = 5
}: {
  market: any;
  shops: any[];
  products: any[];
  userAccessibleMarkets?: any[];
  initialShopId?: string | null;
  activeAds?: any[];
  carouselSpeed?: number;
}) {
  const router = useRouter();
  const t = useTranslations("MarketShopping");
  const defaultShopId = initialShopId && shops.some(s => s.id === initialShopId) 
    ? initialShopId 
    : "spotlight";
  const [selectedShopId, setSelectedShopId] = useState<string | null>(defaultShopId);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState(t("allCategories"));
  const [shopFilterStatus, setShopFilterStatus] = useState("all");
  const { data: session } = useSession();
  const [showSignInModal, setShowSignInModal] = useState(false);

  const [localMarket, setLocalMarket] = useState(market);
  const [localShops, setLocalShops] = useState(shops);
  const [localProducts, setLocalProducts] = useState(products);

  // Sync props to state on navigation
  useEffect(() => {
    setLocalMarket(market);
    setLocalShops(shops);
    setLocalProducts(products);
  }, [market, shops, products]);

  useEffect(() => {
    if (!market?.id) return;

    // Listen to Market
    const unsubMarket = onSnapshot(doc(db, "markets", market.id), (docSnapshot) => {
      if (docSnapshot.exists()) {
        setLocalMarket((prev: any) => ({ 
          id: docSnapshot.id, 
          ...docSnapshot.data(),
          shopsCount: market.shopsCount,
          membersCount: market.membersCount
        }));
      }
    });

    // Listen to Shops
    const shopsQ = query(collection(db, "shops"), where("marketId", "==", market.id), where("status", "==", "approved"));
    const unsubShops = onSnapshot(shopsQ, (snap) => {
      const freshShops: any[] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      setLocalShops(prev => freshShops.map(fs => {
        const existing = prev.find(p => p.id === fs.id);
        return { ...fs, averageRating: existing?.averageRating };
      }));
    });

    return () => {
      unsubMarket();
      unsubShops();
    };
  }, [market?.id]);

  const shopIdsStr = localShops.map(s => s.id).sort().join(',');

  useEffect(() => {
    if (!shopIdsStr) return;
    const shopIds = shopIdsStr.split(',');
    const chunkArray = (arr: any[], size: number) =>
      Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
    const chunks = chunkArray(shopIds, 10);
    
    const unsubs = chunks.map(chunk => {
      const prodQ = query(collection(db, "products"), where("shopId", "in", chunk));
      return onSnapshot(prodQ, (snap) => {
        const freshProds: any[] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        setLocalProducts(prev => {
          const others = prev.filter((p: any) => !chunk.includes(p.shopId));
          // add shopName for UI
          const updated = freshProds.map(fp => {
            const shop = localShops.find(s => s.id === fp.shopId);
            return { ...fp, shopName: shop?.name || t("unknownShop") };
          });
          return [...others, ...updated];
        });
      });
    });

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [shopIdsStr]); // localShops is updated in another effect, shopIdsStr tracks exact list
  // Reviews state
  const [shopReviews, setShopReviews] = useState<any[]>([]);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);

  useEffect(() => {
    if (selectedShopId) {
      fetch(`/api/public/reviews?shopId=${selectedShopId}`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            setShopReviews(data);
            if (data.length > 0) {
              const calculatedRating = (data.reduce((acc: any, r: any) => acc + r.rating, 0) / data.length);
              setLocalShops(prev => prev.map(s => s.id === selectedShopId ? { ...s, averageRating: calculatedRating } : s));
            }
          }
        })
        .catch(e => console.error(e));
    }
  }, [selectedShopId]);

  const averageRating = shopReviews.length > 0 
    ? (shopReviews.reduce((acc, r) => acc + r.rating, 0) / shopReviews.length).toFixed(1) 
    : null;

  const selectedShop = localShops.find(s => s.id === selectedShopId);
  
  const handleShareShop = async (shop: any) => {
    if (!session) {
      setShowSignInModal(true);
      return;
    }
    const shareUrl = `${window.location.origin}/market/${market.id}?shopId=${shop.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: shop.name,
          text: t("checkOutShop", { shopName: shop.name }),
          url: shareUrl,
        });
        return; // Success with native share
      } catch (err) {
        console.error("Error sharing:", err);
        // Fallback to clipboard if share was aborted/failed
      }
    }
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert(t("linkCopied", { defaultValue: "Link copied to clipboard!" }));
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  // Extract all unique tags across all products for the category filter
  const allTags = Array.from(new Set(localProducts.flatMap((p: any) => p.tags || []))).sort();
  const filterOptions = [t("allCategories"), ...allTags];

  // If a search or tag filter is active, we bypass the single shop view
  const isGlobalSearch = searchQuery.trim() !== "" || selectedTag !== t("allCategories");

  const displayedProducts = isGlobalSearch 
    ? localProducts.filter((p: any) => {
        const matchesQuery = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             p.description?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTag = selectedTag === t("allCategories") || (p.tags && p.tags.includes(selectedTag));
        const available = p.isAvailable === undefined || p.isAvailable;
        return matchesQuery && matchesTag && available;
      })
    : selectedShopId === "spotlight"
      ? localProducts.filter((p: any) => p.isSpotlight && p.spotlightExpiry && new Date(p.spotlightExpiry) > new Date() && (p.isAvailable === undefined || p.isAvailable))
      : localProducts.filter((p: any) => p.shopId === selectedShopId && (p.isAvailable === undefined || p.isAvailable));

  const displayedShops = localShops.filter(s => {
    if (shopFilterStatus === "all") return true;
    if (shopFilterStatus === "open") return s.operatingStatus !== "closed";
    if (shopFilterStatus === "closed") return s.operatingStatus === "closed";
    return true;
  });

  if (!localMarket) return <div>{t("marketNotFound")}</div>;

  return (
    <div className="space-y-6">
      {/* Market Navigation Buttons */}
      {userAccessibleMarkets.length > 1 && (
        <div className="flex flex-wrap justify-end gap-2 mb-4 items-center">
          <span className="text-sm font-medium text-gray-500 mr-2">{t("switchMarket")}</span>
          {userAccessibleMarkets.map(m => (
            <button
              key={m.id}
              onClick={() => {
                if (m.id !== market.id) {
                  router.push(`/market/${m.id}`);
                }
              }}
              disabled={m.id === market.id}
              className={`px-4 py-2 rounded-full text-sm font-medium transition shadow-sm border ${
                m.id === market.id 
                  ? "bg-brand-600 text-white border-brand-600 cursor-default" 
                  : "bg-white text-gray-700 border-gray-200 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}

      {/* Market Header */}
      <div className="relative bg-gray-900 rounded-xl overflow-hidden shadow-lg border border-gray-800">
        <div className="absolute inset-0">
          {localMarket.coverImage && (
            <img 
              src={localMarket.coverImage} 
              alt={localMarket.name} 
              className="w-full h-full object-cover opacity-40"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent"></div>
        </div>
        
        <div className="relative px-6 py-10 md:py-14 md:px-10 flex flex-col md:flex-row items-center md:items-end justify-between gap-6">
          <div className="text-center md:text-left text-white max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2">
              {localMarket.name}
            </h1>
            <p className="text-gray-300 text-lg mb-4">
              {localMarket.description}
            </p>
            <div className="flex items-center justify-center md:justify-start gap-5 text-sm font-medium text-gray-400">
              <div className="flex items-center gap-1.5" title="Approved Shops">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                </svg>
                <span>{t("shopsCount", { count: market.shopsCount || 0 })}</span>
              </div>

            </div>
          </div>
          
          <div className="flex flex-col items-center md:items-end space-y-3">
            <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold shadow-sm ${
              localMarket.operatingStatus === "closed" 
                ? "bg-red-500/20 text-red-300 border border-red-500/50" 
                : "bg-green-500/20 text-green-300 border border-green-500/50"
            }`}>
              <span className={`w-2 h-2 rounded-full mr-2 ${localMarket.operatingStatus === "closed" ? "bg-red-400" : "bg-green-400 animate-pulse"}`}></span>
              {localMarket.operatingStatus === "closed" ? t("marketClosed") : t("marketOpen")}
            </span>
          </div>
        </div>
      </div>

      {/* Global Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 sm:text-sm"
            placeholder={t("searchProducts")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full md:w-64">
          <select
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm rounded-lg"
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
          >
            {filterOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Shops Sidebar */}
        <div className="w-full md:w-1/3 lg:w-1/4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sticky top-6">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h2 className="text-lg font-bold text-gray-900">{t("shopsInMarket")}</h2>
              <select
                className="text-xs border-gray-300 shadow-sm border rounded p-1 focus:ring-brand-500 focus:border-brand-500"
                value={shopFilterStatus}
                onChange={(e) => setShopFilterStatus(e.target.value)}
              >
                <option value="all">{t("all")}</option>
                <option value="open">{t("open")}</option>
                <option value="closed">{t("closed")}</option>
              </select>
            </div>
            {displayedShops.length === 0 ? (
              <div className="p-6 text-center text-gray-500">{t("noShopsMatching")}</div>
            ) : (
              <ul className="p-2 space-y-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 400px)" }}>
                <li className="mb-2">
                  <button
                    onClick={() => setSelectedShopId("spotlight")}
                    className={`w-full text-left px-4 py-3 rounded-lg transition border flex items-center space-x-3 ${
                      selectedShopId === "spotlight" 
                        ? "bg-yellow-50 border-yellow-200 text-yellow-800 shadow-sm" 
                        : "bg-white border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-200"
                    }`}
                  >
                    <div className="w-8 h-8 rounded bg-yellow-100 flex items-center justify-center text-yellow-500 flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" clipRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" />
                      </svg>
                    </div>
                    <div className="truncate w-full">
                      <p className="font-bold text-sm truncate">{t("spotlightProducts")}</p>
                      <p className="text-xs opacity-80 truncate">{t("topPicks")}</p>
                    </div>
                  </button>
                </li>
                <div className="border-t border-gray-100 my-1 pt-1" />
                {displayedShops.map(shop => (
                  <li key={shop.id}>
                    <button
                      onClick={() => setSelectedShopId(shop.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition border flex items-center space-x-3 ${
                        selectedShopId === shop.id 
                          ? "bg-brand-50 border-brand-200 text-brand-800 shadow-sm" 
                          : "bg-white border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-200"
                      }`}
                    >
                      {shop.coverImage ? (
                        <img src={shop.coverImage} alt={shop.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0">
                          {shop.name.charAt(0)}
                        </div>
                      )}
                      <div className="truncate w-full">
                        <div className="flex justify-between items-center w-full gap-2">
                          <p className="font-semibold text-sm truncate">{shop.name}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            shop.operatingStatus === 'closed' ? 'bg-red-100 text-red-800' :
                            shop.operatingStatus === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {shop.operatingStatus === 'closed' ? t("closed") :
                             shop.operatingStatus === 'scheduled' ? t("scheduled") : t("open")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs opacity-80 truncate">{shop.category}</p>
                          <div className="flex items-center text-yellow-500 text-[10px] font-bold gap-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                              <path fillRule="evenodd" clipRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" />
                            </svg>
                            {shop.averageRating ? Number(shop.averageRating).toFixed(1) : t("new")}
                          </div>
                        </div>
                        {(shop.houseNumber || shop.location) && (
                          <p className="text-[10px] text-gray-500 mt-1 truncate text-left flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 shrink-0">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                            </svg>
                            <span className="truncate">
                              {shop.houseNumber && <span>No. {shop.houseNumber}</span>}
                              {shop.houseNumber && shop.location && <span>, </span>}
                              {shop.location && <span>{shop.location}</span>}
                            </span>
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Products Grid */}
        <div className="w-full md:w-2/3 lg:w-3/4">
          {/* Content Area */}
          {localMarket.operatingStatus === "closed" ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("marketIsCurrentlyClosed")}</h2>
              <p className="text-gray-500 max-w-md mx-auto">
                {t("marketClosedDesc", { name: localMarket.name })}
              </p>
            </div>
          ) : isGlobalSearch ? (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">{t("searchResults")}</h2>
                <p className="text-gray-500 mt-1">{t("foundItems", { count: displayedProducts.length })}</p>
              </div>

              {displayedProducts.length === 0 ? (
                <div className="text-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-gray-500">{t("noProductsFound")}</p>
                  <button 
                    onClick={() => { setSearchQuery(""); setSelectedTag(t("allCategories")); }}
                    className="mt-4 text-brand-600 font-medium hover:underline"
                  >
                    {t("clearFilters")}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayedProducts.map((product: any) => {
                    const shop = localShops.find((s: any) => s.id === product.shopId);
                    return (
                      <ProductCard 
                        key={product.id} 
                        product={product} 
                        shopName={shop?.name} 
                        isClosed={shop?.operatingStatus === 'closed'} 
                        shopHouseNumber={shop?.houseNumber}
                        shopLocation={shop?.location}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ) : selectedShopId === "spotlight" ? (
            <div className="space-y-6">
              <div className="bg-yellow-50 p-6 rounded-xl shadow-sm border border-yellow-200">
                <h2 className="text-2xl font-bold text-yellow-900 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-yellow-500">
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" />
                  </svg>
                  {t("spotlightProducts")}
                </h2>
                <p className="text-yellow-800 mt-1">{t("highlightedItems")}</p>
              </div>

              {displayedProducts.length === 0 ? (
                <div className="text-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-gray-500">{t("noSpotlightProducts")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayedProducts.map((product: any) => {
                    const shop = localShops.find((s: any) => s.id === product.shopId);
                    return (
                      <ProductCard 
                        key={product.id} 
                        product={product} 
                        shopName={shop?.name} 
                        isClosed={shop?.operatingStatus === 'closed'} 
                        shopHouseNumber={shop?.houseNumber}
                        shopLocation={shop?.location}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ) : selectedShop ? (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-900">{selectedShop.name}</h2>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      selectedShop.operatingStatus === 'closed' ? 'bg-red-100 text-red-800' :
                      selectedShop.operatingStatus === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {selectedShop.operatingStatus === 'closed' ? t("closedCaps") :
                       selectedShop.operatingStatus === 'scheduled' ? t("validUntil", { dates: selectedShop.validDates }) :
                       t("openCaps")}
                    </span>
                  </div>
                  <p className="text-gray-600 mt-1">{selectedShop.description || t("welcomeShop")}</p>
                  
                  {/* Reviews Summary */}
                  <div className="mt-2 flex items-center gap-2">
                    {averageRating ? (
                      <button 
                        onClick={() => setShowReviewsModal(true)}
                        className="flex items-center gap-1 bg-yellow-50 hover:bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm font-medium transition"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-yellow-500">
                          <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                        </svg>
                        {t("ratingWithCount", { rating: averageRating, count: shopReviews.length })}
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-sm text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                        {t("noReviewsYet")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="bg-brand-100 text-brand-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    {selectedShop.category}
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-2 mt-1">
                    <button
                      onClick={() => handleShareShop(selectedShop)}
                      className="flex items-center gap-1 bg-orange-100 hover:bg-orange-200 text-orange-800 px-3 py-1.5 rounded text-sm font-medium transition"
                      title={t("shareShop")}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                      </svg>
                      {t("shareShop", { defaultValue: "Share this shop" })}
                    </button>
                    <button
                      onClick={() => {
                        if (!session) {
                          setShowSignInModal(true);
                        } else {
                          setShowChatModal(true);
                        }
                      }}
                      className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded text-sm font-medium transition"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                      </svg>
                      {t("chatWithShop")}
                    </button>
                  </div>
                </div>
              </div>

              {displayedProducts.length === 0 ? (
                <div className="text-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-gray-500">{t("shopNoProducts")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayedProducts.map(product => (
                    <ProductCard 
                      key={product.id} 
                      product={product} 
                      isClosed={selectedShop.operatingStatus === 'closed'} 
                      shopHouseNumber={selectedShop?.houseNumber}
                      shopLocation={selectedShop?.location}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200 h-full flex flex-col items-center justify-center">
              <h2 className="text-xl font-semibold text-gray-700 mb-2">{t("selectShop")}</h2>
              <p className="text-gray-500">{t("chooseShopSidebar")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Reviews Modal */}
      {showReviewsModal && selectedShop && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-900">{t("reviewsFor", { name: selectedShop.name })}</h3>
              <button 
                onClick={() => setShowReviewsModal(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              {shopReviews.length === 0 ? (
                <p className="text-gray-500 text-center">{t("noReviewsYetPeriod")}</p>
              ) : (
                shopReviews.map(review => (
                  <div key={review.id} className="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{review.shopperEmail}</p>
                        <p className="text-xs text-gray-500">{new Date(review.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex text-yellow-400">
                        {[1, 2, 3, 4, 5].map(star => (
                          <svg key={star} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={star <= review.rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.comment}</p>
                    )}
                    {review.ownerReply && (
                      <div className="mt-3 bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm">
                        <p className="font-bold text-gray-900 text-xs mb-1">{t("replyFromShopOwner")}</p>
                        <p className="text-gray-700">{review.ownerReply}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button 
                onClick={() => setShowReviewsModal(false)}
                className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedShop && (
        <ShopperShopChatModal 
          isOpen={showChatModal} 
          onClose={() => setShowChatModal(false)} 
          shopId={selectedShop.id} 
          shopName={selectedShop.name} 
        />
      )}

      {/* ADS CAROUSEL */}
      {activeAds && activeAds.length > 0 && (
        <div className="mt-8 border-t border-gray-200 pt-4">
          <AdsCarousel ads={activeAds} speed={carouselSpeed} />
        </div>
      )}

      {/* SIGN IN PROMPT MODAL */}
      {showSignInModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-2">{t("signInRequired")}</h3>
            <p className="text-sm text-gray-500 mb-6">{t("signInPromptDesc")}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowSignInModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition font-medium text-sm"
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => signIn("google")}
                className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 transition font-medium text-sm"
              >
                {t("signIn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
