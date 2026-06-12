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
  const displayMarkets = markets;
  const [showSignInModal, setShowSignInModal] = useState(false);

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
      </div>

      {/* What's up today Section */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{t("whatsUpToday")}</h2>
        {userEmail ? (
          userVillageName ? (
            whatsUpTodayProducts.length > 0 ? (
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
