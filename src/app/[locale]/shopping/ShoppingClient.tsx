"use client";

import { useState, useTransition, TouchEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";

import ProductCard from "@/components/ProductCard";

import HomePageMarketsClient from "../HomePageMarketsClient";
import AdsCarousel from "@/components/AdsCarousel";

export default function ShoppingClient({ 
  markets, 
  userVillageName,
  userEmail,
  whatsUpTodayProducts = [],
  nearbyProducts = [],
  activeAds = [],
  spotlightProducts = []
}: { 
  markets: any[], 
  userVillageName: string,
  userEmail: string | null,
  whatsUpTodayProducts?: any[],
  nearbyProducts?: any[],
  activeAds?: any[],
  spotlightProducts?: any[]
}) {
  const router = useRouter();
  const t = useTranslations("Shopping");
  const displayMarkets = markets;
  const [showSignInModal, setShowSignInModal] = useState(false);

  // Pull to Refresh State
  const [isPending, startTransition] = useTransition();
  const [pullStartY, setPullStartY] = useState(0);
  const [pullMoveY, setPullMoveY] = useState(0);

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (window.scrollY === 0) {
      setPullStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (pullStartY > 0 && window.scrollY === 0) {
      const y = e.touches[0].clientY;
      if (y > pullStartY) {
        setPullMoveY(y - pullStartY);
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullMoveY > 100 && !isPending) {
      handleRefresh();
    }
    setPullStartY(0);
    setPullMoveY(0);
  };

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const handleEnterMarket = (e: React.MouseEvent, marketId: string) => {
    e.preventDefault();
    router.push(`/market/${marketId}`);
  };

  const navigateToProduct = (marketId: string, shopId: string) => {
    router.push(`/market/${marketId}?shopId=${shopId}`);
  };

  return (
    <div 
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull down indicator */}
      <div 
        className="w-full flex justify-center items-center overflow-hidden transition-all duration-200"
        style={{ height: pullMoveY > 0 ? Math.min(pullMoveY, 80) : 0 }}
      >
        {pullMoveY > 100 ? (
          <span className="text-sm font-bold text-gray-500">Release to refresh...</span>
        ) : (
          <span className="text-sm text-gray-400">Pull down to refresh</span>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">{t("yourLocalMarkets")}</h1>
          <button 
            onClick={handleRefresh}
            disabled={isPending}
            className="p-2 text-gray-400 hover:text-brand-600 bg-gray-50 hover:bg-brand-50 rounded-full transition-colors focus:outline-none"
            title="Refresh Market Data"
          >
            <svg className={`w-5 h-5 ${isPending ? 'animate-spin text-brand-600' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
      </div>

      {/* Spotlight Products Section */}
      {spotlightProducts && spotlightProducts.length > 0 && (
        <div className="w-full mt-12 mb-12 text-left">
          <div className="flex items-center gap-2 mb-6 px-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-yellow-500">
              <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900">{t("spotlightProducts") || "Spotlight Products"}</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 px-4">
            {spotlightProducts.map(product => {
              return (
                <div key={product.id} className="bg-white rounded-xl shadow-sm border border-yellow-200 overflow-hidden hover:shadow-md transition relative flex flex-col group">
                  <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full z-10 shadow-sm flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                      <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                    </svg>
                    {t("spotlight") || "Spotlight"}
                  </div>

                  {product.imageUrl || (product.imageUrls && product.imageUrls.length > 0) ? (
                    <img
                      src={product.imageUrl || product.imageUrls[0]}
                      alt={product.name}
                      className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                      onClick={(e) => product.marketId && handleEnterMarket(e, product.marketId)}
                    />
                  ) : (
                    <div 
                      className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-gray-200 transition-colors cursor-pointer"
                      onClick={(e) => product.marketId && handleEnterMarket(e, product.marketId)}
                    >
                      {t("noImage") || "No Image"}
                    </div>
                  )}
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-gray-900 line-clamp-1">{product.name}</h3>
                    {product.shopName && <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mt-0.5">From: {product.shopName}</p>}
                    {product.villageName && <p className="text-[10px] uppercase tracking-wider text-brand-600 font-bold mt-0.5">{product.villageName}</p>}
                    <p className="text-brand-600 font-bold mt-1">฿{product.price}</p>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-2 flex-1">{product.description}</p>
                    
                    {product.marketId && (
                      <button 
                        onClick={(e) => handleEnterMarket(e, product.marketId)}
                        className="mt-3 block text-center text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
                      >
                        {t("viewInMarket") || "View in Market"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* What's up today Section */}
      <div className="mt-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{t("whatsUpToday")}</h2>
          {userEmail && userVillageName && whatsUpTodayProducts.length > 0 && (
            <button
              onClick={(e) => handleEnterMarket(e, whatsUpTodayProducts[0].marketId)}
              className="text-sm bg-brand-100 hover:bg-brand-200 text-brand-800 font-bold py-1.5 px-4 rounded transition whitespace-nowrap"
            >
              {t("enterMarket") || "Enter Market"}
            </button>
          )}
        </div>
        {userEmail ? (
          userVillageName ? (
            whatsUpTodayProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {whatsUpTodayProducts.map(product => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  shopName={product.shopName}
                  villageName={product.villageName}
                  onClickProduct={() => navigateToProduct(product.marketId, product.shopId)}
                />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">{t("noWhatsUpToday")}</p>
            )
          ) : (
            <p className="text-gray-500 text-sm">{t("noVillageSet")}</p>
          )
        ) : (
          <div className="text-center bg-gray-50 p-8 rounded-xl border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-2">{t("signInToSeeSpecials")}</h3>
            <p className="text-gray-500 mb-6">{t("signInToSeeSpecialsDesc")}</p>
            <button
              onClick={() => signIn("google")}
              className="bg-brand-600 text-white px-6 py-2 rounded-md font-medium hover:bg-brand-700 transition"
            >
              {t("signIn")}
            </button>
          </div>
        )}
      </div>

      {/* Nearby Neighborhood Section */}
      {nearbyProducts.length > 0 && (
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{t("nearbyNeighborhood")}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {nearbyProducts.map(product => (
              <ProductCard 
                key={product.id} 
                product={product} 
                shopName={product.shopName}
                villageName={product.villageName}
                onClickProduct={() => navigateToProduct(product.marketId, product.shopId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Discover Local Markets */}
      <div className="mt-16">
        <HomePageMarketsClient 
          markets={markets} 
          userEmail={userEmail || ""} 
          spotlightProducts={[]}
        />
      </div>

      {/* Sponsored Section */}
      {activeAds.length > 0 && (
        <div className="mt-16">
          <AdsCarousel ads={activeAds} speed={5} />
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
