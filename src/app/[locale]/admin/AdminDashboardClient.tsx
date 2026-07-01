"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { storage } from "@/lib/firebase";
import { useTranslations } from "next-intl";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import TipTapEditor from "@/components/TipTapEditor";

export default function AdminDashboardClient({ 
  initialMarkets,
  initialShops = [],
  initialOrders = [],
  initialAds = [],
  initialAdsSettings = null,
  totalUsers = 0,
  initialFeedbacks = [],
  initialTermsOfUse = "",
  initialUsers = []
}: { 
  initialMarkets: any[],
  initialShops?: any[],
  initialOrders?: any[],
  initialAds?: any[],
  initialAdsSettings?: any,
  totalUsers?: number,
  initialFeedbacks?: any[],
  initialTermsOfUse?: any,
  initialUsers?: any[]
}) {
  const t = useTranslations("AdminDashboard");
  const router = useRouter();
  const [markets, setMarkets] = useState(initialMarkets);
  const [isCreating, setIsCreating] = useState(false);
  const [editingMarket, setEditingMarket] = useState<any | null>(null);
  const [marketToDelete, setMarketToDelete] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState<"markets" | "shops" | "chats" | "ads" | "feedback" | "terms" | "users">("markets");

  // Users Tab State
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [filterUserMarket, setFilterUserMarket] = useState("");
  const [filterUserVillageName, setFilterUserVillageName] = useState("");
  const [selectedUserAddresses, setSelectedUserAddresses] = useState<any[] | null>(null);
  const [usersList, setUsersList] = useState(initialUsers || []);

  const feedbacks = initialFeedbacks || [];
  const avgFeedbackRating = feedbacks.length > 0 
    ? feedbacks.reduce((sum, f) => sum + (f.rating || 0), 0) / feedbacks.length 
    : 0;

  const completedOrders = initialOrders.filter(o => o.status === "Completed");
  const totalRevenue = completedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const activeMarketsCount = markets.filter(m => m.operatingStatus !== "closed").length;
  const approvedShopsCount = initialShops.filter(s => s.status === "approved").length;

  const [formData, setFormData] = useState({
    name: "",
    villageName: "",
    description: "",
    coverImage: "",
    ownerEmail: "",
    operatingStatus: "always_open",
    validDates: "",
  });

  const [file, setFile] = useState<File | null>(null);

  // Shop state
  const [shopsList, setShopsList] = useState(initialShops || []);
  const [editingShop, setEditingShop] = useState<any | null>(null);
  const [shopFormData, setShopFormData] = useState({ operatingStatus: "always_open", validDates: "" });
  const [shopUpdating, setShopUpdating] = useState(false);
  const [selectedMarketFilter, setSelectedMarketFilter] = useState("all");

  const filteredShops = selectedMarketFilter === "all" 
    ? shopsList 
    : shopsList.filter(s => s.marketId === selectedMarketFilter);

  // Ads state
  const [adsList, setAdsList] = useState(initialAds || []);
  const [adsSettings, setAdsSettings] = useState({
    maxAds: initialAdsSettings?.maxAds || 3,
    carouselSpeed: initialAdsSettings?.carouselSpeed || 5
  });
  const [isCreatingAd, setIsCreatingAd] = useState(false);
  const [editingAd, setEditingAd] = useState<any | null>(null);
  const [adFormData, setAdFormData] = useState({
    title: "",
    description: "",
    imageUrl: "",
    linkUrl: "",
    status: "ON",
    placement: "Main Page",
    validUntil: ""
  });
  const [adFile, setAdFile] = useState<File | null>(null);
  const [adLoading, setAdLoading] = useState(false);

  // Chat State
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);

  // Terms of Use State
  const [termsContent, setTermsContent] = useState(initialTermsOfUse?.content || "");
  const [termsContentTh, setTermsContentTh] = useState(initialTermsOfUse?.content_th || "");
  const [isEditingTerms, setIsEditingTerms] = useState(false);
  const [termsSaving, setTermsSaving] = useState(false);
  const [isTermsConfirmModalOpen, setIsTermsConfirmModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [shopToDelete, setShopToDelete] = useState<string | null>(null);

  // Activity Logs State
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsMetrics, setLogsMetrics] = useState<any>({ todayLogins: 0, uniqueUsersToday: 0, topPages: [] });
  const [monthlyActivityData, setMonthlyActivityData] = useState<any[]>([]);
  const [logsSearchQuery, setLogsSearchQuery] = useState("");
  const [logsFilterAction, setLogsFilterAction] = useState("");
  const [logsStartDate, setLogsStartDate] = useState("");
  const [logsEndDate, setLogsEndDate] = useState("");

  const filteredLogs = useMemo(() => {
    return activityLogs.filter(log => {
      let matches = true;
      if (logsFilterAction && log.action !== logsFilterAction) matches = false;
      if (logsSearchQuery) {
        const q = logsSearchQuery.toLowerCase();
        if (!log.userEmail?.toLowerCase().includes(q) && 
            !log.action?.toLowerCase().includes(q) && 
            !log.details?.toLowerCase().includes(q)) {
          matches = false;
        }
      }
      
      if (logsStartDate) {
        const start = new Date(logsStartDate);
        start.setHours(0, 0, 0, 0);
        if (new Date(log.timestamp) < start) matches = false;
      }
      if (logsEndDate) {
        const end = new Date(logsEndDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(log.timestamp) > end) matches = false;
      }

      return matches;
    });
  }, [activityLogs, logsFilterAction, logsSearchQuery, logsStartDate, logsEndDate]);

  const uniqueLogActions = useMemo(() => {
    const set = new Set(activityLogs.map(l => l.action).filter(Boolean));
    return Array.from(set);
  }, [activityLogs]);

  const derivedUsers = useMemo(() => {
    return (usersList || []).map(u => {
      let villageName = "";
      let houseNo = "";
      if (u.addresses && u.addresses.length > 0) {
        try {
          const defaultAddr = u.addresses.find((a: string) => {
            try { return JSON.parse(a).isDefault; } catch { return false; }
          }) || u.addresses[0];
          
          const parsed = JSON.parse(defaultAddr);
          villageName = parsed.villageName || "";
          houseNo = parsed.houseNo || "";
        } catch {
          // If fallback string or fail
        }
      }
      
      const market = markets.find(m => m.villageName === villageName);
      const marketName = market ? market.name : "";
      
      return {
        ...u,
        villageName,
        houseNo,
        marketName,
        marketId: market ? market.id : ""
      };
    });
  }, [usersList, markets]);

  const filteredUsers = useMemo(() => {
    return derivedUsers.filter(u => {
      let matches = true;
      if (filterUserMarket && u.marketId !== filterUserMarket) matches = false;
      if (filterUserVillageName && u.villageName !== filterUserVillageName) matches = false;
      if (userSearchQuery) {
        const q = userSearchQuery.toLowerCase();
        if (!u.name?.toLowerCase().includes(q) && 
            !u.email?.toLowerCase().includes(q) && 
            !u.houseNo?.toLowerCase().includes(q)) {
          matches = false;
        }
      }
      return matches;
    });
  }, [derivedUsers, filterUserMarket, filterUserVillageName, userSearchQuery]);

  const uniqueUserMarkets = useMemo(() => {
    const map = new Map();
    derivedUsers.forEach(u => {
      if (u.marketId) map.set(u.marketId, u.marketName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [derivedUsers]);

  const uniqueUserVillages = useMemo(() => {
    const set = new Set(derivedUsers.map(u => u.villageName).filter(Boolean));
    return Array.from(set);
  }, [derivedUsers]);

  useEffect(() => {
    setMarkets(initialMarkets);
  }, [initialMarkets]);

  useEffect(() => {
    // Fetch immediately
    fetchChats();
    // Poll every 5 seconds globally so the notification banner can update
    const interval = setInterval(fetchChats, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedChat) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedChat?.messages]);

  useEffect(() => {
    if (activeTab === "logs" as any) {
      fetchLogs();
    }
  }, [activeTab]);

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch("/api/admin/logs?limit=200");
      const data = await res.json();
      if (data.success) {
        setActivityLogs(data.logs || []);
        if (data.metrics) {
          setLogsMetrics(data.metrics);
        }
        if (data.monthlyData) {
          setMonthlyActivityData(data.monthlyData);
        }
      }
    } catch (e) {
      console.error("Failed to fetch logs", e);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchChats = async () => {
    try {
      const res = await fetch("/api/chat/admin");
      const data = await res.json();
      setChats(data);
      // Update selected chat if it exists
      if (selectedChat) {
        const updated = data.find((c: any) => c.userEmail === selectedChat.userEmail);
        if (updated) setSelectedChat(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedChat) return;

    setChatLoading(true);
    const textToSend = chatInput;
    setChatInput("");

    try {
      // Optimistic update
      const tempMsg = { text: textToSend, sender: "admin", timestamp: new Date().toISOString() };
      setSelectedChat((prev: any) => ({ ...prev, messages: [...prev.messages, tempMsg] }));

      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSend, targetEmail: selectedChat.userEmail }),
      });
      await fetchChats();
    } catch (err) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!chatToDelete) return;
    try {
      const res = await fetch(`/api/chat/admin?email=${encodeURIComponent(chatToDelete)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        if (selectedChat?.userEmail === chatToDelete) {
          setSelectedChat(null);
        }
        setChats(prev => prev.filter(c => c.userEmail !== chatToDelete));
        setChatToDelete(null);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete chat");
      }
    } catch (e) {
      alert("Something went wrong");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let finalImageUrl = formData.coverImage;

      // If a file was selected, upload it via the Next.js API route to Google Drive
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

      const url = editingMarket ? "/api/admin/markets" : "/api/admin/markets";
      const method = editingMarket ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...formData, 
          coverImage: finalImageUrl,
          id: editingMarket ? editingMarket.id : undefined
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      // Refresh page to get new data from server
      router.refresh();
      setIsCreating(false);
      setEditingMarket(null);
      setFormData({ name: "", villageName: "", description: "", coverImage: "", ownerEmail: "", operatingStatus: "always_open", validDates: "" });
      setFile(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShop) return;
    setShopUpdating(true);
    try {
      const res = await fetch("/api/admin/shops", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingShop.id, ...shopFormData })
      });
      if (res.ok) {
        setShopsList(prev => prev.map(s => s.id === editingShop.id ? { ...s, ...shopFormData } : s));
        setEditingShop(null);
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update shop");
      }
    } catch (err) {
      alert("Something went wrong");
    } finally {
      setShopUpdating(false);
    }
  };

  const executeDeleteMarket = async () => {
    if (!marketToDelete) return;
    
    const idToDelete = marketToDelete.id;
    setMarkets(prev => prev.filter(m => m.id !== idToDelete));
    setMarketToDelete(null);

    try {
      const res = await fetch(`/api/admin/markets?id=${idToDelete}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        setMarkets(initialMarkets);
        const data = await res.json();
        alert(data.error || "Failed to delete market");
      }
    } catch (err) {
      setMarkets(initialMarkets);
      alert("Something went wrong");
    }
  };

  const openEdit = (market: any) => {
    setEditingMarket(market);
    setFormData({
      name: market.name,
      villageName: market.villageName || "",
      description: market.description || "",
      coverImage: market.coverImage || "",
      ownerEmail: market.ownerEmail,
      operatingStatus: market.operatingStatus || "always_open",
      validDates: market.validDates || ""
    });
    setIsCreating(false);
    setFile(null);
  };

  // Ads Functions
  const handleAdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdLoading(true);
    try {
      let finalImageUrl = adFormData.imageUrl;

      if (adFile) {
        const uploadData = new FormData();
        uploadData.append("file", adFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadData });
        const uploadJson = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadJson.error || "Failed to upload image");
        finalImageUrl = uploadJson.url;
      }

      const method = editingAd ? "PUT" : "POST";
      const payload = { ...adFormData, imageUrl: finalImageUrl, id: editingAd?.id };

      const res = await fetch("/api/admin/ads", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to save ad");
      
      router.refresh();
      setIsCreatingAd(false);
      setEditingAd(null);
      setAdFile(null);
      setAdFormData({ title: "", description: "", imageUrl: "", linkUrl: "", status: "ON", placement: "Main Page", validUntil: "" });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdLoading(false);
    }
  };

  const handleAdDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this ad?")) return;
    try {
      const res = await fetch(`/api/admin/ads?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setAdsList(prev => prev.filter(ad => ad.id !== id));
        router.refresh();
      }
    } catch (e) {}
  };

  const handleSettingsUpdate = async (newSettings: any) => {
    try {
      await fetch("/api/admin/ads-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings)
      });
      setAdsSettings(newSettings);
    } catch (e) {
      alert("Failed to update settings");
    }
  };

  const handleSaveTerms = async () => {
    setTermsSaving(true);
    setIsTermsConfirmModalOpen(false);
    try {
      const res = await fetch("/api/admin/terms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: termsContent, content_th: termsContentTh })
      });
      if (!res.ok) throw new Error("Failed to save terms");
      setIsEditingTerms(false);
    } catch (err) {
      alert("Failed to save Terms of Use");
    } finally {
      setTermsSaving(false);
    }
  };

  const handleToggleUserStatus = async (email: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action: "toggleStatus" })
      });
      if (!res.ok) throw new Error("Failed to toggle user status");
      const data = await res.json();
      setUsersList(prev => prev.map(u => u.email === email ? { ...u, isActive: data.isActive } : u));
    } catch (err) {
      alert("Failed to toggle user status");
    }
  };

  const handleDeleteUser = async (email: string) => {
    try {
      const res = await fetch(`/api/admin/users?email=${encodeURIComponent(email)}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to delete user");
      setUsersList(prev => prev.filter(u => u.email !== email));
      setUserToDelete(null);
    } catch (err) {
      alert("Failed to delete user");
    }
  };

  const handleToggleShopStatus = async (shopId: string) => {
    try {
      const res = await fetch("/api/admin/shops", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: shopId, action: "toggleStatus" })
      });
      if (!res.ok) throw new Error("Failed to toggle shop status");
      const data = await res.json();
      setShopsList(prev => prev.map(s => s.id === shopId ? { ...s, status: data.status } : s));
    } catch (err) {
      alert("Failed to toggle shop status");
    }
  };

  const handleDeleteShop = async (shopId: string) => {
    try {
      const res = await fetch(`/api/admin/shops?id=${encodeURIComponent(shopId)}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to delete shop");
      setShopsList(prev => prev.filter(s => s.id !== shopId));
      setShopToDelete(null);
    } catch (err) {
      alert("Failed to delete shop");
    }
  };

  const renderAdForm = () => (
    <form onSubmit={handleAdSubmit} className="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-6 space-y-4 max-w-xl">
      <h3 className="font-bold text-lg mb-4">{editingAd ? t("editAd") : t("newAd")}</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700">{t("title")}</label>
        <input required type="text" className="mt-1 block w-full rounded-md border-gray-300 border p-2 focus:ring-brand-500 focus:border-brand-500" value={adFormData.title} onChange={(e) => setAdFormData({ ...adFormData, title: e.target.value })} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">{t("description")}</label>
        <textarea rows={2} required className="mt-1 block w-full rounded-md border-gray-300 border p-2 focus:ring-brand-500 focus:border-brand-500" value={adFormData.description} onChange={(e) => setAdFormData({ ...adFormData, description: e.target.value })} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">{t("linkUrl")}</label>
        <input type="url" placeholder="https://" className="mt-1 block w-full rounded-md border-gray-300 border p-2 focus:ring-brand-500 focus:border-brand-500" value={adFormData.linkUrl} onChange={(e) => setAdFormData({ ...adFormData, linkUrl: e.target.value })} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">{t("adImageUpload")}</label>
        <input type="file" accept="image/*" onChange={(e) => {
          const f = e.target.files ? e.target.files[0] : null;
          if (f && f.size > 4 * 1024 * 1024) {
            alert("File size must be less than 4MB");
            e.target.value = "";
            return;
          }
          setAdFile(f);
        }} className="mt-1 block w-full text-sm text-gray-500" />
        <p className="text-xs text-gray-500 mt-1">Maximum file size: 4MB</p>
        {editingAd && adFormData.imageUrl && <p className="text-xs text-gray-500 mt-1">{t("leaveEmptyKeep")}</p>}
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700">{t("status")}</label>
          <select className="mt-1 block w-full rounded-md border-gray-300 border p-2" value={adFormData.status} onChange={(e) => setAdFormData({ ...adFormData, status: e.target.value })}>
            <option value="ON">ON</option>
            <option value="OFF">OFF</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700">{t("validUntil")}</label>
          <input type="date" required className="mt-1 block w-full rounded-md border-gray-300 border p-2" value={adFormData.validUntil} onChange={(e) => setAdFormData({ ...adFormData, validUntil: e.target.value })} />
        </div>
      </div>
      <button type="submit" disabled={adLoading} className="bg-brand-600 text-white px-6 py-2 rounded-md font-medium hover:bg-brand-700 disabled:opacity-50">
        {adLoading ? t("saving") : t("saveAd")}
      </button>
    </form>
  );

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-64px)] bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 flex flex-col gap-6">
      {/* Top Header & Navigation */}
      <div className="bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-purple-100 p-6 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t("adminDashboard")}</h1>
            <p className="text-gray-500 mt-1 text-sm">{t("manageAll")}</p>
          </div>
          
          {/* Unread Chat Notification Banner */}
          {chats.some(c => c.unreadByAdmin) && (
            <div className="bg-red-50 border border-red-200 p-3 rounded shadow-sm flex items-center justify-between gap-4 min-w-[250px]">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-sm text-red-700 font-bold">{t("unreadMessages")}</p>
              </div>
              <button 
                onClick={() => setActiveTab("chats")}
                className="text-xs bg-red-100 hover:bg-red-200 text-red-800 font-bold py-1.5 px-4 rounded transition shrink-0 whitespace-nowrap"
              >
                {t("viewInbox")}
              </button>
            </div>
          )}
        </div>

        {/* Navigation Menu (Horizontal) */}
        <nav className="flex flex-row overflow-x-auto scrollbar-hide p-2 bg-white/60 backdrop-blur-sm rounded-2xl border border-purple-100 gap-2 w-full shadow-inner">
          <button
            onClick={() => setActiveTab("markets")}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${activeTab === "markets" ? "bg-white text-purple-700 shadow-sm border border-purple-200" : "text-purple-600 hover:bg-white/50 hover:text-purple-900 border border-transparent"}`}
          >
            {t("marketsAndReports")}
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${activeTab === "users" ? "bg-white text-purple-700 shadow-sm border border-purple-200" : "text-purple-600 hover:bg-white/50 hover:text-purple-900 border border-transparent"}`}
          >
            {t("manageUsers") || "Manage Users"}
          </button>
          <button
            onClick={() => setActiveTab("shops")}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${activeTab === "shops" ? "bg-white text-purple-700 shadow-sm border border-purple-200" : "text-purple-600 hover:bg-white/50 hover:text-purple-900 border border-transparent"}`}
          >
            {t("manageShops")}
          </button>
          <button
            onClick={() => setActiveTab("chats")}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === "chats" ? "bg-white text-purple-700 shadow-sm border border-purple-200" : "text-purple-600 hover:bg-white/50 hover:text-purple-900 border border-transparent"}`}
          >
            {t("conversations")}
            {chats.some(c => c.unreadByAdmin) && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">!</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("ads")}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${activeTab === "ads" ? "bg-white text-purple-700 shadow-sm border border-purple-200" : "text-purple-600 hover:bg-white/50 hover:text-purple-900 border border-transparent"}`}
          >
            {t("manageAds")}
          </button>
          <button
            onClick={() => setActiveTab("feedback")}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${activeTab === "feedback" ? "bg-white text-purple-700 shadow-sm border border-purple-200" : "text-purple-600 hover:bg-white/50 hover:text-purple-900 border border-transparent"}`}
          >
            {t("appFeedback") || "App Feedback"}
          </button>
          <button
            onClick={() => setActiveTab("terms")}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${activeTab === "terms" ? "bg-white text-purple-700 shadow-sm border border-purple-200" : "text-purple-600 hover:bg-white/50 hover:text-purple-900 border border-transparent"}`}
          >
            {t("termsOfUse") || "Terms of Use"}
          </button>
          <button
            onClick={() => setActiveTab("logs" as any)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${activeTab === "logs" as any ? "bg-white text-purple-700 shadow-sm border border-purple-200" : "text-purple-600 hover:bg-white/50 hover:text-purple-900 border border-transparent"}`}
          >
            {t("activityLogs") || "Activity Logs"}
          </button>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full pb-20 min-w-0 space-y-6">

      {activeTab === "markets" && (
        <>
          <div className="flex justify-end">
            <button 
              onClick={() => {
                if (isCreating) {
                  setIsCreating(false);
                } else {
                  setIsCreating(true);
                  setEditingMarket(null);
                  setFormData({ name: "", villageName: "", description: "", coverImage: "", ownerEmail: "", operatingStatus: "always_open", validDates: "" });
                  setFile(null);
                  // Optional: clear file input element if needed by resetting a key or directly
                }
              }}
              className="bg-brand-600 text-white px-4 py-2 rounded-md font-medium hover:bg-brand-700 transition"
            >
              {isCreating ? t("cancel") : t("createNewMarket")}
            </button>
          </div>

          {(isCreating || editingMarket) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingMarket ? t("editMarket", { name: editingMarket.name }) : t("createMarketTitle")}
              </h2>
              <button 
                onClick={() => {
                  setEditingMarket(null);
                  setIsCreating(false);
                  setFormData({ name: "", villageName: "", description: "", coverImage: "", ownerEmail: "", operatingStatus: "always_open", validDates: "" });
                  setFile(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t("marketName")}</label>
              <input
                required
                type="text"
                placeholder={t("marketNamePlaceholder")}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t("villageName")} *</label>
              <input
                required
                type="text"
                placeholder={t("villageNamePlaceholder")}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                value={formData.villageName}
                onChange={(e) => setFormData({ ...formData, villageName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t("locationDescription")} *</label>
              <textarea
                required
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t("coverImage")}</label>
              <input
                type="file"
                accept="image/*"
                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                onChange={(e) => {
                  const f = e.target.files ? e.target.files[0] : null;
                  if (f && f.size > 4 * 1024 * 1024) {
                    alert("File size must be less than 4MB");
                    e.target.value = "";
                    return;
                  }
                  setFile(f);
                }}
              />
              <p className="text-xs text-gray-500 mt-1">Maximum file size: 4MB</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t("marketOwnerEmail")}</label>
              <input
                required
                type="email"
                placeholder="owner@example.com"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                value={formData.ownerEmail}
                onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                {t("ownerEmailNote")}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t("operatingStatus")}</label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                value={formData.operatingStatus}
                onChange={(e) => setFormData({ ...formData, operatingStatus: e.target.value })}
              >
                <option value="always_open">{t("open")}</option>
                <option value="closed">{t("closedDeactivated")}</option>
                <option value="scheduled">{t("scheduledDates")}</option>
              </select>
            </div>
            {formData.operatingStatus === "scheduled" && (
              <div>
                <label className="block text-sm font-medium text-gray-700">{t("validUntil")}</label>
                <input
                  type="date"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                  value={formData.validDates}
                  onChange={(e) => setFormData({ ...formData, validDates: e.target.value })}
                />
              </div>
            )}
            <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
              <button 
                type="button" 
                onClick={() => {
                  setEditingMarket(null);
                  setIsCreating(false);
                  setFormData({ name: "", villageName: "", description: "", coverImage: "", ownerEmail: "", operatingStatus: "always_open", validDates: "" });
                  setFile(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition"
              >
                {t("cancel")}
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="bg-brand-600 text-white px-6 py-2 rounded-md font-medium hover:bg-brand-700 transition disabled:opacity-50"
              >
                {loading ? t("saving") : (editingMarket ? t("updateMarket") : t("saveMarket"))}
              </button>
            </div>
          </form>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium">{t("existingMarkets")}</h3>
          <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
            {t("totalCount", { count: markets.length })}
          </span>
        </div>
        
        {markets.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {t("noMarketsCreated")}
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {markets.map((market) => (
              <li key={market.id} className="p-6 hover:bg-gray-50 transition">
                <div className="flex items-center space-x-4">
                  {market.coverImage ? (
                    <img src={market.coverImage} alt={market.name} className="h-16 w-16 object-cover rounded-md border border-gray-200" />
                  ) : (
                    <div className="h-16 w-16 bg-gray-100 rounded-md flex items-center justify-center border border-gray-200 text-gray-400">
                      No Img
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-medium text-gray-900 truncate">
                      {market.name}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {market.description || t("noDescription")}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 mr-4">
                    <p className="text-sm font-medium text-gray-900">{t("owner")}</p>
                    <p className="text-sm text-gray-500">{market.ownerEmail}</p>
                    <p className={`text-xs mt-1 font-bold ${
                      market.operatingStatus === 'closed' ? 'text-red-500' :
                      market.operatingStatus === 'scheduled' ? 'text-blue-500' :
                      'text-green-500'
                    }`}>
                      {market.operatingStatus === 'closed' ? t("closed") :
                       market.operatingStatus === 'scheduled' ? t("scheduled", { dates: market.validDates }) :
                       t("open")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0 border-l border-gray-200 pl-4">
                    <button 
                      onClick={() => openEdit(market)}
                      className="text-sm text-brand-600 hover:text-brand-800 font-medium text-left"
                    >
                      {t("edit")}
                    </button>
                    <button 
                      onClick={() => setMarketToDelete(market)}
                      className="text-sm text-red-600 hover:text-red-800 font-medium text-left"
                    >
                      {t("delete")}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {marketToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-semibold text-gray-900">
                {t("deleteMarketTitle") || "Delete Market?"}
              </h2>
              <button 
                onClick={() => setMarketToDelete(null)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600">
                {t("deleteMarketConfirm", { name: marketToDelete.name }) || `Are you sure you want to delete ${marketToDelete.name}? This action cannot be undone.`}
              </p>
              <div className="pt-4 flex justify-end gap-3 mt-6">
                <button 
                  onClick={() => setMarketToDelete(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition"
                >
                  {t("cancel")}
                </button>
                <button 
                  onClick={executeDeleteMarket}
                  className="bg-red-600 text-white px-6 py-2 rounded-md font-medium hover:bg-red-700 transition"
                >
                  {t("delete")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PLATFORM OVERVIEW */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
        <h2 className="text-xl font-semibold mb-6">{t("platformOverview")}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-brand-50 to-brand-100 p-6 rounded-xl border border-brand-200">
            <p className="text-sm text-brand-700 font-medium uppercase tracking-wider mb-1">{t("totalRevenue")}</p>
            <p className="text-3xl font-bold text-brand-900">฿{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-brand-600 mt-2">{t("completedOrdersCount", { count: completedOrders.length })}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
            <p className="text-sm text-blue-700 font-medium uppercase tracking-wider mb-1">{t("activeMarkets")}</p>
            <p className="text-3xl font-bold text-blue-900">{activeMarketsCount}</p>
            <p className="text-xs text-blue-600 mt-2">{t("outOfTotalMarkets", { total: markets.length })}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
            <p className="text-sm text-green-700 font-medium uppercase tracking-wider mb-1">{t("approvedShops")}</p>
            <p className="text-3xl font-bold text-green-900">{approvedShopsCount}</p>
            <p className="text-xs text-green-600 mt-2">{t("acrossAllMarkets")}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
            <p className="text-sm text-purple-700 font-medium uppercase tracking-wider mb-1">{t("totalUsersTitle")}</p>
            <p className="text-3xl font-bold text-purple-900">{totalUsers}</p>
            <p className="text-xs text-purple-600 mt-2">{t("registeredPlatformUsers")}</p>
          </div>
        </div>

        <h3 className="text-lg font-medium mb-4 border-b border-gray-200 pb-2">{t("globalTransactionList")} ({completedOrders.length})</h3>
        {completedOrders.length === 0 ? (
          <p className="text-gray-500 text-sm">{t("noCompletedTransactions")}</p>
        ) : (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200 relative">
              <thead className="bg-gray-50 sticky top-0 shadow-sm">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("date")}</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("market")}</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("shop")}</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("shopper")}</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t("amount")}</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {completedOrders.map((order) => {
                  const shop = initialShops.find(s => s.id === order.shopId);
                  const market = markets.find(m => m.id === shop?.marketId);
                  
                  return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleString('en-GB')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {market ? market.name : t("unknown")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {shop ? shop.name : t("unknown")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {order.shopperName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                      ฿{order.totalAmount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => setSelectedTransaction(order)}
                        className="text-brand-600 hover:text-brand-900 bg-brand-50 hover:bg-brand-100 px-3 py-1 rounded transition"
                      >
                        {t("viewDetails")}
                      </button>
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* Users Tab UI */}
      {activeTab === "users" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">{t("manageUsers") || "Manage Users"}</h3>
              <div className="bg-brand-50 text-brand-700 px-4 py-1.5 rounded-full text-sm font-semibold border border-brand-200">
                {t("totalUsers", { total: totalUsers })}
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder={t("searchUsersPlaceholder") || "Search by name, email, or house number..."}
                  className="w-full rounded-md border border-gray-300 px-4 py-2 focus:ring-brand-500 focus:border-brand-500"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                />
              </div>
              <div className="md:w-48">
                <select
                  className="w-full rounded-md border border-gray-300 px-4 py-2 focus:ring-brand-500 focus:border-brand-500"
                  value={filterUserMarket}
                  onChange={(e) => setFilterUserMarket(e.target.value)}
                >
                  <option value="">{t("allMarkets") || "All Markets"}</option>
                  {uniqueUserMarkets.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:w-48">
                <select
                  className="w-full rounded-md border border-gray-300 px-4 py-2 focus:ring-brand-500 focus:border-brand-500"
                  value={filterUserVillageName}
                  onChange={(e) => setFilterUserVillageName(e.target.value)}
                >
                  <option value="">{t("allVillages") || "All Villages"}</option>
                  {uniqueUserVillages.map(v => (
                    <option key={v} value={v as string}>{v as string}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("username") || "Username"}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("email") || "Email"}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("houseNo") || "House No."}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("villageName")}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("market")}</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t("address") || "Address"}</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t("status") || "Status"}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t("createdDate") || "Created Date"}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t("actions") || "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name || "-"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email || "-"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.houseNo || "-"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.villageName || "-"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.marketName || "-"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <button
                            onClick={() => setSelectedUserAddresses(user.addresses || [])}
                            className="text-brand-600 hover:text-brand-900 bg-brand-50 hover:bg-brand-100 px-3 py-1 rounded-md transition"
                          >
                            {t("viewAddresses") || "View Addresses"}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.isActive === false ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                            {user.isActive === false ? (t("inactive") || "Inactive") : (t("active") || "Active")}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                          {user.createdAt ? (
                            (() => {
                              const d = new Date(user.createdAt);
                              return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                            })()
                          ) : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex gap-2 justify-end">
                          <button
                            onClick={() => handleToggleUserStatus(user.email)}
                            className="text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-md transition"
                          >
                            {user.isActive === false ? (t("enable") || "Enable") : (t("disable") || "Disable")}
                          </button>
                          <button
                            onClick={() => setUserToDelete(user.email)}
                            className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-md transition"
                          >
                            {t("delete") || "Delete"}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                        {t("noUsersFound") || "No users found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SHOPS TAB */}
      {activeTab === "shops" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">{t("allShops")}</h2>
              <select
                className="border-gray-300 shadow-sm border p-2 rounded-md text-sm focus:ring-brand-500 focus:border-brand-500"
                value={selectedMarketFilter}
                onChange={(e) => setSelectedMarketFilter(e.target.value)}
              >
                <option value="all">{t("allMarkets")}</option>
                {markets.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            
            {filteredShops.length === 0 ? (
              <p className="text-gray-500 text-sm">{t("noShopsExist")}</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {filteredShops.map((shop) => {
                  const marketName = markets.find(m => m.id === shop.marketId)?.name || t("unknownMarket");
                  return (
                    <li key={shop.id} className="py-4 flex justify-between items-start gap-4">
                      <div className="flex gap-4">
                        <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                          {shop.coverImage ? (
                            <img src={shop.coverImage} alt={shop.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-brand-900 flex items-center gap-2">
                            {shop.name}
                            <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-full ${shop.status === 'inactive' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {shop.status === 'inactive' ? (t("inactive") || "Inactive") : (t("active") || "Active")}
                            </span>
                          </h3>
                          <p className="text-sm font-medium text-brand-600 bg-brand-50 inline-block px-2 py-0.5 rounded mt-1">
                            {marketName}
                          </p>
                          <p className="text-sm text-gray-600 mt-2">{shop.description}</p>
                          <p className="text-sm text-gray-500 mt-1">{t("owner")}: {shop.ownerEmail}</p>
                        </div>
                      </div>
                      
                    
                    {editingShop?.id === shop.id ? (
                      <form onSubmit={handleUpdateShop} className="bg-gray-50 p-4 rounded border border-gray-200 min-w-[300px]">
                        <h4 className="font-semibold text-sm mb-2">{t("editStatus")}</h4>
                        <div className="mb-3">
                          <select
                            className="block w-full rounded-md border-gray-300 shadow-sm border p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                            value={shopFormData.operatingStatus}
                            onChange={(e) => setShopFormData({ ...shopFormData, operatingStatus: e.target.value })}
                          >
                            <option value="always_open">{t("open")}</option>
                            <option value="closed">{t("closedDeactivated")}</option>
                            <option value="scheduled">{t("scheduledDates")}</option>
                          </select>
                        </div>
                        {shopFormData.operatingStatus === "scheduled" && (
                          <div className="mb-3">
                            <label className="block text-xs text-gray-600 mb-1">{t("validUntil")}</label>
                            <input
                              type="date"
                              className="block w-full rounded-md border-gray-300 shadow-sm border p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                              value={shopFormData.validDates}
                              onChange={(e) => setShopFormData({ ...shopFormData, validDates: e.target.value })}
                            />
                          </div>
                        )}
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setEditingShop(null)}
                            className="text-xs text-gray-600 hover:text-gray-800 font-medium px-3 py-1"
                          >
                            {t("cancel")}
                          </button>
                          <button
                            type="submit"
                            disabled={shopUpdating}
                            className="bg-brand-600 text-white text-xs font-medium px-4 py-1.5 rounded hover:bg-brand-700 disabled:opacity-50"
                          >
                            {shopUpdating ? t("saving") : t("save")}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="text-right flex flex-col items-end gap-2">
                        <p className={`text-xs mt-1 font-bold ${
                          shop.operatingStatus === 'closed' ? 'text-red-500' :
                          shop.operatingStatus === 'scheduled' ? 'text-blue-500' :
                          'text-green-500'
                        }`}>
                          {shop.operatingStatus === 'closed' ? t("closed") :
                           shop.operatingStatus === 'scheduled' ? t("scheduled", { dates: shop.validDates }) :
                           t("open")}
                        </p>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setEditingShop(shop);
                              setShopFormData({
                                operatingStatus: shop.operatingStatus || "always_open",
                                validDates: shop.validDates || ""
                              });
                            }}
                            className="text-xs bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-50 transition"
                          >
                            {t("editStatus")}
                          </button>
                          <button
                            onClick={() => handleToggleShopStatus(shop.id)}
                            className="text-xs text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition"
                          >
                            {shop.status === 'inactive' ? (t("enable") || "Enable") : (t("disable") || "Disable")}
                          </button>
                          <button
                            onClick={() => setShopToDelete(shop.id)}
                            className="text-xs text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition"
                          >
                            {t("delete") || "Delete"}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* CHATS TAB */}
      {activeTab === "chats" && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[600px] flex overflow-hidden">
          {/* Chat List Sidebar */}
          <div className="w-1/3 border-r border-gray-200 flex flex-col bg-gray-50">
            <div className="p-4 border-b border-gray-200 bg-white">
              <h2 className="font-semibold text-gray-900">{t("conversations")}</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {chats.length === 0 ? (
                <p className="text-sm text-gray-500 p-4 text-center">{t("noMessagesYet")}</p>
              ) : (
                chats.map(chat => (
                  <button
                    key={chat.userEmail}
                    onClick={() => {
                      setSelectedChat(chat);
                      if (chat.unreadByAdmin) {
                        // Optimistically clear unread, actual clear will happen when we fetch single chat via GET /api/chat
                        fetch(`/api/chat?email=${encodeURIComponent(chat.userEmail)}`);
                        setChats(prev => prev.map(c => c.userEmail === chat.userEmail ? { ...c, unreadByAdmin: false } : c));
                      }
                    }}
                    className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-100 transition flex items-center justify-between ${
                      selectedChat?.userEmail === chat.userEmail ? 'bg-brand-50 border-brand-200' : ''
                    }`}
                  >
                    <div className="truncate pr-2">
                      <p className={`text-sm truncate ${chat.unreadByAdmin ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {chat.userEmail}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-1">
                        {chat.messages[chat.messages.length - 1]?.text}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {chat.unreadByAdmin && (
                        <span className="w-2.5 h-2.5 bg-brand-500 rounded-full flex-shrink-0"></span>
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setChatToDelete(chat.userEmail);
                        }}
                        className="text-gray-400 hover:text-red-500 p-1 rounded transition"
                        title={t("deleteConversation")}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
          
          {/* Chat Area */}
          <div className="flex-1 flex flex-col bg-white">
            {selectedChat ? (
              <>
                <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center">
                  <h3 className="font-bold text-gray-900">{selectedChat.userEmail}</h3>
                  <button 
                    onClick={() => setChatToDelete(selectedChat.userEmail)}
                    className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-md transition flex items-center justify-center"
                    title={t("deleteConversation")}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col space-y-4">
                  {selectedChat.messages.map((msg: any, i: number) => (
                    <div key={i} className={`max-w-[70%] rounded-xl p-3 text-sm shadow-sm ${
                      msg.sender === "admin" 
                        ? "bg-brand-600 text-white self-end rounded-br-none" 
                        : "bg-white border border-gray-200 text-gray-800 self-start rounded-bl-none"
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      <p className={`text-[10px] mt-1 text-right ${msg.sender === "admin" ? "text-brand-200" : "text-gray-400"}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleAdminReply} className="p-4 bg-white border-t border-gray-200 flex gap-2">
                  <input
                    type="text"
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    placeholder={t("typeReply")}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={chatLoading}
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="bg-brand-600 text-white rounded-lg px-6 py-2 font-medium hover:bg-brand-700 disabled:opacity-50 transition"
                  >
                    {t("send")}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 flex-col">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-16 h-16 mb-4 text-gray-300">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
                <p>{t("selectConversationToView")}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADS TAB */}
      {activeTab === "ads" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-4">
              <h2 className="text-xl font-semibold">{t("adsSettings")}</h2>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">{t("maxAdsHomepage")}</label>
                  <input 
                    type="number" 
                    min="1" max="10"
                    className="w-20 rounded-md border-gray-300 shadow-sm border p-1.5 focus:ring-brand-500 focus:border-brand-500"
                    value={adsSettings.maxAds}
                    onChange={(e) => handleSettingsUpdate({ ...adsSettings, maxAds: parseInt(e.target.value) || 3 })}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">{t("marketCarouselSpeed")}</label>
                  <input 
                    type="number" 
                    min="1" max="30"
                    className="w-20 rounded-md border-gray-300 shadow-sm border p-1.5 focus:ring-brand-500 focus:border-brand-500"
                    value={adsSettings.carouselSpeed}
                    onChange={(e) => handleSettingsUpdate({ ...adsSettings, carouselSpeed: parseInt(e.target.value) || 5 })}
                  />
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                <h2 className="text-xl font-semibold text-brand-700">{t("mainPageAds")}</h2>
                <button 
                  onClick={() => {
                    setIsCreatingAd(!isCreatingAd || adFormData.placement !== "Main Page");
                    setEditingAd(null);
                    setAdFormData({ title: "", description: "", imageUrl: "", linkUrl: "", status: "ON", placement: "Main Page", validUntil: "" });
                  }}
                  className="bg-brand-600 text-white px-3 py-1.5 text-sm rounded-md font-medium hover:bg-brand-700 transition"
                >
                  {t("createMainPageAd")}
                </button>
              </div>
              
              {(isCreatingAd || editingAd) && adFormData.placement === "Main Page" && renderAdForm()}

              {initialAds.filter(ad => (ad.placement || "Main Page") === "Main Page").length === 0 ? (
                <p className="text-gray-500 text-sm py-4">{t("noMainPageAds")}</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {initialAds.filter(ad => (ad.placement || "Main Page") === "Main Page").map((ad: any) => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isExpired = ad.validUntil && ad.validUntil < todayStr;
                    const displayStatus = isExpired ? 'OFF' : ad.status;
                    
                    return (
                    <li key={ad.id} className="py-4 flex gap-4">
                      <div className="w-32 h-20 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                        {ad.imageUrl && <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900">{ad.title}</h4>
                        <p className="text-sm text-gray-600 line-clamp-1">{ad.description}</p>
                        <p className="text-xs text-brand-600 mt-1">{ad.linkUrl}</p>
                        <div className="flex gap-3 mt-2 text-xs font-medium">
                          <span className={displayStatus === 'ON' ? 'text-green-600' : 'text-red-500'}>Status: {displayStatus}</span>
                          <span className="text-gray-500">Valid until: {ad.validUntil}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => {
                          setEditingAd(ad);
                          setAdFormData({ title: ad.title, description: ad.description, imageUrl: ad.imageUrl, linkUrl: ad.linkUrl || "", status: displayStatus, placement: ad.placement || "Main Page", validUntil: ad.validUntil });
                          setIsCreatingAd(false);
                        }} className="text-sm text-brand-600 hover:underline">{t("edit")}</button>
                        <button onClick={() => handleAdDelete(ad.id)} className="text-sm text-red-600 hover:underline">{t("delete")}</button>
                      </div>
                    </li>
                  );
                  })}
                </ul>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                <h2 className="text-xl font-semibold text-brand-700">{t("marketPageAds")}</h2>
                <button 
                  onClick={() => {
                    setIsCreatingAd(!isCreatingAd || adFormData.placement !== "Market Page");
                    setEditingAd(null);
                    setAdFormData({ title: "", description: "", imageUrl: "", linkUrl: "", status: "ON", placement: "Market Page", validUntil: "" });
                  }}
                  className="bg-brand-600 text-white px-3 py-1.5 text-sm rounded-md font-medium hover:bg-brand-700 transition"
                >
                  {t("createMarketPageAd")}
                </button>
              </div>

              {(isCreatingAd || editingAd) && adFormData.placement === "Market Page" && renderAdForm()}

              {initialAds.filter(ad => ad.placement === "Market Page").length === 0 ? (
                <p className="text-gray-500 text-sm py-4">{t("noMarketPageAds")}</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {initialAds.filter(ad => ad.placement === "Market Page").map((ad: any) => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const isExpired = ad.validUntil && ad.validUntil < todayStr;
                    const displayStatus = isExpired ? 'OFF' : ad.status;
                    
                    return (
                    <li key={ad.id} className="py-4 flex gap-4">
                      <div className="w-32 h-20 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                        {ad.imageUrl && <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900">{ad.title}</h4>
                        <p className="text-sm text-gray-600 line-clamp-1">{ad.description}</p>
                        <p className="text-xs text-brand-600 mt-1">{ad.linkUrl}</p>
                        <div className="flex gap-3 mt-2 text-xs font-medium">
                          <span className={displayStatus === 'ON' ? 'text-green-600' : 'text-red-500'}>Status: {displayStatus}</span>
                          <span className="text-gray-500">Valid until: {ad.validUntil}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => {
                          setEditingAd(ad);
                          setAdFormData({ title: ad.title, description: ad.description, imageUrl: ad.imageUrl, linkUrl: ad.linkUrl || "", status: displayStatus, placement: ad.placement || "Market Page", validUntil: ad.validUntil });
                          setIsCreatingAd(false);
                        }} className="text-sm text-brand-600 hover:underline">{t("edit")}</button>
                        <button onClick={() => handleAdDelete(ad.id)} className="text-sm text-red-600 hover:underline">{t("delete")}</button>
                      </div>
                    </li>
                  );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CHAT DELETE MODAL */}
      {chatToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">{t("deleteConversationConfirmTitle")}</h2>
            <p className="text-sm text-gray-500 mb-6">
              {t("deleteConversationConfirmDesc", { email: chatToDelete })}
            </p>
            <div className="flex justify-end pt-4">
              <button 
                onClick={handleDeleteChat}
                className="bg-red-600 text-white px-4 py-2 rounded font-medium hover:bg-red-700 transition"
              >
                {t("deleteConversation")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TRANSACTION DETAILS MODAL */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">{t("transactionDetails")}</h3>
              <button 
                onClick={() => setSelectedTransaction(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500 font-medium">{t("orderId")}</p>
                  <p className="text-gray-900 font-mono text-sm">{selectedTransaction.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">{t("date")}</p>
                  <p className="text-gray-900 text-sm">{new Date(selectedTransaction.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">{t("shopper")}</p>
                  <p className="text-gray-900 text-sm">{selectedTransaction.shopperName} ({selectedTransaction.shopperEmail})</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">{t("deliveryAddress")}</p>
                  <p className="text-gray-900 text-sm">{selectedTransaction.deliveryAddress}</p>
                </div>
              </div>

              <h4 className="font-semibold text-gray-900 mb-3 border-b border-gray-200 pb-2">{t("orderItems")}</h4>
              <div className="space-y-4">
                {selectedTransaction.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-start border border-gray-100 p-3 rounded-lg bg-gray-50">
                    <div className="flex gap-3">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.productName} className="w-12 h-12 object-cover rounded" />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-[10px] text-gray-400">No Img</div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{item.productName}</p>
                        <p className="text-gray-500 text-xs">{t("qty", { qty: item.quantity })}</p>
                        {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {Object.entries(item.selectedOptions).map(([k, v]) => (
                              <span key={k} className="text-[10px] bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-600">
                                {k}: {Array.isArray(v) ? v.join(', ') : (v as string)}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.note && (
                          <p className="text-[10px] text-gray-500 mt-1 italic">{t("note", { note: item.note })}</p>
                        )}
                      </div>
                    </div>
                    <p className="font-medium text-gray-900 text-sm">฿{(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between items-center">
                <span className="font-bold text-gray-900 text-lg">{t("amount")}</span>
                <span className="font-bold text-brand-600 text-xl">฿{selectedTransaction.totalAmount.toFixed(2)}</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button 
                onClick={() => setSelectedTransaction(null)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg font-medium transition"
              >
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      {/* APP FEEDBACK TAB */}
      {activeTab === "feedback" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-2">{t("totalComments")}</p>
              <p className="text-4xl font-bold text-gray-900">{feedbacks.length}</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-2">{t("avgRating")}</p>
              <div className="flex items-center gap-2">
                <p className="text-4xl font-bold text-gray-900">{avgFeedbackRating.toFixed(1)}</p>
                <svg className="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium">{t("appFeedback")}</h3>
            </div>
            {feedbacks.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {t("noFeedbackYet") || "No feedback received yet."}
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {feedbacks.map((fb) => (
                  <li key={fb.id} className="p-6 hover:bg-gray-50 transition">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-1 items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <svg key={star} className={`w-4 h-4 ${fb.rating >= star ? "text-yellow-400" : "text-gray-300"}`} fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-xs text-gray-500">{new Date(fb.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-gray-900 font-medium whitespace-pre-wrap">{fb.comment}</p>
                    <p className="text-xs text-gray-500 mt-2">From: {fb.userEmail}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {activeTab === "terms" && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-medium">{t("termsOfUse") || "Terms of Use"}</h3>
            {!isEditingTerms ? (
              <button 
                onClick={() => setIsEditingTerms(true)}
                className="bg-brand-50 border border-brand-200 text-brand-700 px-4 py-2 rounded-md font-medium hover:bg-brand-100 transition"
              >
                {t("edit") || "Edit"}
              </button>
            ) : (
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsEditingTerms(false)}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md font-medium hover:bg-gray-50 transition"
                >
                  {t("cancel") || "Cancel"}
                </button>
                <button 
                  onClick={() => setIsTermsConfirmModalOpen(true)}
                  disabled={termsSaving}
                  className="bg-brand-600 text-white px-4 py-2 rounded-md font-medium hover:bg-brand-700 transition disabled:opacity-50"
                >
                  {termsSaving ? t("saving") || "Saving..." : t("save") || "Save"}
                </button>
              </div>
            )}
          </div>
          <div className="p-6">
            {!isEditingTerms ? (
              <div className="space-y-8">
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3 border-b pb-2">English Terms</h4>
                  {termsContent ? (
                    <div className="prose max-w-none text-sm ql-editor" dangerouslySetInnerHTML={{ __html: termsContent }} />
                  ) : (
                    <p className="text-gray-500 italic">No English terms configured.</p>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3 border-b pb-2">Thai Terms (ข้อกำหนดการใช้งาน)</h4>
                  {termsContentTh ? (
                    <div className="prose max-w-none text-sm ql-editor" dangerouslySetInnerHTML={{ __html: termsContentTh }} />
                  ) : (
                    <p className="text-gray-500 italic">No Thai terms configured.</p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-500">
                  Edit the global Terms of Use. This content is visible to Shoppers and Shop Owners.
                </div>
                
                <div className="space-y-8">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">English Terms</label>
                    <div className="border border-gray-300 rounded-md bg-white">
                      <TipTapEditor 
                        value={termsContent} 
                        onChange={setTermsContent} 
                        className="h-[300px] mb-12"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Thai Terms (ข้อกำหนดการใช้งาน)</label>
                    <div className="border border-gray-300 rounded-md bg-white">
                      <TipTapEditor 
                        value={termsContentTh} 
                        onChange={setTermsContentTh} 
                        className="h-[300px] mb-12"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ACTIVITY LOGS TAB */}
      {activeTab === "logs" as any && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-2">Today's Logins</p>
              <p className="text-4xl font-bold text-gray-900">{logsMetrics.todayLogins}</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-2">Unique Users Today</p>
              <p className="text-4xl font-bold text-brand-600">{logsMetrics.uniqueUsersToday}</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center md:col-span-2">
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-4">Top 5 Visited Pages Today</p>
              <div className="flex flex-wrap justify-center gap-3">
                {logsMetrics.topPages && logsMetrics.topPages.length > 0 ? (
                  logsMetrics.topPages.map((item: any, idx: number) => (
                    <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-900 break-all">{item.page}</span>
                      <span className="bg-brand-100 text-brand-700 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">{item.count} visits</span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No page visits recorded today</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
            <h3 className="text-lg font-medium mb-4">Monthly Activity (This Year)</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyActivityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip 
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="activity" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-lg font-medium">{t("activityLogs") || "Activity Logs"}</h3>
              <div className="flex flex-col md:flex-row gap-3 items-center">
                <input
                  type="text"
                  placeholder={t("searchLogsPlaceholder") || "Search email, action..."}
                  className="w-full md:w-64 border border-gray-300 rounded-md p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                  value={logsSearchQuery}
                  onChange={(e) => setLogsSearchQuery(e.target.value)}
                />
                <select
                  className="w-full md:w-auto border border-gray-300 rounded-md p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                  value={logsFilterAction}
                  onChange={(e) => setLogsFilterAction(e.target.value)}
                >
                  <option value="">{t("allActions") || "All Actions"}</option>
                  {uniqueLogActions.map((action: string) => (
                    <option key={action} value={action}>{action}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <input
                    type="date"
                    className="border border-gray-300 rounded-md p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    value={logsStartDate}
                    onChange={(e) => setLogsStartDate(e.target.value)}
                  />
                  <span className="text-gray-500 text-sm">-</span>
                  <input
                    type="date"
                    className="border border-gray-300 rounded-md p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    value={logsEndDate}
                    onChange={(e) => setLogsEndDate(e.target.value)}
                  />
                </div>
                <button 
                  onClick={fetchLogs}
                  disabled={logsLoading}
                  className="w-full md:w-auto bg-brand-50 border border-brand-200 text-brand-700 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-brand-100 transition disabled:opacity-50"
                >
                  {logsLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logsLoading && filteredLogs.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Loading logs...</td></tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No activity logs found.</td></tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(log.timestamp).toLocaleString('en-GB')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {log.userEmail}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            log.action === 'LOGIN' ? 'bg-green-100 text-green-800' :
                            log.action === 'LOGOUT' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                          {log.details}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Addresses Modal */}
      {selectedUserAddresses !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">{t("deliveryAddresses") || "Delivery Addresses"}</h3>
              <button 
                onClick={() => setSelectedUserAddresses(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {selectedUserAddresses && selectedUserAddresses.length > 0 ? (
                <div className="space-y-4">
                  {selectedUserAddresses.map((addrStr, idx) => {
                    let parsed: any = {};
                    try {
                      parsed = JSON.parse(addrStr);
                    } catch {
                      parsed = { address: addrStr };
                    }
                    return (
                      <div key={idx} className="p-4 border border-gray-200 rounded-lg bg-gray-50 relative">
                        {parsed.isDefault && (
                          <span className="absolute top-3 right-3 bg-brand-100 text-brand-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                            {t("default") || "Default"}
                          </span>
                        )}
                        <div className="space-y-1 pr-16 text-sm">
                          {parsed.villageName && <p><span className="font-medium text-gray-700">{t("villageName")}:</span> {parsed.villageName}</p>}
                          {parsed.houseNo && <p><span className="font-medium text-gray-700">{t("houseNo")}:</span> {parsed.houseNo}</p>}
                          {parsed.telephone && <p><span className="font-medium text-gray-700">{t("telephone")}:</span> {parsed.telephone}</p>}
                          <p><span className="font-medium text-gray-700">{t("addressLine") || "Address"}:</span> {parsed.address || parsed}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {t("noAddressesFound") || "No addresses found for this user."}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedUserAddresses(null)}
                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition"
              >
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terms of Use Confirmation Modal */}
      {isTermsConfirmModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">{t("confirmSave") || "Confirm Save"}</h3>
              <button 
                onClick={() => setIsTermsConfirmModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-6">
                {t("confirmSaveTermsDesc") || "Are you sure you want to save the Terms of Use? These changes will be immediately visible to all users."}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setIsTermsConfirmModalOpen(false)}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleSaveTerms}
                  disabled={termsSaving}
                  className="bg-brand-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700 transition disabled:opacity-50"
                >
                  {t("confirm") || "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete User Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete User</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to completely remove this user? This will also delete all their shops and products. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition"
              >
                {t("cancel") || "Cancel"}
              </button>
              <button
                onClick={() => handleDeleteUser(userToDelete)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition"
              >
                {t("delete") || "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Shop Modal */}
      {shopToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Shop</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to completely remove this shop? This will also delete all its products. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShopToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition"
              >
                {t("cancel") || "Cancel"}
              </button>
              <button
                onClick={() => handleDeleteShop(shopToDelete)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition"
              >
                {t("delete") || "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
