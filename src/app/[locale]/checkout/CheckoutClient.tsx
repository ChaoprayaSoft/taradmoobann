"use client";

import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function CheckoutClient({ userAddresses }: { userAddresses: string[] }) {
  const { cartItems, clearCart } = useCart();
  const router = useRouter();
  const t = useTranslations("Checkout");

  const [selectedAddress, setSelectedAddress] = useState<string>(userAddresses[0] || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const formatAddressForDisplay = (addrStr: string) => {
    try {
      const parsed = JSON.parse(addrStr);
      if (parsed.villageName !== undefined) {
        return `${t("villageName")}: ${parsed.villageName}\n${t("houseNo")}: ${parsed.houseNo}\n${t("addressLine")}: ${parsed.address}\n${t("telephone")}: ${parsed.telephone}`;
      }
    } catch(e) {}
    return addrStr;
  };

  const formatAddressForDB = (addrStr: string) => {
    try {
      const parsed = JSON.parse(addrStr);
      if (parsed.villageName !== undefined) {
        return `Village Name: ${parsed.villageName}\nHouse No.: ${parsed.houseNo}\nAddress: ${parsed.address}\nTelephone No.: ${parsed.telephone}`;
      }
    } catch(e) {}
    return addrStr;
  };

  // If cart is empty and we haven't just successfully submitted
  if (cartItems.length === 0 && !success) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{t("emptyCartTitle")}</h1>
        <p className="text-gray-500 mb-8">{t("emptyCartDesc")}</p>
        <Link href="/shopper" className="bg-brand-600 text-white px-6 py-3 rounded-md font-medium hover:bg-brand-700 transition">
          {t("goShopping")}
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{t("orderPlacedTitle")}</h1>
        <p className="text-gray-500 mb-8">{t("orderPlacedDesc")}</p>
        <Link href="/shopper" className="bg-brand-600 text-white px-6 py-3 rounded-md font-medium hover:bg-brand-700 transition">
          {t("returnToDashboard")}
        </Link>
      </div>
    );
  }

  const groupedByShop = cartItems.reduce((acc, item) => {
    const shopId = item.product.shopId;
    if (!acc[shopId]) {
      acc[shopId] = {
        shopName: item.product.shopName || t("unknownShop"),
        items: []
      };
    }
    acc[shopId].items.push(item);
    return acc;
  }, {} as Record<string, { shopName: string, items: typeof cartItems }>);

  const cartTotal = cartItems.reduce((total, item) => total + (item.product.price * item.quantity), 0);

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      setError(t("selectOrAddAddress"));
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/shopper/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartItems,
          deliveryAddress: formatAddressForDB(selectedAddress),
          rawDeliveryAddress: selectedAddress
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === "cross_village_error") {
          throw new Error(t("crossVillageError"));
        }
        throw new Error(data.error || "Failed to place order");
      }

      clearCart();
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{t("checkoutTitle")}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          {/* ADDRESS SELECTION */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              {t("deliveryAddress")}
            </h2>

            {userAddresses.length === 0 ? (
              <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg border border-yellow-200">
                <p className="font-medium">{t("noDeliveryAddressSet")}</p>
                <Link href="/shopper" className="text-brand-600 hover:underline text-sm mt-1 inline-block">
                  {t("addAddressLink")}
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {userAddresses.map((addr, idx) => (
                  <label key={idx} className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition ${selectedAddress === addr ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input 
                      type="radio" 
                      name="address" 
                      value={addr} 
                      checked={selectedAddress === addr}
                      onChange={(e) => setSelectedAddress(e.target.value)}
                      className="mt-1 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-gray-800 whitespace-pre-wrap flex-1 leading-relaxed">{formatAddressForDisplay(addr)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* ORDER ITEMS */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              {t("orderSummary")}
            </h2>

            <div className="space-y-6">
              {Object.values(groupedByShop).map(group => (
                <div key={group.shopName} className="border border-gray-100 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800">{group.shopName}</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    {group.items.map(item => (
                      <div key={item.cartItemId} className="flex justify-between items-start">
                        <div className="flex items-start gap-3">
                          {item.product.imageUrls && item.product.imageUrls.length > 0 ? (
                            <img src={item.product.imageUrls[0]} alt={item.product.name} className="w-12 h-12 object-cover rounded flex-shrink-0 mt-1" />
                          ) : (
                            <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-[10px] text-gray-400 flex-shrink-0 mt-1">{t("noImg")}</div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{item.product.name}</p>
                            
                            {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {Object.entries(item.selectedOptions).map(([key, value]) => (
                                  <span key={key} className="text-[10px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded">
                                    {key}: {Array.isArray(value) ? value.join(', ') : (value as string)}
                                  </span>
                                ))}
                              </div>
                            )}
                            {item.note && (
                              <p className="text-[10px] text-gray-500 mt-0.5 italic line-clamp-2">{t("note")}: {item.note}</p>
                            )}

                            <p className="text-gray-500 text-xs mt-1">{t("qty")}: {item.quantity}</p>
                          </div>
                        </div>
                        <p className="font-medium text-gray-900 mt-1">฿{(item.product.price * item.quantity).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CHECKOUT SIDEBAR */}
        <div className="md:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-brand-200 ring-1 ring-brand-50 sticky top-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{t("paymentSummary")}</h3>
            
            <div className="space-y-3 text-sm text-gray-600 border-b border-gray-200 pb-4 mb-4">
              <div className="flex justify-between">
                <span>{t("subtotal")}</span>
                <span>฿{cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t("deliveryFee")}</span>
                <span className="text-green-600 font-medium">{t("free")}</span>
              </div>
            </div>
            
            <div className="flex justify-between items-end mb-6">
              <span className="font-bold text-gray-900 text-lg">{t("total")}</span>
              <span className="font-bold text-brand-600 text-2xl">฿{cartTotal.toFixed(2)}</span>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm font-medium">{error}</div>}

            <button
              onClick={handlePlaceOrder}
              disabled={isSubmitting || userAddresses.length === 0 || !selectedAddress}
              className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl hover:bg-brand-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t("placingOrder") : t("placeOrder")}
            </button>
            <p className="text-xs text-gray-500 text-center mt-3">{t("cashOnDelivery")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
