"use client";

import { useState } from "react";
import Link from "next/link";
import { Coins, QrCode, RefreshCcw, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";

export default function WalletClient({ currentCoins }: { currentCoins: number }) {
  const t = useTranslations("ShopperWallet");
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const packages = [
    { coins: 40, price: 20 },
    { coins: 55, price: 25 },
    { coins: 120, price: 50 },
  ];

  const handleTopUp = async () => {
    if (!selectedPackage) return;

    setIsLoading(true);
    setError("");
    setQrCodeUrl(null);

    try {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amountTHB: selectedPackage }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate QR Code");
      }

      setQrCodeUrl(data.qrCodeUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Coins className="w-8 h-8 text-yellow-500" />
          {t("myWallet")}
        </h1>
        <Link href="/shopper" className="text-brand-600 hover:text-brand-700 font-medium">
          {t("backToDashboard")}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Balance & Packages */}
        <div className="lg:col-span-2 space-y-6">
          {/* Balance Card */}
          <div className="bg-gradient-to-r from-brand-600 to-brand-800 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Coins className="w-32 h-32" />
            </div>
            <p className="text-brand-100 font-medium mb-2 uppercase tracking-wider text-sm">{t("availableBalance")}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-extrabold">{currentCoins}</span>
              <span className="text-xl text-brand-200">Coins</span>
            </div>
            <button
              onClick={handleRefresh}
              className="mt-6 flex items-center gap-2 text-sm bg-white/20 hover:bg-white/30 transition px-4 py-2 rounded-full"
            >
              <RefreshCcw className="w-4 h-4" />
              {t("refreshBalance")}
            </button>
          </div>

          {/* Top-up Packages */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t("topUpCoins")}</h2>
            <p className="text-gray-500 mb-6 text-sm">{t("topUpDesc")}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {packages.map((pkg) => (
                <div
                  key={pkg.coins}
                  onClick={() => {
                    setSelectedPackage(pkg.price);
                    setQrCodeUrl(null); // Reset QR if changing package
                  }}
                  className={`
                    cursor-pointer border-2 rounded-xl p-4 text-center transition-all duration-200
                    ${selectedPackage === pkg.price
                      ? 'border-brand-500 bg-brand-50 ring-4 ring-brand-500/10'
                      : 'border-gray-100 hover:border-brand-300 hover:bg-gray-50'}
                  `}
                >
                  <div className="flex justify-center mb-2">
                    <Coins className={`w-8 h-8 ${selectedPackage === pkg.price ? 'text-brand-500' : 'text-gray-400'}`} />
                  </div>
                  <div className="font-bold text-gray-900 text-lg mb-1">{pkg.coins}</div>
                  <div className="text-sm font-medium text-gray-500">฿{pkg.price}</div>
                </div>
              ))}
            </div>

            {error && (
              <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Checkout / QR Display */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 sticky top-8">
            <h3 className="font-bold text-gray-900 text-lg mb-4">{t("paymentDetails")}</h3>

            {!selectedPackage ? (
              <div className="text-center py-8 text-gray-400">
                <Coins className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">{t("selectPackage")}</p>
              </div>
            ) : !qrCodeUrl ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{t("selectedPackage")}</span>
                  <span className="font-medium text-gray-900">{selectedPackage} Coins</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{t("paymentMethod")}</span>
                  <span className="font-medium text-gray-900">PromptPay QR</span>
                </div>
                <div className="border-t border-gray-100 pt-4 flex justify-between items-end">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-brand-600">฿{selectedPackage}</span>
                </div>

                <button
                  onClick={handleTopUp}
                  disabled={isLoading}
                  className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl hover:bg-brand-700 transition disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isLoading ? t("generatingQr") : t("generateQr")}
                </button>
              </div>
            ) : (
              <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5" />
                  {t("qrGenerated")}
                </div>

                <div className="bg-white p-4 border-2 border-gray-100 rounded-xl inline-block mx-auto shadow-sm">
                  <img src={qrCodeUrl} alt="PromptPay QR Code" className="w-48 h-48 mx-auto" />
                </div>

                <div className="space-y-1">
                  <p className="font-medium text-gray-900">{t("scanToPay", { amount: selectedPackage })}</p>
                  <p className="text-sm text-gray-500">{t("useApp")}</p>
                </div>

                <div className="pt-4 border-t border-gray-100 mt-4">
                  <p className="text-xs text-gray-400 mb-3">
                    {t("afterPayment")}
                  </p>
                  <button
                    onClick={handleRefresh}
                    className="w-full bg-gray-900 text-white font-medium py-3 rounded-xl hover:bg-gray-800 transition"
                  >
                    {t("iHavePaid")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
