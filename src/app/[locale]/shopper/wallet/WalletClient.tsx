"use client";

import { useState } from "react";
import Link from "next/link";
import { Coins, RefreshCcw, CheckCircle2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import generatePayload from "promptpay-qr";
import { useRouter } from "next/navigation";

export default function WalletClient({ currentCoins }: { currentCoins: number }) {
  const t = useTranslations("ShopperWallet");
  const router = useRouter();
  
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const packages = [
    { coins: 40, price: 20 },
    { coins: 55, price: 25 },
    { coins: 120, price: 50 },
  ];

  const handleGenerateQR = () => {
    if (!selectedPackage) return;
    setShowQR(true);
    setShowUpload(false);
    setFile(null);
    setError("");
    setSuccess(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFile = e.target.files[0];
      if (newFile.size > 4 * 1024 * 1024) {
        setError("File size must be less than 4MB");
        e.target.value = "";
        return;
      }
      setError("");
      setFile(newFile);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPackage || !file) {
      setError("Please select a package and upload a payment slip.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // 1. Upload the slip image
      const uploadData = new FormData();
      uploadData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: uploadData,
      });

      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadJson.error || "Failed to upload image");
      }
      
      const slipImageUrl = uploadJson.url;

      // 2. Submit the top-up request
      const res = await fetch("/api/shopper/topups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          amountTHB: selectedPackage,
          slipImageUrl: slipImageUrl
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit top-up request");
      }

      setSuccess(true);
      setShowQR(false);
      setShowUpload(false);
      setFile(null);
      setSelectedPackage(null);
      
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
          {t("myWallet") || "My Wallet"}
        </h1>
        <Link href="/shopper" className="text-brand-600 hover:text-brand-700 font-medium">
          {t("backToDashboard") || "Back to Dashboard"}
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
            <p className="text-brand-100 font-medium mb-2 uppercase tracking-wider text-sm">{t("availableBalance") || "Available Balance"}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-extrabold">{currentCoins}</span>
              <span className="text-xl text-brand-200">Coins</span>
            </div>
            <button
              onClick={handleRefresh}
              className="mt-6 flex items-center gap-2 text-sm bg-white/20 hover:bg-white/30 transition px-4 py-2 rounded-full"
            >
              <RefreshCcw className="w-4 h-4" />
              {t("refreshBalance") || "Refresh Balance"}
            </button>
          </div>

          {/* Top-up Packages */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t("topUpCoins") || "Top-up Coins"}</h2>
            <p className="text-gray-500 mb-6 text-sm">{t("topUpDesc") || "Select a package below to buy more coins."}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {packages.map((pkg) => (
                <div
                  key={pkg.coins}
                  onClick={() => {
                    setSelectedPackage(pkg.price);
                    setShowQR(false);
                    setShowUpload(false);
                    setSuccess(false);
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
            
            {success && (
              <div className="mt-6 p-4 bg-green-50 text-green-700 rounded-xl text-sm border border-green-100 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Your top-up request has been submitted and is pending admin approval.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Checkout / QR Display */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 sticky top-8">
            <h3 className="font-bold text-gray-900 text-lg mb-4">{t("paymentDetails") || "Payment Details"}</h3>

            {!selectedPackage ? (
              <div className="text-center py-8 text-gray-400">
                <Coins className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">{t("selectPackage") || "Please select a package"}</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{t("selectedPackage") || "Selected Package"}</span>
                  <span className="font-medium text-gray-900">{selectedPackage} Coins</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{t("paymentMethod") || "Payment Method"}</span>
                  <span className="font-medium text-gray-900">PromptPay QR</span>
                </div>
                <div className="border-t border-gray-100 pt-4 flex justify-between items-end mb-2">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-brand-600">฿{selectedPackage}</span>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => { setShowQR(true); setShowUpload(false); }}
                    className={`w-full font-bold py-3 rounded-xl transition flex justify-center items-center gap-2 ${showQR ? 'bg-brand-700 text-white shadow-inner' : 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm'}`}
                  >
                    {t("generateQr") || "Generate QR Code"}
                  </button>
                  <button
                    onClick={() => { setShowUpload(true); setShowQR(false); }}
                    className={`w-full font-bold py-3 rounded-xl transition flex justify-center items-center gap-2 border ${showUpload ? 'bg-brand-200 text-brand-900 border-brand-300 shadow-inner' : 'bg-brand-50 text-brand-800 border-brand-200 hover:bg-brand-100 shadow-sm'}`}
                  >
                    <Upload className="w-5 h-5" />
                    Upload Payment Slip
                  </button>
                </div>
              </div>
            )}
          </div>

          {showQR && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center space-y-4">
              <div className="bg-white p-4 border-2 border-gray-100 rounded-xl inline-block mx-auto shadow-sm">
                <QRCodeSVG
                  value={generatePayload("0909739266", { amount: selectedPackage || 0 })}
                  size={192}
                />
              </div>

              <div className="space-y-1">
                <p className="font-medium text-gray-900">{t("scanToPay", { amount: selectedPackage || 0 }) || `Scan to pay ฿${selectedPackage}`}</p>
                <p className="text-sm text-gray-500">Please scan using your banking app.</p>
              </div>
            </div>
          )}

          {showUpload && (
            <div className="bg-brand-50 rounded-2xl p-6 shadow-sm border border-brand-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="font-bold text-brand-900 text-lg mb-2">Upload Payment Slip</h3>
              <p className="text-sm text-brand-700 mb-4">Please upload your payment slip for verification.</p>
              
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-brand-300 border-dashed rounded-lg cursor-pointer bg-white hover:bg-brand-100 px-4 transition">
                  <div className="flex flex-col items-center justify-center text-center">
                    <Upload className="w-6 h-6 text-brand-500 mb-2" />
                    <p className="mb-1 text-sm text-brand-700"><span className="font-semibold">Click to upload slip</span></p>
                    <p className="text-xs text-brand-500">PNG, JPG (Max 4MB)</p>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                </label>
              </div>
              
              {file && (
                <p className="mt-3 text-sm text-green-700 font-medium truncate flex items-center gap-1 bg-green-50 p-2 rounded-lg border border-green-200">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> {file.name}
                </p>
              )}
              
              <button
                onClick={handleSubmit}
                disabled={!file || isLoading}
                className="w-full mt-4 bg-brand-600 text-white font-medium py-3 rounded-xl hover:bg-brand-700 transition disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed shadow-sm"
              >
                {isLoading ? "Submitting..." : "Submit Payment Slip"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
