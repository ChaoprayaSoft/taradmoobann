"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { storage, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useTranslations } from "next-intl";

const CATEGORIES = [
  "Food & Beverage",
  "Fresh Produce",
  "Clothing & Apparel",
  "Electronics & Accessories",
  "Handicrafts & Art",
  "Services",
  "Other"
];

export default function MarketOwnerDashboardClient({ 
  initialMarkets, 
  initialShops,
  initialMemberships
}: { 
  initialMarkets: any[],
  initialShops: any[],
  initialMemberships?: any[] // making it optional for backward compat just in case
}) {
  const router = useRouter();
  const t = useTranslations("MarketOwnerDashboard");
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedMarketFilter, setSelectedMarketFilter] = useState("all");

  const [formData, setFormData] = useState({
    marketId: initialMarkets.length > 0 ? initialMarkets[0].id : "",
    name: "",
    description: "",
    category: CATEGORIES[0],
    coverImage: "",
    ownerEmail: "",
  });

  // Modal State for Feedback
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    targetId: string;
    targetType: "shop" | "membership";
    feedback: string;
  }>({
    isOpen: false,
    targetId: "",
    targetType: "shop",
    feedback: "",
  });

  // Live Data State
  const [liveShops, setLiveShops] = useState(initialShops);
  const [liveMemberships, setLiveMemberships] = useState(initialMemberships || []);

  useEffect(() => {
    if (initialMarkets.length === 0) return;

    const marketIds = initialMarkets.map(m => m.id);
    
    // Firestore 'in' query supports up to 10 items.
    // If a market owner has > 10 markets, we would need to split queries.
    // For now, assume < 10 markets.
    const chunkedMarketIds = marketIds.slice(0, 10);

    const shopsQ = query(collection(db, "shops"), where("marketId", "in", chunkedMarketIds));
    const unsubShops = onSnapshot(shopsQ, (snap) => {
      const freshShops = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      setLiveShops(freshShops);
    });

    const membershipsQ = query(collection(db, "market_memberships"), where("marketId", "in", chunkedMarketIds));
    const unsubMemberships = onSnapshot(membershipsQ, (snap) => {
      const freshMems = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      setLiveMemberships(freshMems);
    });

    return () => {
      unsubShops();
      unsubMemberships();
    };
  }, [initialMarkets]);

  const activeShops = liveShops.filter(s => 
    (selectedMarketFilter === "all" || s.marketId === selectedMarketFilter)
  );
  // Removed pendingMemberships

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let finalImageUrl = formData.coverImage;

      if (file) {
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
        finalImageUrl = uploadJson.url;
      }

      // Shop created directly by market owner is automatically approved (status defaults to undefined or approved on backend, but we'll let backend handle it, backend doesn't set status so it goes to activeShops)
      const res = await fetch("/api/market-owner/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, coverImage: finalImageUrl }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      router.refresh();
      setIsCreating(false);
      setFormData({ 
        marketId: initialMarkets.length > 0 ? initialMarkets[0].id : "", 
        name: "", 
        description: "", 
        category: CATEGORIES[0], 
        coverImage: "", 
        ownerEmail: "" 
      });
      setFile(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShopStatus = async (shopId: string, shopName: string, action: "ban" | "unban") => {
    if (action === "ban" && !window.confirm(t("banShopConfirmDesc", { name: shopName }))) return;
    if (action === "unban" && !window.confirm(t("unbanShopConfirmDesc", { name: shopName }))) return;

    try {
      const res = await fetch("/api/market-owner/shops/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId, action }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${action} shop`);
      }
      
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleMembershipApprove = async (membershipId: string) => {
    try {
      const res = await fetch("/api/market-owner/memberships", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId, action: "approve", feedback: "" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update membership");
      }
      
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackModal.feedback.trim()) {
      return;
    }

    setLoading(true);
    try {
      if (feedbackModal.targetType === "shop") {
        const res = await fetch("/api/market-owner/shops/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            shopId: feedbackModal.targetId, 
            action: "request_revision", 
            feedback: feedbackModal.feedback 
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } else {
        const res = await fetch("/api/market-owner/memberships", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            membershipId: feedbackModal.targetId, 
            action: "request_revision", 
            feedback: feedbackModal.feedback 
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      }
      
      setFeedbackModal({ isOpen: false, targetId: "", targetType: "shop", feedback: "" });
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("marketDashboard")}</h1>
          <p className="text-gray-500 mt-1">{t("manageMarkets")}</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            className="border-gray-300 shadow-sm border p-2 rounded-md text-sm focus:ring-brand-500 focus:border-brand-500"
            value={selectedMarketFilter}
            onChange={(e) => setSelectedMarketFilter(e.target.value)}
          >
            <option value="all">{t("allMarkets")}</option>
            {initialMarkets.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button 
            onClick={() => setIsCreating(!isCreating)}
            disabled={initialMarkets.length === 0}
            className="bg-brand-600 text-white px-4 py-2 rounded-md font-medium hover:bg-brand-700 transition disabled:opacity-50"
          >
            {isCreating ? t("cancel") : t("createNewShop")}
          </button>
        </div>
      </div>

      {initialMarkets.length === 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                {t("noMarketsAssigned")}
              </p>
            </div>
          </div>
        </div>
      )}

      {isCreating && initialMarkets.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">{t("createShopTitle")}</h2>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t("selectMarket")}</label>
              <select
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                value={formData.marketId}
                onChange={(e) => setFormData({ ...formData, marketId: e.target.value })}
              >
                {initialMarkets.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t("shopName")}</label>
              <input
                required
                type="text"
                placeholder="e.g. Somtum Auntie Noi"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t("category")}</label>
              <select
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t("description")}</label>
              <textarea
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t("shopCoverImage")}</label>
              <input
                type="file"
                accept="image/*"
                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t("shopOwnerEmail")}</label>
              <input
                required
                type="email"
                placeholder="shopowner@example.com"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                value={formData.ownerEmail}
                onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
              />
            </div>
            <div className="pt-2">
              <button 
                type="submit" 
                disabled={loading}
                className="bg-brand-600 text-white px-6 py-2 rounded-md font-medium hover:bg-brand-700 transition disabled:opacity-50"
              >
                {loading ? t("creating") : t("saveShop")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Removed Pending Memberships Section */}

      {/* Removed Pending Shops Section */}

      {/* Active Markets and Shops Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium mb-4">{t("yourMarkets")}</h3>
          {initialMarkets.length === 0 ? (
            <p className="text-sm text-gray-500">{t("noMarketsFound")}</p>
          ) : (
            <ul className="space-y-4">
              {initialMarkets.map(m => (
                <li key={m.id}>
                  <button
                    onClick={() => setSelectedMarketFilter(selectedMarketFilter === m.id ? "all" : m.id)}
                    className={`w-full text-left flex items-center space-x-3 p-3 rounded-lg transition border ${
                      selectedMarketFilter === m.id 
                        ? "bg-brand-50 border-brand-200 shadow-sm ring-1 ring-brand-500" 
                        : "bg-white border-transparent hover:bg-gray-50 hover:border-gray-200"
                    }`}
                  >
                    <div className={`h-10 w-10 rounded flex-shrink-0 flex items-center justify-center font-bold ${
                      selectedMarketFilter === m.id ? "bg-brand-600 text-white" : "bg-brand-100 text-brand-600"
                    }`}>
                      {m.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${selectedMarketFilter === m.id ? "text-brand-900" : "text-gray-900"}`}>{m.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0 ${
                          m.operatingStatus === 'closed' ? 'bg-red-100 text-red-800' :
                          m.operatingStatus === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {m.operatingStatus === 'closed' ? t("closed") :
                           m.operatingStatus === 'scheduled' ? t("untilDates", { dates: m.validDates }) :
                           t("open")}
                        </span>
                        <span className="text-xs text-gray-500 truncate">
                          {t("shopsCount", { count: liveShops.filter(s => s.marketId === m.id).length })}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-medium">{t("activeShops")}</h3>
            <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {t("totalCount", { count: activeShops.length })}
            </span>
          </div>
          
          {activeShops.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {t("noActiveShops")}
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {activeShops.map((shop) => (
                <li key={shop.id} className="p-6 hover:bg-gray-50 transition">
                  <div className="flex items-center space-x-4">
                    {shop.coverImage ? (
                      <img src={shop.coverImage} alt={shop.name} className="h-16 w-16 object-cover rounded-md border border-gray-200" />
                    ) : (
                      <div className="h-16 w-16 bg-gray-100 rounded-md flex items-center justify-center border border-gray-200 text-gray-400">
                        {t("noImg")}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-medium text-gray-900 truncate flex items-center gap-2">
                        {shop.name} 
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{shop.category}</span>
                        {shop.status === "banned" && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full font-bold">Banned</span>}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {shop.description || t("noDescriptionProvided")}
                      </p>
                      <p className="text-xs text-brand-600 mt-1">
                        {t("market")} {initialMarkets.find(m => m.id === shop.marketId)?.name || shop.marketId}
                      </p>
                      <p className={`text-xs mt-1 font-bold ${
                        shop.operatingStatus === 'closed' ? 'text-red-500' :
                        shop.operatingStatus === 'scheduled' ? 'text-blue-500' :
                        'text-green-500'
                      }`}>
                        {shop.operatingStatus === 'closed' ? t("closedCamel") :
                         shop.operatingStatus === 'scheduled' ? t("scheduledUntil", { dates: shop.validDates }) :
                         t("openCamel")}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium text-gray-900">{t("owner")}</p>
                      <p className="text-sm text-gray-500 mb-2">{shop.ownerEmail}</p>
                      {shop.status === "banned" ? (
                        <button 
                          onClick={() => handleShopStatus(shop.id, shop.name, "unban")}
                          className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-md hover:bg-green-200 transition"
                        >
                          {t("unbanShop") || "Unban Shop"}
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleShopStatus(shop.id, shop.name, "ban")}
                          className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-md hover:bg-red-200 transition"
                        >
                          {t("banShop") || "Ban Shop"}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* FEEDBACK MODAL */}
      {feedbackModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t("requestRevisionTitle")}</h2>
            <p className="text-sm text-gray-500 mb-4">
              {t("provideFeedback", { target: feedbackModal.targetType === "shop" ? t("shopOwner") : t("shopper") })}
            </p>
            
            <form onSubmit={submitFeedback}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("feedback")}</label>
              <textarea
                required
                rows={4}
                placeholder={t("feedbackPlaceholder")}
                className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-brand-500 focus:border-brand-500 mb-4"
                value={feedbackModal.feedback}
                onChange={(e) => setFeedbackModal(prev => ({ ...prev, feedback: e.target.value }))}
              />
              <div className="flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setFeedbackModal({ isOpen: false, targetId: "", targetType: "shop", feedback: "" })}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition"
                >
                  {t("cancel")}
                </button>
                <button 
                  type="submit" 
                  disabled={loading || !feedbackModal.feedback.trim()}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? t("sending") : t("sendFeedback")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
