"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";

export default function HomePageMarketsClient({ 
  markets, 
  userEmail,
  spotlightProducts 
}: { 
  markets: any[], 
  userEmail: string,
  spotlightProducts: any[]
}) {
  const router = useRouter();
  const [showSignInModal, setShowSignInModal] = useState(false);
  const t = useTranslations("HomePage");

  const handleEnterMarket = (e: React.MouseEvent, marketId: string) => {
    e.preventDefault();
    if (!userEmail) {
      setShowSignInModal(true);
      return;
    }
    router.push(`/market/${marketId}`);
  };

  return (
    <>
      {spotlightProducts.length > 0 && (
        <div className="w-full mt-12 mb-12 text-left">
          <div className="flex items-center gap-2 mb-6 px-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-yellow-500">
              <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900">{t("spotlightProducts")}</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 px-4">
            {spotlightProducts.map(product => {
              return (
                <div key={product.id} className="bg-white rounded-xl shadow-sm border border-yellow-200 overflow-hidden hover:shadow-md transition relative flex flex-col group">
                  <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full z-10 shadow-sm flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                      <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                    </svg>
                    {t("spotlight")}
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
                      {t("noImage")}
                    </div>
                  )}
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-gray-900 line-clamp-1">{product.name}</h3>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mt-0.5">{t("inMarket", { marketName: product.marketName })}</p>
                    <p className="text-brand-600 font-bold mt-1">฿{product.price}</p>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-2 flex-1">{product.description}</p>
                    
                    {product.marketId && (
                      <button 
                        onClick={(e) => handleEnterMarket(e, product.marketId)}
                        className="mt-3 block text-center text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
                      >
                        {t("viewInMarket")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold text-gray-900 mb-6 px-4">{t("discoverLocalMarkets")}</h2>

      {markets.length === 0 ? (
        <div className="text-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-gray-500">{t("noMarketsYet")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {markets.map(market => {
            return (
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
            );
          })}
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
    </>
  );
}
