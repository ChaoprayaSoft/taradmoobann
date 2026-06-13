"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Coins, Coffee } from "lucide-react";
import BuyCoffeeModal from "@/components/BuyCoffeeModal";
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

export default function ShopperDashboardClient({
  allMarkets,
  initialShops = [],
  initialAddresses = [],
  initialOrders = [],
  userCoins = 0,
  userMaxShopSlots = 0,
  initialEmailNotificationsEnabled = true,
  initialPushNotificationsEnabled = true
}: {
  allMarkets: any[],
  initialShops?: any[],
  initialAddresses: string[],
  initialOrders: any[],
  userCoins?: number,
  userMaxShopSlots?: number,
  initialEmailNotificationsEnabled?: boolean,
  initialPushNotificationsEnabled?: boolean
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const t = useTranslations("ShopperDashboard");

  const uniqueVillageNames = Array.from(new Set(allMarkets.map(m => m.villageName).filter(Boolean)));

  // Shop Creation State
  const [isOpeningShop, setIsOpeningShop] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // All markets are discoverable
  const discoverableMarkets = allMarkets;

  // Address State
  const [addresses, setAddresses] = useState<string[]>(initialAddresses);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // App Feedback State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackLoading(true);
    try {
      const res = await fetch("/api/shopper/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: feedbackRating, comment: feedbackComment })
      });
      if (!res.ok) {
        throw new Error("Failed to submit feedback");
      }
      setFeedbackSuccess(true);
      setTimeout(() => {
        setShowFeedbackModal(false);
        setFeedbackSuccess(false);
        setFeedbackComment("");
        setFeedbackRating(5);
      }, 2000);
    } catch (err) {
      alert("Error submitting feedback. Please try again.");
    } finally {
      setFeedbackLoading(false);
    }
  };
  const [showCoffeeModal, setShowCoffeeModal] = useState(false);

  // Notification Settings State
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(initialEmailNotificationsEnabled);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(initialPushNotificationsEnabled);
  const [isSavingPushNotifications, setIsSavingPushNotifications] = useState(false);

  const handleToggleNotifications = async () => {
    setIsSavingNotifications(true);
    const newValue = !emailNotificationsEnabled;
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailNotificationsEnabled: newValue })
      });
      if (res.ok) {
        setEmailNotificationsEnabled(newValue);
      } else {
        alert("Failed to save settings");
      }
    } catch (e) {
      console.error(e);
      alert("Something went wrong");
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const handleTogglePushNotifications = async () => {
    setIsSavingPushNotifications(true);
    const newValue = !pushNotificationsEnabled;
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pushNotificationsEnabled: newValue })
      });
      if (res.ok) {
        setPushNotificationsEnabled(newValue);
      } else {
        alert("Failed to save settings");
      }
    } catch (e) {
      console.error(e);
      alert("Something went wrong");
    } finally {
      setIsSavingPushNotifications(false);
    }
  };

  const [ownedShopsCount, setOwnedShopsCount] = useState(
    initialShops.filter(s => s.ownerEmail === session?.user?.email).length
  );

  const [editAddress, setEditAddress] = useState({
    villageName: "",
    houseNo: "",
    address: "",
    telephone: ""
  });

  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressSaved, setAddressSaved] = useState(false);

  const formatAddressForDisplay = (addrStr: string) => {
    try {
      const parsed = JSON.parse(addrStr);
      if (parsed.villageName !== undefined) {
        return `${t("villageName")}: ${parsed.villageName}\n${t("houseNo")}: ${parsed.houseNo}\n${t("addressLine")}: ${parsed.address}\n${t("telephone")}: ${parsed.telephone}`;
      }
    } catch (e) { }
    return addrStr;
  };

  const parseAddress = (addrStr: string) => {
    try {
      const parsed = JSON.parse(addrStr);
      if (parsed.villageName !== undefined) {
        return parsed;
      }
    } catch (e) { }
    return { villageName: "", houseNo: "", address: addrStr, telephone: "" };
  };

  const saveAddresses = async (newAddresses: string[]) => {
    setIsSavingAddress(true);
    setAddressSaved(false);

    try {
      const res = await fetch("/api/shopper/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: newAddresses }),
      });
      if (res.ok) {
        setAddresses(newAddresses);
        setEditingIndex(null);
        setAddressSaved(true);
        setTimeout(() => setAddressSaved(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save addresses", err);
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingIndex === null) return;

    const newAddresses = [...addresses];
    const jsonStr = JSON.stringify(editAddress);
    if (editingIndex >= newAddresses.length) {
      newAddresses.push(jsonStr);
    } else {
      newAddresses[editingIndex] = jsonStr;
    }

    saveAddresses(newAddresses);
  };

  const handleDeleteAddress = (index: number) => {
    const newAddresses = [...addresses];
    newAddresses.splice(index, 1);
    setEditingIndex(null);
    saveAddresses(newAddresses);
  };

  const handleAddNewAddress = () => {
    setEditAddress({
      villageName: "",
      houseNo: "",
      address: "",
      telephone: ""
    });
    setEditingIndex(addresses.length);
  };

  const [completingOrderId, setCompletingOrderId] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>(initialOrders);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);

  // Review states
  const [existingReview, setExistingReview] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  // Chat states
  const [myChats, setMyChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [chatInputText, setChatInputText] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<{ chatId: string, shopId: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [shopRequests, setShopRequests] = useState<any[]>(
    initialShops ? initialShops.filter(s => s.ownerEmail === session?.user?.email && s.status !== "approved") : []
  );

  useEffect(() => {
    if (!session?.user?.email) return;

    // Real-time Orders Listener
    const ordersQuery = query(
      collection(db, "orders"),
      where("shopperEmail", "==", session.user.email)
    );

    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const freshOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      freshOrders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(freshOrders);
    }, (error) => {
      console.error("Orders listener error:", error);
    });

    // Real-time Chats Listener
    const chatsQuery = query(
      collection(db, "shop_chats"),
      where("shopperEmail", "==", session.user.email)
    );

    const unsubscribeChats = onSnapshot(chatsQuery, async (snapshot) => {
      let freshChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      freshChats = freshChats.filter((c: any) => !c.deletedByShopper);
      freshChats.sort((a: any, b: any) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

      // Need to fetch shop names since they aren't stored in shop_chats doc
      // In a real app we might fetch these once and cache, or let backend do it
      // Since it's realtime, we will just use the shopId for now if it's missing

      setMyChats(freshChats);

      // Update selected chat if it exists
      if (selectedChat) {
        const updated = freshChats.find((c: any) => c.id === selectedChat.id);
        if (updated) setSelectedChat(updated);
      }
    }, (error) => {
      console.error("Chats listener error:", error);
    });

    // Real-time Shop Requests
    const shopReqQuery = query(
      collection(db, "shops"),
      where("ownerEmail", "==", session.user.email)
    );
    const unsubShops = onSnapshot(shopReqQuery, (snapshot) => {
      const allShops = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setShopRequests(allShops.filter((s: any) => s.status !== "approved"));
      setOwnedShopsCount(allShops.length);
    });

    // Real-time Membership Requests
    const memReqQuery = query(
      collection(db, "market_memberships"),
      where("userEmail", "==", session.user.email)
    );
    const unsubMems = onSnapshot(memReqQuery, (snapshot) => {
    });

    return () => {
      unsubscribeOrders();
      unsubscribeChats();
      unsubShops();
      unsubMems();
    };
  }, [session, selectedChat?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedChat?.messages]);

  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim() || !selectedChat) return;

    setChatLoading(true);
    const textToSend = chatInputText;
    setChatInputText("");

    try {
      // Optimistic update
      const newMessage = { text: textToSend, sender: "shopper", timestamp: new Date().toISOString() };
      setSelectedChat((prev: any) => ({
        ...prev,
        messages: [...(prev.messages || []), newMessage]
      }));

      await fetch("/api/shop-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: selectedChat.shopId,
          text: textToSend
        }),
      });

    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setChatLoading(false);
    }
  };

  const triggerDeleteChat = (e: React.MouseEvent, chatId: string, shopId: string) => {
    e.stopPropagation();
    setChatToDelete({ chatId, shopId });
  };

  const confirmDeleteChat = async () => {
    if (!chatToDelete) return;
    const { chatId, shopId } = chatToDelete;

    try {
      const res = await fetch("/api/shop-chat", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, shopId })
      });
      if (res.ok) {
        setMyChats(prev => prev.filter(c => c.id !== chatId));
        if (selectedChat?.id === chatId) {
          setSelectedChat(null);
        }
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete chat");
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
      alert("Something went wrong");
    } finally {
      setChatToDelete(null);
    }
  };

  const activeOrders = orders.filter(o => o.status !== "Completed" && o.status !== "Cancelled");
  const pastOrders = orders.filter(o => o.status === "Completed" || o.status === "Cancelled");

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelOrder = async (orderId: string, reason?: string) => {
    setIsCancelling(true);
    try {
      const res = await fetch("/api/shopper/orders/cancel", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, reason })
      });
      const data = await res.json();
      if (data.success) {
        setCancelModalOpen(false);
        setCancelReason("");
        setCancelOrderId("");
        router.refresh();
      } else {
        alert(data.error || "Failed to cancel order");
      }
    } catch (err) {
      console.error(err);
      alert("Error cancelling order");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleAcceptDelivery = async (orderId: string) => {
    setCompletingOrderId(orderId);
    try {
      const res = await fetch("/api/shopper/orders/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to complete order");
      }
    } catch (err) {
      alert("Something went wrong");
    } finally {
      setCompletingOrderId(null);
    }
  };

  const handleViewOrderDetails = async (order: any) => {
    setSelectedOrderDetails(order);
    setExistingReview(null);
    setReviewRating(5);
    setReviewComment("");

    try {
      const res = await fetch(`/api/public/reviews?orderId=${order.id}`);
      if (res.ok) {
        const reviews = await res.json();
        if (reviews.length > 0) {
          setExistingReview(reviews[0]);
        }
      }
    } catch (e) {
      console.error("Failed to fetch review", e);
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderDetails) return;

    setReviewLoading(true);
    try {
      const res = await fetch("/api/shopper/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrderDetails.id,
          shopId: selectedOrderDetails.shopId,
          rating: reviewRating,
          comment: reviewComment
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setExistingReview({
        ...data,
        rating: reviewRating,
        comment: reviewComment
      });
    } catch (err: any) {
      alert(err.message || "Failed to submit review");
    } finally {
      setReviewLoading(false);
    }
  };

  const [formData, setFormData] = useState({
    marketId: allMarkets.length > 0 ? allMarkets[0].id : "",
    name: "",
    description: "",
    category: CATEGORIES[0],
    coverImage: "",
    houseNumber: "",
    location: "",
  });
  const [locationType, setLocationType] = useState<"house" | "area">("house");



  const handleShopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      let finalImageUrl = "";

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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch("/api/shopper/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          coverImage: finalImageUrl,
          houseNumber: locationType === "house" ? formData.houseNumber : "",
          location: locationType === "area" ? formData.location : ""
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setSuccess(true);
      setIsOpeningShop(false);
      setFormData({
        marketId: allMarkets.length > 0 ? allMarkets[0].id : "",
        name: "",
        description: "",
        category: CATEGORIES[0],
        coverImage: "",
        houseNumber: "",
        location: ""
      });
      setLocationType("house");
      setFile(null);

      router.refresh();

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const [withdrawLoading, setWithdrawLoading] = useState<string | null>(null);
  const [withdrawConfirmModal, setWithdrawConfirmModal] = useState<{ type: 'shop' | 'membership', id: string, name: string } | null>(null);

  const executeWithdraw = async () => {
    if (!withdrawConfirmModal) return;
    const { type, id } = withdrawConfirmModal;

    setWithdrawLoading(`${type === 'shop' ? 'shop' : 'mem'}-${id}`);
    try {
      const res = await fetch(`/api/shopper/${type === 'shop' ? 'shops' : 'memberships'}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(type === 'shop' ? { shopId: id } : { membershipId: id })
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || `Failed to withdraw ${type} request.`);
      }
    } catch (error) {
      console.error(error);
      alert(`Error withdrawing ${type} request.`);
    } finally {
      setWithdrawLoading(null);
      setWithdrawConfirmModal(null);
    }
  };



  const [resubmitShopModal, setResubmitShopModal] = useState<{ id: string, name: string, description: string } | null>(null);
  const [resubmitShopLoading, setResubmitShopLoading] = useState(false);

  const handleResubmitShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resubmitShopModal) return;
    setResubmitShopLoading(true);
    try {
      const res = await fetch("/api/shop-owner/shops/revise", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: resubmitShopModal.id,
          name: resubmitShopModal.name,
          description: resubmitShopModal.description
        })
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to resubmit shop request.");
      } else {
        setResubmitShopModal(null);
      }
    } catch (err) {
      console.error(err);
      alert("Error resubmitting shop request.");
    } finally {
      setResubmitShopLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-gray-500 mt-1">{t("description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowFeedbackModal(true)}
            className="flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-md hover:bg-blue-100 transition shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span className="font-bold text-sm">{t("leaveComment")}</span>
          </button>
          <button
            onClick={() => setShowCoffeeModal(true)}
            className="flex items-center gap-2 bg-orange-50 text-orange-700 border border-orange-200 px-4 py-2 rounded-md hover:bg-orange-100 transition shadow-sm"
          >
            <Coffee className="w-5 h-5 text-orange-500" />
            <span className="font-bold text-sm">{t("buyCoffee")}</span>
          </button>

          <Link href="/shopper/wallet" className="flex items-center gap-2 bg-yellow-50 text-yellow-700 border border-yellow-200 px-4 py-2 rounded-md hover:bg-yellow-100 transition shadow-sm">
            <Coins className="w-5 h-5 text-yellow-500" />
            <div className="flex flex-col items-start leading-none">
              <span className="text-xs uppercase tracking-wider font-semibold opacity-70">{t("wallet")}</span>
              <span className="font-bold text-sm">{t("coins", { coins: userCoins })}</span>
            </div>
          </Link>
          <div className="relative group h-full flex items-center">
            <div className="flex flex-col items-center">
              <button
                onClick={() => {
                  if (addresses.length === 0) {
                    alert(t("addressRequiredFirst") || "You must set your delivery address before opening a shop.");
                    const el = document.getElementById("address-section");
                    if (el) {
                      window.scrollTo({ top: el.offsetTop - 100, behavior: "smooth" });
                    }
                  } else {
                    setIsOpeningShop(true);
                  }
                }}
                disabled={allMarkets.length === 0}
                className="bg-brand-600 text-white px-4 py-2 rounded-md font-medium hover:bg-brand-700 transition disabled:opacity-50 h-full flex items-center gap-2 shadow-sm disabled:cursor-not-allowed"
              >
                {t("openShop")}
                {ownedShopsCount >= userMaxShopSlots && (
                  <span className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                      <path d="M10.464 8.746c.227-.18.497-.311.786-.394v2.795a2.252 2.252 0 01-.786-.393c-.394-.313-.546-.681-.546-1.004 0-.323.152-.691.546-1.004zM12.75 15.662v-2.824c.347.085.664.228.921.421.427.32.579.686.579.991 0 .305-.152.671-.579.991a2.534 2.534 0 01-.921.42z" />
                      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v.816a3.836 3.836 0 00-1.72.756c-.712.566-1.112 1.35-1.112 2.178 0 .829.4 1.612 1.113 2.178.502.4 1.102.647 1.719.756v2.978a2.536 2.536 0 01-.921-.421l-.879-.66a.75.75 0 00-.9 1.2l.879.66c.533.4 1.169.645 1.821.75V18a.75.75 0 001.5 0v-.81a4.124 4.124 0 001.821-.749c.745-.559 1.179-1.344 1.179-2.191 0-.847-.434-1.632-1.179-2.191a4.122 4.122 0 00-1.821-.75V8.354c.29.082.559.213.786.393l.415.33a.75.75 0 00.933-1.175l-.415-.33a3.836 3.836 0 00-1.719-.755V6z" clipRule="evenodd" />
                    </svg>
                    20 Coins
                  </span>
                )}
              </button>
              <span className="text-[10px] text-gray-500 font-medium mt-1">
                {ownedShopsCount >= userMaxShopSlots
                  ? t("shopSlotLimit", { max: userMaxShopSlots })
                  : t("shopSlotUsed", { used: ownedShopsCount, max: userMaxShopSlots })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACCESS BUTTONS */}
      <div className="flex flex-wrap items-center gap-3 mt-4 border-b border-gray-200 pb-4">
        <a href="#my-messages" className="text-sm font-medium text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-full hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 transition shadow-sm flex items-center gap-2">
          {t("myMessage")}
        </a>
        <a href="#active-orders" className="text-sm font-medium text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-full hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 transition shadow-sm flex items-center gap-2">
          {t("activeOrders")}
        </a>
        <a href="#discover-markets" className="text-sm font-medium text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-full hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 transition shadow-sm flex items-center gap-2">
          {t("discoverMarkets")}
        </a>
        <a href="#notification-settings" className="text-sm font-medium text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-full hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 transition shadow-sm flex items-center gap-2">
          {t("notifications")}
        </a>
        {shopRequests.length > 0 && (
          <a href="#my-requests" className="text-sm font-medium text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-full hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 transition shadow-sm flex items-center gap-2">
            {t("myRequests")}
            <span className="bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full ml-1 font-bold">
              {shopRequests.length}
            </span>
          </a>
        )}
      </div>

      {/* NOTIFICATION SETTINGS */}
      <div id="notification-settings" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{t("notificationSettings")}</h2>

        <div className="space-y-4 max-w-2xl">
          <div className="flex items-center justify-between border border-gray-200 rounded-md p-4 bg-gray-50">
            <div>
              <h3 className="font-bold text-gray-800">{t("emailNotifications")}</h3>
              <p className="text-sm text-gray-500">{t("emailNotificationsDesc")}</p>
            </div>
            <button
              onClick={handleToggleNotifications}
              disabled={isSavingNotifications}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 ${emailNotificationsEnabled ? 'bg-brand-600' : 'bg-gray-200'}`}
            >
              <span className="sr-only">Toggle email notifications</span>
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${emailNotificationsEnabled ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between border border-gray-200 rounded-md p-4 bg-gray-50">
            <div>
              <h3 className="font-bold text-gray-800">{t("pushNotifications")}</h3>
              <p className="text-sm text-gray-500">{t("pushNotificationsDesc")}</p>
            </div>
            <button
              onClick={handleTogglePushNotifications}
              disabled={isSavingPushNotifications}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 ${pushNotificationsEnabled ? 'bg-brand-600' : 'bg-gray-200'}`}
            >
              <span className="sr-only">Toggle push notifications</span>
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${pushNotificationsEnabled ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* MY REQUESTS */}
      {shopRequests.length > 0 && (
        <div id="my-requests" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t("myRequests")}</h2>
          <div className="space-y-4">
            {shopRequests.map(req => (
              <div key={req.id} className="border border-gray-200 rounded-md p-4 flex justify-between items-center bg-gray-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">{t("shopRequest", { name: req.name })}</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                      {req.status === 'pending' ? t("pending") : t("needsRevision")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{t("requestedOn", { date: new Date(req.createdAt).toLocaleDateString() })}</p>
                  {req.status === 'needs_revision' && req.feedback && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded text-sm text-red-800">
                      <strong>{t("feedback")}</strong> {req.feedback}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {req.status === 'needs_revision' && (
                    <button
                      onClick={() => setResubmitShopModal({ id: req.id, name: req.name, description: req.description || "" })}
                      className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-1.5 px-3 rounded shadow-sm"
                    >
                      {t("reviseShop")}
                    </button>
                  )}
                  <button
                    onClick={() => setWithdrawConfirmModal({ type: 'shop', id: req.id, name: req.name })}
                    disabled={withdrawLoading === `shop-${req.id}`}
                    className="text-red-600 hover:text-red-800 text-xs font-bold disabled:opacity-50 border border-red-200 hover:bg-red-50 py-1.5 px-3 rounded"
                  >
                    {withdrawLoading === `shop-${req.id}` ? t("withdrawing") : t("withdraw")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DELIVERY ADDRESS */}
      <div id="address-section" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-8 mt-12 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-brand-400 to-brand-600 rounded-l-2xl"></div>
        
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-50">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{t("myAddresses")}</h2>
            <p className="text-gray-500 text-sm mt-1">Set up to 3 delivery addresses for faster checkout within your markets.</p>
          </div>
          {addressSaved && <span className="text-green-600 text-sm font-medium bg-green-50 px-3 py-1 rounded-full">{t("addressSaved")}</span>}
        </div>

        <div className="space-y-4 max-w-2xl">
          {addresses.map((addr, idx) => (
            <div key={idx} className="border border-gray-200 rounded-md p-4 bg-gray-50">
              {editingIndex === idx ? (
                <form onSubmit={handleSaveEdit} className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      required
                      className="rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                      value={editAddress.villageName}
                      onChange={(e) => setEditAddress({ ...editAddress, villageName: e.target.value })}
                    >
                      <option value="" disabled>{t("villageName")} *</option>
                      {uniqueVillageNames.map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                    <input
                      required
                      type="text"
                      placeholder={t("houseNo") + " *"}
                      className="rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                      value={editAddress.houseNo}
                      onChange={(e) => setEditAddress({ ...editAddress, houseNo: e.target.value })}
                    />
                    <input
                      required
                      type="text"
                      placeholder={t("telephone") + " *"}
                      className="rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                      value={editAddress.telephone}
                      onChange={(e) => setEditAddress({ ...editAddress, telephone: e.target.value })}
                    />
                    <input
                      required
                      type="text"
                      placeholder={t("addressLine") + " *"}
                      className="rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                      value={editAddress.address}
                      onChange={(e) => setEditAddress({ ...editAddress, address: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="submit"
                      disabled={isSavingAddress}
                      className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50"
                    >
                      {isSavingAddress ? "Saving..." : t("save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingIndex(null)}
                      className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(idx)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium mt-2"
                    >
                      Delete
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex justify-between items-start gap-4">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap flex-1 leading-relaxed">{formatAddressForDisplay(addr)}</p>
                  <button
                    onClick={() => {
                      setEditAddress(parseAddress(addr));
                      setEditingIndex(idx);
                    }}
                    className="text-brand-600 hover:text-brand-800 text-sm font-medium px-3 py-1 bg-white border border-brand-200 rounded hover:bg-brand-50 transition flex-shrink-0"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}

          {editingIndex === addresses.length && (
            <div className="border border-brand-200 rounded-md p-4 bg-brand-50">
              <form onSubmit={handleSaveEdit} className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    required
                    className="rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                    value={editAddress.villageName}
                    onChange={(e) => setEditAddress({ ...editAddress, villageName: e.target.value })}
                  >
                    <option value="" disabled>{t("villageName")} *</option>
                    {uniqueVillageNames.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <input
                    required
                    type="text"
                    placeholder={t("houseNo") + " *"}
                    className="rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                    value={editAddress.houseNo}
                    onChange={(e) => setEditAddress({ ...editAddress, houseNo: e.target.value })}
                  />
                  <input
                    required
                    type="text"
                    placeholder={t("telephone") + " *"}
                    className="rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                    value={editAddress.telephone}
                    onChange={(e) => setEditAddress({ ...editAddress, telephone: e.target.value })}
                  />
                  <input
                    required
                    type="text"
                    placeholder={t("addressLine") + " *"}
                    className="rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                    value={editAddress.address}
                    onChange={(e) => setEditAddress({ ...editAddress, address: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={isSavingAddress}
                    className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50"
                  >
                    {isSavingAddress ? "Saving..." : t("save")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingIndex(null)}
                    className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                  >
                    {t("cancel")}
                  </button>
                </div>
              </form>
            </div>
          )}

          {addresses.length < 3 && editingIndex !== addresses.length && (
            <button
              onClick={handleAddNewAddress}
              className="w-full border-2 border-dashed border-gray-300 rounded-md p-4 text-sm font-medium text-gray-500 hover:text-brand-600 hover:border-brand-400 transition bg-white"
            >
              + {t("addNewAddress")}
            </button>
          )}
        </div>
      </div>

      {/* SHOP CREATION MESSAGES & FORM */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-md">
          <p className="font-semibold text-lg">{t("shopSubmitted")}</p>
          <p className="text-sm mt-1">{t("shopSubmittedDesc")}</p>
          <p className="text-sm mt-1 underline cursor-pointer font-medium" onClick={() => signIn('google')}>{t("reLogin")}</p>
        </div>
      )}

      {isOpeningShop && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{t("openShopTitle")}</h2>
                <p className="text-gray-500 text-sm mt-1">{t("openShopDesc")}</p>
              </div>
              <button
                onClick={() => setIsOpeningShop(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto">
              {error && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm">{error}</div>}

              <form onSubmit={handleShopSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t("selectMarket")}</label>
                  <select
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                    value={formData.marketId}
                    onChange={(e) => setFormData({ ...formData, marketId: e.target.value })}
                  >
                    {allMarkets.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                {formData.marketId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t("villageName")}</label>
                    <input
                      type="text"
                      disabled
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 bg-gray-50 text-gray-500 cursor-not-allowed"
                      value={allMarkets.find(m => m.id === formData.marketId)?.villageName || ""}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t("shopNameLabel")}</label>
                  <input
                    required
                    type="text"
                    placeholder={t("shopNamePlaceholder")}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t("categoryLabel")}</label>
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
                  <label className="block text-sm font-medium text-gray-700">{t("descriptionLabel")}</label>
                  <textarea
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t("locationType")}</label>
                  <div className="flex gap-6 mb-3">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="locationType"
                        value="house"
                        checked={locationType === "house"}
                        onChange={() => setLocationType("house")}
                        className="text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                      />
                      {t("houseNumberOpt")}
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="locationType"
                        value="area"
                        checked={locationType === "area"}
                        onChange={() => setLocationType("area")}
                        className="text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                      />
                      {t("nearbyAreaOpt")}
                    </label>
                  </div>

                  {locationType === "house" ? (
                    <div>
                      <input
                        required
                        type="number"
                        placeholder={t("houseNumberPlaceholder")}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                        value={formData.houseNumber}
                        onChange={(e) => setFormData({ ...formData, houseNumber: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div>
                      <input
                        required
                        type="text"
                        maxLength={100}
                        placeholder={t("nearbyAreaPlaceholder")}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      />
                    </div>
                  )}
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
                <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsOpeningShop(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition"
                  >
                    {t("cancelButton")}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-brand-600 text-white px-6 py-2 rounded-md font-medium hover:bg-brand-700 transition disabled:opacity-50"
                  >
                    {loading ? t("submittingShop") : t("submitShopButton")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MY MESSAGES */}
      <div id="my-messages" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 scroll-mt-6">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-gray-900">
          {t("myMessage")}
          {myChats.some(c => c.unreadByShopper) && (
            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">NEW</span>
          )}
        </h2>

        <div className="flex flex-col md:flex-row gap-6 border border-gray-200 rounded-lg overflow-hidden h-[600px] md:h-[500px]">
          {/* Chat List */}
          <div className={`w-full md:w-1/3 border-r border-gray-200 bg-gray-50 flex-col overflow-y-auto ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
            {myChats.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 text-center mt-10">{t("noMessages")}</p>
            ) : (
              myChats.map(chat => (
                <div key={chat.id} className="relative group">
                  <button
                    onClick={() => setSelectedChat(chat)}
                    className={`w-full p-4 text-left border-b border-gray-200 hover:bg-gray-100 transition pr-10 ${selectedChat?.id === chat.id ? 'bg-brand-50 border-l-4 border-l-brand-600' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-medium text-gray-900 text-sm truncate pr-2">{chat.shopName}</p>
                      {chat.unreadByShopper && (
                        <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1.5"></span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].text : t("newChat")}
                    </p>
                  </button>
                  <button
                    onClick={(e) => triggerDeleteChat(e, chat.id, chat.shopId)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                    title="Delete conversation"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Chat View */}
          <div className={`w-full md:w-2/3 bg-white flex-col relative ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
            {selectedChat ? (
              <>
                <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10 flex items-center">
                  <button
                    onClick={() => setSelectedChat(null)}
                    className="md:hidden mr-3 text-gray-500 hover:text-gray-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                  <h3 className="font-bold text-gray-900">{selectedChat.shopName}</h3>
                </div>

                <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col space-y-3">
                  {selectedChat.messages.map((msg: any, i: number) => (
                    <div key={i} className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.sender === "shopper"
                      ? "bg-brand-600 text-white self-end rounded-br-none"
                      : "bg-gray-200 text-gray-800 self-start rounded-bl-none"
                      }`}>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      <span className={`text-[10px] mt-1 block ${msg.sender === "shopper" ? "text-brand-200" : "text-gray-500"}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 bg-white border-t border-gray-200">
                  <form onSubmit={sendChatMessage} className="flex gap-2">
                    <input
                      type="text"
                      value={chatInputText}
                      onChange={(e) => setChatInputText(e.target.value)}
                      placeholder={t("typeMessage")}
                      className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-brand-500 text-gray-900"
                      disabled={chatLoading}
                    />
                    <button
                      type="submit"
                      disabled={chatLoading || !chatInputText.trim()}
                      className="bg-brand-600 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-brand-700 transition disabled:opacity-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-1">
                        <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                      </svg>
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-4">
                {t("selectConversation")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MY ORDERS */}
      <div id="active-orders" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 scroll-mt-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">{t("activeOrders")}</h2>
        {activeOrders.length === 0 ? (
          <p className="text-gray-500 text-sm mb-6">{t("noActiveOrders")}</p>
        ) : (
          <div className="space-y-4 mb-8">
            {activeOrders.map(order => {
              const shop = initialShops.find(s => s.id === order.shopId);

              return (
                <div key={order.id} className="mb-4">
                  <div className="border border-brand-200 rounded-lg p-4 bg-brand-50 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${order.status === 'Pending Completion' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'Out for Delivery' ? 'bg-purple-100 text-purple-800' :
                            order.status === 'Preparing' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-200 text-gray-800'
                          }`}>
                          {order.status}
                        </span>
                        <span className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="font-bold text-gray-900">Total: ฿{Number(order.totalAmount || 0).toFixed(2)}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                        {order.items.map((item: any) => `${item.quantity}x ${item.productName}`).join(", ")}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 min-w-[140px]">
                      <button
                        onClick={() => handleViewOrderDetails(order)}
                        className="bg-brand-50 text-brand-700 border border-brand-200 px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-100 transition"
                      >
                        {t("viewDetails") || "View Details"}
                      </button>
                      {(order.status === "Pending Completion" || order.status === "Out for Delivery") && (
                        <button
                          disabled={completingOrderId === order.id}
                          onClick={() => handleAcceptDelivery(order.id)}
                          className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50"
                        >
                          Accept Delivery
                        </button>
                      )}
                      {order.status === "Pending" && (
                        <button
                          disabled={isCancelling}
                          onClick={() => handleCancelOrder(order.id)}
                          className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-md text-sm font-medium hover:bg-red-100 transition disabled:opacity-50"
                        >
                          {t("cancelOrder") || "Cancel Order"}
                        </button>
                      )}
                      {order.status === "Preparing" && (
                        <button
                          onClick={() => {
                            setCancelOrderId(order.id);
                            setCancelModalOpen(true);
                          }}
                          className="bg-orange-50 text-orange-600 border border-orange-200 px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-100 transition disabled:opacity-50"
                        >
                          {t("requestCancel") || "Request Cancel"}
                        </button>
                      )}
                      {order.status === "Cancel Requested" && (
                        <span className="text-orange-600 font-medium text-sm text-center px-2 py-1 bg-orange-50 rounded border border-orange-100">
                          {t("cancelPending") || "Cancel Pending..."}
                        </span>
                      )}
                    </div>
                  </div>
                  {order.cancelDeclineReason && order.status === "Preparing" && (
                    <div className="bg-red-50 text-red-700 text-xs mt-2 p-2 rounded-lg border border-red-100">
                      <span className="font-semibold">{t("cancelDeclined") || "Cancel Declined"}: </span>
                      {order.cancelDeclineReason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <h2 className="text-xl font-semibold mb-4 text-gray-900 border-t border-gray-200 pt-6">{t("orderHistory")}</h2>
        {pastOrders.length === 0 ? (
          <p className="text-gray-500 text-sm">{t("noPastOrders")}</p>
        ) : (
          <div className="space-y-3">
            {pastOrders.map(order => (
              <div key={order.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50 flex justify-between items-center opacity-75 hover:opacity-100 transition">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800">
                      Completed
                    </span>
                    <span className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 mt-1">{t("total", { amount: Number(order.totalAmount || 0).toFixed(2) })}</p>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  <p className="text-xs text-gray-500">
                    {order.items.length} {order.items.length === 1 ? t("item") : t("items")}
                  </p>
                  <button
                    onClick={() => handleViewOrderDetails(order)}
                    className="mt-4 w-full bg-gray-100 text-gray-700 font-medium py-2 rounded hover:bg-gray-200 transition"
                  >
                    {t("viewDetails")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DISCOVER MARKETS */}
      <div id="discover-markets" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 scroll-mt-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">{t("discoverMarketsTitle")}</h2>
        {discoverableMarkets.length === 0 ? (
          <p className="text-gray-500 text-sm">{t("noNewMarkets")}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {discoverableMarkets.map(market => (
              <div key={market.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition flex flex-col h-full">
                <button
                  onClick={() => router.push(`/market/${market.id}`)}
                  className="w-full h-32 block overflow-hidden group text-left relative focus:outline-none"
                >
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center">
                    <span className="text-white font-medium bg-black/50 px-3 py-1 rounded-full">{t("enterMarket")}</span>
                  </div>
                  {market.coverImage ? (
                    <img src={market.coverImage} alt={market.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 transition-colors duration-300 group-hover:bg-gray-200">
                      {t("noImage")}
                    </div>
                  )}
                </button>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-bold text-gray-900">{market.name}</h3>
                  <p className="text-xs text-brand-600 font-medium mb-1">{market.villageName || ""}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 flex-1">{market.description}</p>

                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                    <div className="flex items-center gap-1.5" title="Approved Shops">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                      </svg>
                      <span>{market.shopsCount || 0}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => router.push(`/market/${market.id}`)}
                    className="mt-4 w-full bg-brand-50 text-brand-700 py-2 rounded text-sm font-semibold hover:bg-brand-100 transition"
                  >
                    {t("enterMarket")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-900">Order Details</h3>
              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-1">Shop</p>
                <p className="font-medium text-gray-900">
                  {(() => {
                    const shop = initialShops.find(s => s.id === selectedOrderDetails.shopId);
                    return shop ? shop.name : "Unknown Shop";
                  })()}
                </p>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-1">Date</p>
                <p className="font-medium text-gray-900">{new Date(selectedOrderDetails.createdAt).toLocaleString()}</p>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <p className="font-semibold text-sm text-gray-700">Items ({selectedOrderDetails.items.length})</p>
                </div>
                <ul className="divide-y divide-gray-100">
                  {selectedOrderDetails.items.map((item: any, i: number) => (
                    <li key={i} className="p-4 flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.productName}</p>

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
                          <p className="text-[11px] text-gray-500 mt-1 italic line-clamp-2">Note: {item.note}</p>
                        )}

                        <p className="text-xs text-gray-500 mt-1">฿{Number(item.price || 0).toFixed(2)} x {item.quantity}</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 ml-4">฿{(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</p>
                    </li>
                  ))}
                </ul>
                <div className="bg-brand-50 px-4 py-3 border-t border-brand-100 flex justify-between items-center">
                  <p className="font-bold text-brand-900">Total Amount</p>
                  <p className="font-bold text-lg text-brand-900">฿{Number(selectedOrderDetails.totalAmount || 0).toFixed(2)}</p>
                </div>
              </div>

              {/* Review Section */}
              {selectedOrderDetails.status === 'Completed' && (
                <div className="border-t border-gray-200 pt-6">
                  <h4 className="font-bold text-gray-900 mb-4">Shop Review</h4>
                  {existingReview ? (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex text-brand-500 mb-2">
                        {[1, 2, 3, 4, 5].map(star => (
                          <svg key={star} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={star <= existingReview.rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                          </svg>
                        ))}
                      </div>
                      {existingReview.comment && (
                        <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{existingReview.comment}</p>
                      )}
                      {existingReview.ownerReply && (
                        <div className="mt-4 bg-white p-3 rounded border border-brand-100 text-sm">
                          <p className="font-bold text-brand-800 text-xs mb-1">Reply from Shop Owner:</p>
                          <p className="text-gray-700">{existingReview.ownerReply}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={submitReview} className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-700 mb-2">Rate your experience</p>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(star => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setReviewRating(star)}
                              className="text-brand-500 hover:scale-110 transition"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={star <= reviewRating ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                              </svg>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Comment (optional)</label>
                        <textarea
                          className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                          rows={3}
                          placeholder="Tell us what you thought..."
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={reviewLoading}
                        className="bg-brand-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-brand-700 transition disabled:opacity-50"
                      >
                        {reviewLoading ? "Submitting..." : "Submit Review"}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CHAT CONFIRMATION MODAL */}
      {chatToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-2">Delete Conversation</h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to delete this conversation? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setChatToDelete(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteChat}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Confirmation Modal */}
      {withdrawConfirmModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl transform scale-100">
            <div className="p-6">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-red-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Withdraw Request?</h3>
              <p className="text-gray-500 text-center mb-6">
                Are you sure you want to withdraw your <strong>{withdrawConfirmModal.type === 'shop' ? 'Shop' : 'Membership'}</strong> request for <span className="font-semibold text-gray-700">"{withdrawConfirmModal.name}"</span>? This action cannot be undone.
              </p>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setWithdrawConfirmModal(null)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={executeWithdraw}
                  disabled={withdrawLoading !== null}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition shadow-md disabled:opacity-50 disabled:shadow-none flex justify-center items-center"
                >
                  {withdrawLoading !== null ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    "Yes, Withdraw"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resubmit Shop Modal */}
      {resubmitShopModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">Revise Shop Details</h2>
              <button onClick={() => setResubmitShopModal(null)} className="text-gray-400 hover:text-gray-600 transition">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleResubmitShop} className="p-6">
              <p className="text-gray-600 mb-4 text-sm">
                Update your shop details below to address the market owner's feedback.
              </p>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Shop Name</label>
                  <input
                    required
                    type="text"
                    className="w-full rounded-md border-gray-300 shadow-sm border p-3 focus:ring-brand-500 focus:border-brand-500 text-sm"
                    value={resubmitShopModal.name}
                    onChange={(e) => setResubmitShopModal({ ...resubmitShopModal, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                  <textarea
                    required
                    className="w-full rounded-md border-gray-300 shadow-sm border p-3 focus:ring-brand-500 focus:border-brand-500 text-sm"
                    rows={4}
                    value={resubmitShopModal.description}
                    onChange={(e) => setResubmitShopModal({ ...resubmitShopModal, description: e.target.value })}
                  ></textarea>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setResubmitShopModal(null)}
                  className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50 transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resubmitShopLoading}
                  className="px-5 py-2.5 bg-brand-600 text-white rounded-md font-bold hover:bg-brand-700 transition shadow-sm disabled:opacity-50 flex items-center justify-center text-sm min-w-[120px]"
                >
                  {resubmitShopLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    "Resubmit Shop"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL REQUEST MODAL */}
      {cancelModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">{t("requestCancelTitle") || "Request Cancellation"}</h2>
              <button onClick={() => setCancelModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">{t("requestCancelDesc") || "The shop is already preparing your order. You can request a cancellation, but it's up to the shop owner to accept it."}</p>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("reasonOptional") || "Reason (Optional)"}</label>
              <textarea
                rows={3}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500 p-2"
                placeholder={t("reasonPlaceholder") || "Why do you want to cancel?"}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              ></textarea>
              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                <button type="button" onClick={() => setCancelModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition">
                  {t("cancel") || "Close"}
                </button>
                <button 
                  onClick={() => handleCancelOrder(cancelOrderId, cancelReason)}
                  disabled={isCancelling} 
                  className="bg-orange-600 text-white px-6 py-2 rounded-md font-medium hover:bg-orange-700 disabled:opacity-50 transition"
                >
                  {isCancelling ? t("submitting") || "Submitting..." : t("submitRequest") || "Submit Request"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* APP FEEDBACK MODAL */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">{t("leaveComment")}</h2>
              <button onClick={() => setShowFeedbackModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6">
              {feedbackSuccess ? (
                <div className="text-center py-8">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{t("feedbackSuccess")}</h3>
                  <p className="text-gray-500 text-sm">{t("feedbackSuccessDesc")}</p>
                </div>
              ) : (
                <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t("rating")}</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFeedbackRating(star)}
                          className="focus:outline-none"
                        >
                          <svg
                            className={`w-8 h-8 ${feedbackRating >= star ? "text-yellow-400" : "text-gray-300"}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t("comment/request features")}</label>
                    <textarea
                      required
                      rows={4}
                      className="w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500 p-2"
                      placeholder={t("commentPlaceholder") || "Any features you'd like to see?"}
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                    ></textarea>
                  </div>
                  <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                    <button type="button" onClick={() => setShowFeedbackModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition">
                      {t("cancel")}
                    </button>
                    <button type="submit" disabled={feedbackLoading} className="bg-brand-600 text-white px-6 py-2 rounded-md font-medium hover:bg-brand-700 disabled:opacity-50 transition">
                      {feedbackLoading ? t("submitting") : t("submit")}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      <BuyCoffeeModal isOpen={showCoffeeModal} onClose={() => setShowCoffeeModal(false)} />
    </div>
  );
}
