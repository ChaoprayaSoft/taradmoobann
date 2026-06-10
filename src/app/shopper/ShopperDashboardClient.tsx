"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Coins } from "lucide-react";

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
  memberships, 
  initialAddresses = [], 
  initialOrders = [],
  userCoins = 0,
  userMaxShopSlots = 1
}: { 
  allMarkets: any[], 
  initialShops?: any[],
  memberships: any[], 
  initialAddresses: string[], 
  initialOrders: any[],
  userCoins?: number,
  userMaxShopSlots?: number
}) {
  const router = useRouter();
  const { data: session } = useSession();
  
  // Membership Request State
  const [requestingMarketId, setRequestingMarketId] = useState<string | null>(null);
  const [applicationNote, setApplicationNote] = useState("");
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [membershipError, setMembershipError] = useState("");

  // Shop Creation State
  const [isOpeningShop, setIsOpeningShop] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // Markets the user is approved to enter
  const approvedMarketIds = memberships.filter(m => m.status === "approved").map(m => m.marketId);
  const approvedMarkets = allMarkets.filter(m => approvedMarketIds.includes(m.id));

  // Unjoined markets
  const membershipMarketIds = memberships.map(m => m.marketId);
  const discoverableMarkets = allMarkets.filter(m => !membershipMarketIds.includes(m.id));

  // Address State
  const [addresses, setAddresses] = useState<string[]>(initialAddresses);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [ownedShopsCount, setOwnedShopsCount] = useState(
    initialShops.filter(s => s.ownerEmail === session?.user?.email).length
  );
  const [editValue, setEditValue] = useState("");
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressSaved, setAddressSaved] = useState(false);

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
    if (editValue.trim() === "") {
      // Remove address if empty
      newAddresses.splice(editingIndex, 1);
    } else {
      if (editingIndex >= newAddresses.length) {
        newAddresses.push(editValue);
      } else {
        newAddresses[editingIndex] = editValue;
      }
    }
    
    saveAddresses(newAddresses);
  };

  const handleAddNewAddress = () => {
    setEditValue("");
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
  const [chatToDelete, setChatToDelete] = useState<{chatId: string, shopId: string} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [shopRequests, setShopRequests] = useState<any[]>(
    initialShops ? initialShops.filter(s => s.ownerEmail === session?.user?.email && s.status !== "approved") : []
  );
  const [membershipRequests, setMembershipRequests] = useState<any[]>(
    memberships.filter(m => m.status !== "approved")
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
      const allMems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMembershipRequests(allMems.filter((m: any) => m.status !== "approved"));
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

  const activeOrders = orders.filter(o => o.status !== "Completed");
  const pastOrders = orders.filter(o => o.status === "Completed");

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
    marketId: approvedMarkets.length > 0 ? approvedMarkets[0].id : "",
    name: "",
    description: "",
    category: CATEGORIES[0],
    coverImage: "",
    houseNumber: "",
    location: "",
  });

  const submitMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestingMarketId || !applicationNote.trim()) return;

    setMembershipLoading(true);
    setMembershipError("");

    try {
      const res = await fetch("/api/shopper/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: requestingMarketId,
          applicationNote
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to request access");

      setRequestingMarketId(null);
      setApplicationNote("");
      router.refresh();
    } catch (err: any) {
      setMembershipError(err.message);
    } finally {
      setMembershipLoading(false);
    }
  };

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
        body: JSON.stringify({ ...formData, coverImage: finalImageUrl }),
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
        marketId: approvedMarkets.length > 0 ? approvedMarkets[0].id : "", 
        name: "", 
        description: "", 
        category: CATEGORIES[0], 
        coverImage: "", 
        houseNumber: "",
        location: ""
      });
      setFile(null);
      
      router.refresh();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const [withdrawLoading, setWithdrawLoading] = useState<string | null>(null);
  const [withdrawConfirmModal, setWithdrawConfirmModal] = useState<{type: 'shop' | 'membership', id: string, name: string} | null>(null);

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

  const [resubmitMemModal, setResubmitMemModal] = useState<{id: string, marketId: string, name: string, note: string} | null>(null);
  const [resubmitMemLoading, setResubmitMemLoading] = useState(false);

  const [resubmitShopModal, setResubmitShopModal] = useState<{id: string, name: string, description: string} | null>(null);
  const [resubmitShopLoading, setResubmitShopLoading] = useState(false);

  const handleResubmitMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resubmitMemModal) return;
    setResubmitMemLoading(true);
    try {
      const res = await fetch("/api/shopper/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: resubmitMemModal.marketId, applicationNote: resubmitMemModal.note })
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to resubmit membership.");
      } else {
        setResubmitMemModal(null);
      }
    } catch (err) {
      console.error(err);
      alert("Error resubmitting membership.");
    } finally {
      setResubmitMemLoading(false);
    }
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Shopper Dashboard</h1>
          <p className="text-gray-500 mt-1">Discover markets, track memberships, and open your own shop.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/shopper/wallet" className="flex items-center gap-2 bg-yellow-50 text-yellow-700 border border-yellow-200 px-4 py-2 rounded-md hover:bg-yellow-100 transition shadow-sm">
            <Coins className="w-5 h-5 text-yellow-500" />
            <div className="flex flex-col items-start leading-none">
              <span className="text-xs uppercase tracking-wider font-semibold opacity-70">Wallet</span>
              <span className="font-bold text-sm">{userCoins} Coins</span>
            </div>
          </Link>
          <div className="relative group h-full flex items-center">
            <div className="flex flex-col items-center">
              <button 
                onClick={() => setIsOpeningShop(true)}
                disabled={approvedMarkets.length === 0}
                className="bg-brand-600 text-white px-4 py-2 rounded-md font-medium hover:bg-brand-700 transition disabled:opacity-50 h-full flex items-center gap-2 shadow-sm disabled:cursor-not-allowed"
              >
                Open a Shop
                {ownedShopsCount >= userMaxShopSlots && (
                  <span className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                      <path d="M10.464 8.746c.227-.18.497-.311.786-.394v2.795a2.252 2.252 0 01-.786-.393c-.394-.313-.546-.681-.546-1.004 0-.323.152-.691.546-1.004zM12.75 15.662v-2.824c.347.085.664.228.921.421.427.32.579.686.579.991 0 .305-.152.671-.579.991a2.534 2.534 0 01-.921.42z" />
                      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v.816a3.836 3.836 0 00-1.72.756c-.712.566-1.112 1.35-1.112 2.178 0 .829.4 1.612 1.113 2.178.502.4 1.102.647 1.719.756v2.978a2.536 2.536 0 01-.921-.421l-.879-.66a.75.75 0 00-.9 1.2l.879.66c.533.4 1.169.645 1.821.75V18a.75.75 0 001.5 0v-.81a4.124 4.124 0 001.821-.749c.745-.559 1.179-1.344 1.179-2.191 0-.847-.434-1.632-1.179-2.191a4.122 4.122 0 00-1.821-.75V8.354c.29.082.559.213.786.393l.415.33a.75.75 0 00.933-1.175l-.415-.33a3.836 3.836 0 00-1.719-.755V6z" clipRule="evenodd" />
                    </svg>
                    10 Coins
                  </span>
                )}
              </button>
              <span className="text-[10px] text-gray-500 font-medium mt-1">
                {ownedShopsCount >= userMaxShopSlots 
                  ? `You have reached ${userMaxShopSlots} shop slot limit.` 
                  : `Used ${ownedShopsCount} out of ${userMaxShopSlots} shop slots.`}
              </span>
            </div>
            {approvedMarkets.length === 0 && (
              <div className="absolute top-full right-0 mt-3 w-64 p-3 bg-brand-900 text-white text-sm text-center rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 transform origin-top translate-y-2 group-hover:translate-y-0 border border-brand-700">
                <div className="absolute -top-2 right-6 w-4 h-4 bg-brand-900 border-t border-l border-brand-700 transform rotate-45"></div>
                <div className="relative z-10 flex items-start gap-2 text-left">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-brand-300 flex-shrink-0 mt-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  <span className="font-medium text-brand-50 tracking-wide leading-snug">
                    You have to be a market member to open a shop.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QUICK ACCESS BUTTONS */}
      <div className="flex flex-wrap items-center gap-3 mt-4 border-b border-gray-200 pb-4">
        <a href="#market-memberships" className="text-sm font-medium text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-full hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 transition shadow-sm flex items-center gap-2">
          Market Membership
        </a>
        <a href="#my-messages" className="text-sm font-medium text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-full hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 transition shadow-sm flex items-center gap-2">
          My Message
        </a>
        <a href="#active-orders" className="text-sm font-medium text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-full hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 transition shadow-sm flex items-center gap-2">
          Active Orders
        </a>
        <a href="#discover-markets" className="text-sm font-medium text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-full hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 transition shadow-sm flex items-center gap-2">
          Discover Markets
        </a>
        {(shopRequests.length > 0 || membershipRequests.length > 0) && (
          <a href="#my-requests" className="text-sm font-medium text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-full hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 transition shadow-sm flex items-center gap-2">
            My Requests
            <span className="bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full ml-1 font-bold">
              {shopRequests.length + membershipRequests.length}
            </span>
          </a>
        )}
      </div>

      {/* MY REQUESTS */}
      {(shopRequests.length > 0 || membershipRequests.length > 0) && (
        <div id="my-requests" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">My Requests</h2>
          <div className="space-y-4">
            {shopRequests.map(req => (
              <div key={req.id} className="border border-gray-200 rounded-md p-4 flex justify-between items-center bg-gray-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">Shop Request: {req.name}</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                      {req.status === 'pending' ? 'Pending' : 'Needs Revision'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Requested on {new Date(req.createdAt).toLocaleDateString()}</p>
                  {req.status === 'needs_revision' && req.feedback && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded text-sm text-red-800">
                      <strong>Feedback:</strong> {req.feedback}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {req.status === 'needs_revision' && (
                    <button 
                      onClick={() => setResubmitShopModal({ id: req.id, name: req.name, description: req.description || "" })}
                      className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-1.5 px-3 rounded shadow-sm"
                    >
                      Revise Shop
                    </button>
                  )}
                  <button 
                    onClick={() => setWithdrawConfirmModal({ type: 'shop', id: req.id, name: req.name })}
                    disabled={withdrawLoading === `shop-${req.id}`}
                    className="text-red-600 hover:text-red-800 text-xs font-bold disabled:opacity-50 border border-red-200 hover:bg-red-50 py-1.5 px-3 rounded"
                  >
                    {withdrawLoading === `shop-${req.id}` ? "Withdrawing..." : "Withdraw"}
                  </button>
                </div>
              </div>
            ))}
            {membershipRequests.map(req => {
              const marketName = allMarkets.find(m => m.id === req.marketId)?.name || 'Unknown Market';
              return (
                <div key={req.id} className="border border-gray-200 rounded-md p-4 flex justify-between items-center bg-gray-50">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800">Membership Request: {marketName}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {req.status === 'pending' ? 'Pending' : 'Needs Revision'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Requested on {new Date(req.createdAt).toLocaleDateString()}</p>
                    {req.status === 'needs_revision' && req.feedback && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded text-sm text-red-800">
                        <strong>Feedback:</strong> {req.feedback}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {req.status === 'needs_revision' && (
                      <button 
                        onClick={() => setResubmitMemModal({ id: req.id, marketId: req.marketId, name: marketName, note: req.applicationNote || '' })}
                        className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-1.5 px-3 rounded shadow-sm"
                      >
                        Resubmit
                      </button>
                    )}
                    <button 
                      onClick={() => setWithdrawConfirmModal({ type: 'membership', id: req.id, name: marketName })}
                      disabled={withdrawLoading === `mem-${req.id}`}
                      className="text-red-600 hover:text-red-800 text-xs font-bold disabled:opacity-50 border border-red-200 hover:bg-red-50 py-1.5 px-3 rounded"
                    >
                      {withdrawLoading === `mem-${req.id}` ? "Withdrawing..." : "Withdraw"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DELIVERY ADDRESS */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Delivery Addresses</h2>
            <p className="text-gray-500 text-sm mt-1">Set up to 3 delivery addresses for faster checkout within your markets.</p>
          </div>
          {addressSaved && <span className="text-green-600 text-sm font-medium bg-green-50 px-3 py-1 rounded-full">Saved!</span>}
        </div>
        
        <div className="space-y-4 max-w-2xl">
          {addresses.map((addr, idx) => (
            <div key={idx} className="border border-gray-200 rounded-md p-4 bg-gray-50">
              {editingIndex === idx ? (
                <form onSubmit={handleSaveEdit} className="flex flex-col sm:flex-row gap-3">
                  <textarea
                    required
                    rows={2}
                    className="flex-1 rounded-md border-gray-300 shadow-sm border p-3 focus:ring-brand-500 focus:border-brand-500 text-sm"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                  />
                  <div className="flex flex-col gap-2">
                    <button 
                      type="submit" 
                      disabled={isSavingAddress}
                      className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50"
                    >
                      {isSavingAddress ? "Saving..." : "Save"}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setEditingIndex(null)}
                      className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex justify-between items-start gap-4">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap flex-1">{addr}</p>
                  <button 
                    onClick={() => {
                      setEditValue(addr);
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
                <textarea
                  required
                  rows={2}
                  className="flex-1 rounded-md border-gray-300 shadow-sm border p-3 focus:ring-brand-500 focus:border-brand-500 text-sm"
                  placeholder="E.g., 123/45 Soi Sukhumvit 71, Wattana, Bangkok 10110"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                />
                <div className="flex flex-col gap-2">
                  <button 
                    type="submit" 
                    disabled={isSavingAddress}
                    className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50"
                  >
                    {isSavingAddress ? "Saving..." : "Save"}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setEditingIndex(null)}
                    className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {addresses.length < 3 && editingIndex !== addresses.length && (
            <button 
              onClick={handleAddNewAddress}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-md text-gray-500 hover:text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition text-sm font-medium flex justify-center items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add New Address
            </button>
          )}
        </div>
      </div>

      {approvedMarkets.length === 0 && !isOpeningShop && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-md">
          <p className="font-medium">You must be approved to enter a market before you can open a shop in it!</p>
        </div>
      )}

      {/* SHOP CREATION MESSAGES & FORM */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-md">
          <p className="font-semibold text-lg">Shop Request Submitted Successfully!</p>
          <p className="text-sm mt-1">Your shop has been submitted to the Market Owner for approval. You have been granted the <b>Shop Owner</b> role.</p>
          <p className="text-sm mt-1 underline cursor-pointer font-medium" onClick={() => signIn('google')}>Please click here to quickly re-login so your new dashboard links appear!</p>
        </div>
      )}

      {isOpeningShop && approvedMarkets.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Open a Shop</h2>
                <p className="text-gray-500 text-sm mt-1">Select an approved market and submit your shop details.</p>
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
                  <label className="block text-sm font-medium text-gray-700">Select Market *</label>
                  <select
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                    value={formData.marketId}
                    onChange={(e) => setFormData({ ...formData, marketId: e.target.value })}
                  >
                    {approvedMarkets.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Shop Name *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Grandma's Bakery"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Category *</label>
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
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">House Number *</label>
                    <input
                      required
                      type="number"
                      placeholder="e.g. 123"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                      value={formData.houseNumber}
                      onChange={(e) => setFormData({ ...formData, houseNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Location *</label>
                    <input
                      required
                      type="text"
                      maxLength={100}
                      placeholder="e.g. Near the main gate"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Shop Cover Image</label>
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
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="bg-brand-600 text-white px-6 py-2 rounded-md font-medium hover:bg-brand-700 transition disabled:opacity-50"
                  >
                    {loading ? "Submitting..." : "Submit Shop"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MY MEMBERSHIPS */}
      <div id="market-memberships" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 scroll-mt-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">My Market Memberships</h2>
        {memberships.length === 0 ? (
          <p className="text-gray-500 text-sm">You haven't joined any markets yet. Request access below!</p>
        ) : (
          <div className="space-y-4">
            {memberships.map(m => {
              const market = allMarkets.find(x => x.id === m.marketId);
              const marketShops = initialShops?.filter((s: any) => s.marketId === m.marketId) || [];
              
              return (
                <div key={m.id} className="border border-gray-100 rounded-lg p-4 bg-gray-50 flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                    <div className="flex items-center gap-4">
                      {market?.coverImage ? (
                        <img src={market.coverImage} alt={market.name} className="w-16 h-16 rounded-md object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded-md bg-gray-200 flex items-center justify-center text-gray-400 text-xs flex-shrink-0">
                          No Img
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-lg text-gray-800">{market?.name || "Unknown Market"}</h3>
                        <p className="text-sm text-gray-500 mt-1">Application Note: "{m.applicationNote || "None"}"</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end text-right">
                      {m.status === "pending" && <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">Pending Approval</span>}
                      {m.status === "approved" && (
                        <div className="flex flex-col items-end gap-2">
                          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">Approved</span>
                          <Link href={`/market/${m.marketId}`} className="text-sm bg-brand-600 text-white px-4 py-2 rounded-md hover:bg-brand-700 transition font-medium">
                            Enter Market
                          </Link>
                        </div>
                      )}
                      {m.status === "needs_revision" && (
                        <div className="text-right">
                          <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium mb-2 inline-block">Needs Revision</span>
                          <p className="text-sm text-red-600"><b>Feedback:</b> {m.feedback}</p>
                          <button 
                            onClick={() => {
                              setRequestingMarketId(m.marketId);
                              setApplicationNote(m.applicationNote);
                            }}
                            className="mt-2 text-sm text-brand-600 hover:underline font-medium"
                          >
                            Revise & Resubmit
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Shop List */}
                  {m.status === "approved" && marketShops.length > 0 && (
                     <div className="mt-2 pt-4 border-t border-gray-200">
                       <h4 className="text-sm font-semibold text-gray-700 mb-3">Shops in this Market</h4>
                       <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                         {marketShops.map((shop: any) => (
                           <Link key={shop.id} href={`/market/${m.marketId}?shopId=${shop.id}`} className="flex items-center p-3 bg-white border border-gray-200 rounded-md hover:border-brand-300 hover:shadow-sm transition group">
                             {shop.coverImage ? (
                               <img src={shop.coverImage} alt={shop.name} className="w-10 h-10 rounded-md object-cover mr-3" />
                             ) : (
                               <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center text-gray-400 text-xs mr-3">No Img</div>
                             )}
                             <div className="flex-1 min-w-0">
                               <p className="text-sm font-medium text-gray-900 truncate group-hover:text-brand-600">{shop.name}</p>
                               <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                 <span className={`w-2 h-2 rounded-full ${
                                    shop.operatingStatus === 'closed' ? 'bg-red-500' :
                                    shop.operatingStatus === 'scheduled' ? 'bg-blue-500' :
                                    'bg-green-500'
                                 }`}></span>
                                 {shop.operatingStatus === 'closed' ? 'Closed' :
                                  shop.operatingStatus === 'scheduled' ? `Until ${shop.validDates}` :
                                  'Open'}
                               </p>
                             </div>
                           </Link>
                         ))}
                       </div>
                     </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MY MESSAGES */}
      <div id="my-messages" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 scroll-mt-6">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-gray-900">
          My Messages
          {myChats.some(c => c.unreadByShopper) && (
            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">NEW</span>
          )}
        </h2>
        
        <div className="flex flex-col md:flex-row gap-6 border border-gray-200 rounded-lg overflow-hidden h-[500px]">
          {/* Chat List */}
          <div className="w-full md:w-1/3 border-r border-gray-200 bg-gray-50 flex flex-col overflow-y-auto">
            {myChats.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 text-center mt-10">No messages yet.</p>
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
                      {chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].text : "New Chat"}
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
          <div className="w-full md:w-2/3 bg-white flex flex-col relative">
            {selectedChat ? (
              <>
                <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
                  <h3 className="font-bold text-gray-900">{selectedChat.shopName}</h3>
                </div>
                
                <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col space-y-3">
                  {selectedChat.messages.map((msg: any, i: number) => (
                    <div key={i} className={`max-w-[80%] rounded-lg p-3 text-sm ${
                      msg.sender === "shopper" 
                        ? "bg-brand-600 text-white self-end rounded-br-none" 
                        : "bg-gray-200 text-gray-800 self-start rounded-bl-none"
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      <span className={`text-[10px] mt-1 block ${msg.sender === "shopper" ? "text-brand-200" : "text-gray-500"}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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
                      placeholder="Type a message..."
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
                Select a conversation to start chatting
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MY ORDERS */}
      <div id="active-orders" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 scroll-mt-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Active Orders</h2>
        {activeOrders.length === 0 ? (
          <p className="text-gray-500 text-sm mb-6">You have no active orders.</p>
        ) : (
          <div className="space-y-4 mb-8">
            {activeOrders.map(order => {
              const shop = initialShops.find(s => s.id === order.shopId);
              
              return (
                <div key={order.id} className="border border-brand-200 rounded-lg p-4 bg-brand-50 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        order.status === 'Pending Completion' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'Out for Delivery' ? 'bg-purple-100 text-purple-800' :
                        order.status === 'Preparing' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-200 text-gray-800'
                      }`}>
                        {order.status}
                      </span>
                      <span className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="font-bold text-gray-900">Total: ฿{order.totalAmount.toFixed(2)}</p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                      {order.items.map((item: any) => `${item.quantity}x ${item.productName}`).join(", ")}
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-2 min-w-[140px]">
                    {order.status === "Pending Completion" && (
                      <button 
                        disabled={completingOrderId === order.id}
                        onClick={() => handleAcceptDelivery(order.id)}
                        className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50"
                      >
                        Accept Delivery
                      </button>
                    )}
                    {order.status === "Out for Delivery" && (
                      <button 
                        disabled={completingOrderId === order.id}
                        onClick={() => {
                          const scannedId = prompt("Scan Shop Owner's QR Code (or paste Order ID):");
                          if (scannedId === order.id) {
                            handleAcceptDelivery(order.id);
                          } else if (scannedId) {
                            alert("Invalid QR Code for this order.");
                          }
                        }}
                        className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                        </svg>
                        Scan QR
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <h2 className="text-xl font-semibold mb-4 text-gray-900 border-t border-gray-200 pt-6">Order History</h2>
        {pastOrders.length === 0 ? (
          <p className="text-gray-500 text-sm">You haven't completed any orders yet.</p>
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
                  <p className="text-sm font-medium text-gray-900 mt-1">Total: ฿{order.totalAmount.toFixed(2)}</p>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  <p className="text-xs text-gray-500">
                    {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                  </p>
                  <button 
                    onClick={() => handleViewOrderDetails(order)}
                    className="mt-4 w-full bg-gray-100 text-gray-700 font-medium py-2 rounded hover:bg-gray-200 transition"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DISCOVER MARKETS */}
      <div id="discover-markets" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 scroll-mt-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Discover Markets</h2>
        {discoverableMarkets.length === 0 ? (
          <p className="text-gray-500 text-sm">There are no new markets to join at this time.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {discoverableMarkets.map(market => (
              <div key={market.id} className="border border-gray-200 rounded-lg overflow-hidden flex flex-col hover:shadow-md transition">
                {market.coverImage ? (
                  <img src={market.coverImage} alt={market.name} className="w-full h-32 object-cover" />
                ) : (
                  <div className="w-full h-32 bg-gray-100 flex items-center justify-center text-gray-400">No Image</div>
                )}
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-bold text-gray-900">{market.name}</h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 flex-1">{market.description}</p>
                  <button 
                    onClick={() => {
                      setRequestingMarketId(market.id);
                      setApplicationNote("");
                    }}
                    className="mt-4 w-full bg-brand-50 text-brand-700 py-2 rounded text-sm font-semibold hover:bg-brand-100 transition"
                  >
                    Request to Enter
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* REQUEST MEMBERSHIP MODAL */}
      {requestingMarketId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Request Market Access</h2>
            <p className="text-sm text-gray-500 mb-4">Please provide a brief note to the Market Owner (e.g., your house number or name) to verify your residency.</p>
            
            {membershipError && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm">{membershipError}</div>}
            
            <form onSubmit={submitMembership}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Application Note *</label>
              <textarea
                required
                rows={3}
                placeholder="Hi, I live at House #42..."
                className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-brand-500 focus:border-brand-500 mb-4"
                value={applicationNote}
                onChange={(e) => setApplicationNote(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setRequestingMarketId(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={membershipLoading || !applicationNote.trim()}
                  className="px-4 py-2 text-sm bg-brand-600 text-white rounded-md hover:bg-brand-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {membershipLoading ? "Submitting..." : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                        
                        <p className="text-xs text-gray-500 mt-1">฿{item.price.toFixed(2)} x {item.quantity}</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 ml-4">฿{(item.price * item.quantity).toFixed(2)}</p>
                    </li>
                  ))}
                </ul>
                <div className="bg-brand-50 px-4 py-3 border-t border-brand-100 flex justify-between items-center">
                  <p className="font-bold text-brand-900">Total Amount</p>
                  <p className="font-bold text-lg text-brand-900">฿{selectedOrderDetails.totalAmount.toFixed(2)}</p>
                </div>
              </div>

              {/* Review Section */}
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

      {/* Resubmit Membership Modal */}
      {resubmitMemModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">Resubmit Membership Request</h2>
              <button onClick={() => setResubmitMemModal(null)} className="text-gray-400 hover:text-gray-600 transition">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleResubmitMembership} className="p-6">
              <p className="text-gray-600 mb-4 text-sm">
                You are resubmitting your application to join <strong className="text-gray-900">{resubmitMemModal.name}</strong>. Please update your application note to address the feedback.
              </p>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Application Note (Optional)</label>
                <textarea
                  className="w-full rounded-md border-gray-300 shadow-sm border p-3 focus:ring-brand-500 focus:border-brand-500 text-sm"
                  rows={4}
                  placeholder="Introduce yourself or describe what you plan to sell..."
                  value={resubmitMemModal.note}
                  onChange={(e) => setResubmitMemModal({ ...resubmitMemModal, note: e.target.value })}
                ></textarea>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setResubmitMemModal(null)}
                  className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50 transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resubmitMemLoading}
                  className="px-5 py-2.5 bg-brand-600 text-white rounded-md font-bold hover:bg-brand-700 transition shadow-sm disabled:opacity-50 flex items-center justify-center text-sm min-w-[120px]"
                >
                  {resubmitMemLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    "Resubmit"
                  )}
                </button>
              </div>
            </form>
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

    </div>
  );
}
