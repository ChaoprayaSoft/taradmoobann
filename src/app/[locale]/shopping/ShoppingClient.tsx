"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";

import ProductCard from "@/components/ProductCard";

export default function ShoppingClient({ 
  markets, 
  userVillageName,
  userEmail,
  whatsUpTodayProducts = [],
  nearbyProducts = []
}: { 
  markets: any[], 
  userVillageName: string,
  userEmail: string | null,
  whatsUpTodayProducts?: any[],
  nearbyProducts?: any[]
}) {
  const router = useRouter();
  const t = useTranslations("Shopping");
  const [activeTab, setActiveTab] = useState<"local" | "other">(userVillageName ? "local" : "other");
  const [showSignInModal, setShowSignInModal] = useState(false);

  const localMarkets = markets.filter(m => m.villageName === userVillageName);
  const otherMarkets = markets.filter(m => m.villageName !== userVillageName);

  const displayMarkets = activeTab === "local" ? localMarkets : otherMarkets;

  const handleEnterMarket = (e: React.MouseEvent, marketId: string) => {
    e.preventDefault();
    router.push(`/market/${marketId}`);
  };

  const navigateToProduct = (marketId: string, shopId: string) => {
    router.push(`/market/${marketId}?shopId=${shopId}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <h1 className="text-3xl font-bold text-gray-900">{t("yourLocalMarkets")}</h1>
        
        <div className="flex bg-gray-100 p-1 rounded-lg self-start">
          <button
            onClick={() => setActiveTab("local")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === "local" ? "bg-white text-brand-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            {t("marketsInYourVillage")}
          </button>
          <button
            onClick={() => setActiveTab("other")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === "other" ? "bg-white text-brand-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            {t("otherMarkets")}
          </button>
        </div>
      </div>

      {displayMarkets.length === 0 ? (
        <div className="text-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200 mt-8">
          <p className="text-gray-500">
            {activeTab === "local" 
              ? (userVillageName ? t("noLocalMarkets") : t("noVillageSet")) 
              : t("noOtherMarkets")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayMarkets.map(market => (
            <div key={market.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition flex flex-col">
              <button 
                onClick={(e) => handleEnterMarket(e, market.id)}
                className="block w-full h-48 overflow-hidden group text-left"
              >
                {market.coverImage ? (
                  <img src={market.coverImage} alt={market.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 transition-colors duration-300 group-hover:bg-gray-200">
                    {t("noImage")}
                  </div>
                )}
              </button>
              
              <div className="p-5 flex flex-col flex-1">
                <h3 className="font-bold text-xl text-gray-900">{market.name}</h3>
                <p className="text-xs text-brand-600 font-medium mb-1">{market.villageName || ""}</p>
                <p className="text-gray-600 text-sm mt-1 line-clamp-2 flex-1">{market.description}</p>
                
                <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                  <div className="flex items-center gap-1.5" title="Approved Shops">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                    </svg>
                    <span>{market.shopsCount || 0}</span>
                  </div>
                </div>

                <button 
                  onClick={(e) => handleEnterMarket(e, market.id)}
                  className="mt-4 block w-full text-center bg-green-600 text-white font-medium py-2 rounded-md hover:bg-green-700 transition"
                >
                  {t("enterMarket")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* What's up today Section */}
      {userVillageName && whatsUpTodayProducts.length > 0 && (
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{t("whatsUpToday")}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {whatsUpTodayProducts.map(product => (
              <ProductCard 
                key={product.id} 
                product={product} 
                shopName={product.shopName}
                onClickProduct={() => navigateToProduct(product.marketId, product.shopId)}
              />
            ))}
          </div>
        </div>
      )}

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
                onClickProduct={() => navigateToProduct(product.marketId, product.shopId)}
              />
            ))}
          </div>
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
