"use client";

import { useCart } from "./CartProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useTranslations } from "next-intl";

export default function CartSidebar() {
  const { cartItems, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart } = useCart();
  const router = useRouter();
  const t = useTranslations("CartSidebar");

  if (!isCartOpen) return null;

  // Group items by shop
  const groupedByShop = cartItems.reduce((acc, item) => {
    const shopId = item.product.shopId;
    if (!acc[shopId]) {
      acc[shopId] = {
        shopName: item.product.shopName || t("unknownShop"), // We'll need to make sure shopName is attached or fetched
        items: []
      };
    }
    acc[shopId].items.push(item);
    return acc;
  }, {} as Record<string, { shopName: string, items: typeof cartItems }>);

  const cartTotal = cartItems.reduce((total, item) => total + (item.product.price * item.quantity), 0);

  const handleCheckout = () => {
    setIsCartOpen(false);
    router.push("/checkout");
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-[60]" 
        onClick={() => setIsCartOpen(false)}
      />
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[70] flex flex-col transform transition-transform">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">{t("yourCart")}</h2>
          <button 
            onClick={() => setIsCartOpen(false)}
            className="text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {cartItems.length === 0 ? (
            <div className="text-center text-gray-500 mt-12">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mx-auto mb-4 text-gray-300">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
              <p>{t("cartEmpty")}</p>
            </div>
          ) : (
            Object.values(groupedByShop).map(group => (
              <div key={group.shopName} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2">{group.shopName}</h3>
                <div className="space-y-4">
                  {group.items.map(item => (
                    <div key={item.cartItemId} className="flex gap-3">
                      {item.product.imageUrls && item.product.imageUrls.length > 0 ? (
                        <img src={item.product.imageUrls[0]} alt={item.product.name} className="w-16 h-16 object-cover rounded-md flex-shrink-0" />
                      ) : (
                        <div className="w-16 h-16 bg-gray-200 rounded-md flex items-center justify-center text-xs text-gray-400 flex-shrink-0">{t("noImg")}</div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium text-gray-900 text-sm line-clamp-1">{item.product.name}</h4>
                          <button onClick={() => removeFromCart(item.cartItemId)} className="text-red-500 hover:text-red-700 ml-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>

                        {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {Object.entries(item.selectedOptions).map(([key, value]) => (
                              <span key={key} className="text-[10px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded">
                                {key}: {Array.isArray(value) ? value.join(', ') : (value as string)}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.note && (
                          <p className="text-[11px] text-gray-500 mt-1 italic line-clamp-2">{t("note", { note: item.note })}</p>
                        )}

                        <p className="text-brand-600 font-bold text-sm mt-1">฿{item.product.price}</p>
                        
                        <div className="flex items-center gap-3 mt-2">
                          <button 
                            onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                            className="w-6 h-6 rounded bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                          >
                            -
                          </button>
                          <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                            className="w-6 h-6 rounded bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="border-t border-gray-200 p-4 bg-white">
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-600 font-medium">{t("subtotal")}</span>
              <span className="text-xl font-bold text-gray-900">฿{cartTotal.toFixed(2)}</span>
            </div>
            <button 
              onClick={handleCheckout}
              className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl hover:bg-brand-700 transition shadow-sm"
            >
              {t("proceedToCheckout")}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
