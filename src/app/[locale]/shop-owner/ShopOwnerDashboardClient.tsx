"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Coins, Coffee } from "lucide-react";
import BuyCoffeeModal from "@/components/BuyCoffeeModal";
import TermsModal from "@/components/TermsModal";
import { useLocale, useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
const generatePayload = require("promptpay-qr");
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function ShopOwnerDashboardClient({
  userEmail,
  initialShops,
  initialProducts,
  initialMarkets,
  initialOrders = [],
  initialCoins,
  userMaxShopSlots = 1
}: {
  userEmail: string,
  initialShops: any[],
  initialProducts: any[],
  initialMarkets?: any[],
  initialOrders?: any[],
  initialCoins?: number,
  userMaxShopSlots?: number
}) {
  const router = useRouter();
  const t = useTranslations("ShopOwnerDashboard");
  const navT = useTranslations("Navigation");
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // State for selecting which shop to manage if they have multiple
  const [shops, setShops] = useState<any[]>(initialShops || []);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(
    shops.length > 0 ? shops[0].id : null
  );

  const [coins, setCoins] = useState<number>(initialCoins || 0);
  const selectedShop = shops.find(s => s.id === selectedShopId);
  const [products, setProducts] = useState<any[]>(initialProducts || []);
  const selectedShopProducts = products.filter(p => p.shopId === selectedShopId);

  const [orders, setOrders] = useState<any[]>(initialOrders || []);
  const selectedShopOrders = orders.filter(o => o.shopId === selectedShopId);
  const activeOrders = selectedShopOrders.filter(o => o.status !== "Completed" && o.status !== "Cancelled");
  
  const pastOrdersRaw = selectedShopOrders.filter(o => o.status === "Completed" || o.status === "Cancelled");
  const pastOrders = pastOrdersRaw.filter(o => {
    if (!dateRange.start && !dateRange.end) return true;
    if (!o.createdAt) return true;
    try {
      const orderDateStr = new Date(o.createdAt).toISOString().split('T')[0];
      if (dateRange.start && orderDateStr < dateRange.start) return false;
      if (dateRange.end && orderDateStr > dateRange.end) return false;
      return true;
    } catch (e) {
      return true;
    }
  });
  const completedOrders = selectedShopOrders.filter(o => o.status === "Completed");
  
  // Maintenance calculations based on 30-day rolling periods from shop creation
  let daysUntilNextFee = 30;
  let currentCycleStart = new Date();
  currentCycleStart.setDate(currentCycleStart.getDate() - 30); // fallback

  if (selectedShop && selectedShop.createdAt) {
    const shopCreatedDate = new Date(selectedShop.createdAt);
    const now = new Date();
    
    // Calculate difference in time
    const diffTime = now.getTime() - shopCreatedDate.getTime();
    if (diffTime >= 0) {
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const completedCycles = Math.floor(diffDays / 30);
      const daysIntoCurrentCycle = diffDays % 30;
      daysUntilNextFee = 30 - daysIntoCurrentCycle;
      
      currentCycleStart = new Date(shopCreatedDate.getTime());
      currentCycleStart.setDate(shopCreatedDate.getDate() + (completedCycles * 30));
    }
  }

  let nextDeductionDate = new Date(currentCycleStart.getTime());
  nextDeductionDate.setDate(nextDeductionDate.getDate() + 30);
  const nextDeductionDateStr = nextDeductionDate.toLocaleDateString('en-GB'); // DD/MM/YYYY

  const monthlyCompletedOrders = completedOrders.filter(o => {
    if (!o.createdAt) return false;
    return new Date(o.createdAt) >= currentCycleStart;
  });
  const maintenanceFee = monthlyCompletedOrders.length >= 5 ? 2 : 5;
  const isShopInactiveDueToZeroCoins = coins <= 0;

  // Filtered metrics for Order History
  const filteredCompletedOrders = pastOrders.filter(o => o.status === "Completed");
  const filteredTotalEarnings = filteredCompletedOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

  // Product State
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isRevisingShop, setIsRevisingShop] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [shopToDelete, setShopToDelete] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  // Order Management State
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Shop Status Management
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const handleToggleShopStatus = async () => {
    if (!selectedShop) return;
    setIsTogglingStatus(true);
    const newStatus = selectedShop.operatingStatus === 'closed' ? 'open' : 'closed';
    try {
      const res = await fetch("/api/shop-owner/shops", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: selectedShop.id, operatingStatus: newStatus })
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update shop status");
      }
    } catch (e) {
      alert("Something went wrong");
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const CATEGORIES = [
    "Food & Beverages",
    "Fresh Produce",
    "Groceries",
    "Clothing & Apparel",
    "Electronics & Accessories",
    "Home & Living",
    "Health & Beauty",
    "Handicrafts",
    "Services",
    "Other"
  ];

  // Shop Revision State
  const [shopReviseData, setShopReviseData] = useState({
    name: "",
    description: "",
    category: CATEGORIES[0],
    locationType: "house",
    houseNumber: "",
    location: "",
    coverImage: "",
    promptpayId: "",
    promptpayName: ""
  });
  const [shopReviseFile, setShopReviseFile] = useState<File | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCoffeeModal, setShowCoffeeModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState<{ amount: number, promptpayId: string, promptpayName: string } | null>(null);

  const [shopCancelModalOrderId, setShopCancelModalOrderId] = useState<string | null>(null);
  const [shopCancelReason, setShopCancelReason] = useState("");

  // Reviews State
  const [shopReviews, setShopReviews] = useState<any[]>([]);
  const [replyInput, setReplyInput] = useState<{ [key: string]: string }>({});
  const [replyLoading, setReplyLoading] = useState<string | null>(null);

  const liveAverageRating = shopReviews.length > 0
    ? (shopReviews.reduce((acc, r) => acc + r.rating, 0) / shopReviews.length).toFixed(1)
    : null;

  // Chat State
  const [customerChats, setCustomerChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [chatInputText, setChatInputText] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userEmail) return;

    // Real-time Shops Listener
    const shopsQ = query(collection(db, "shops"), where("ownerEmail", "==", userEmail));
    const unsubShops = onSnapshot(shopsQ, async (snap) => {
      let freshShops = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() as any }));

      const encryptedIds = freshShops
        .filter(s => s.promptpayId?.startsWith("ENC:"))
        .map(s => s.promptpayId);

      if (encryptedIds.length > 0) {
        try {
          const res = await fetch('/api/decrypt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encryptedData: encryptedIds })
          });
          const data = await res.json();
          if (data.success && Array.isArray(data.decrypted)) {
            let i = 0;
            freshShops = freshShops.map(s => {
              if (s.promptpayId?.startsWith("ENC:")) {
                return { ...s, promptpayId: data.decrypted[i++] };
              }
              return s;
            });
          }
        } catch (e) {
          console.error("Failed to decrypt promptpay in real-time listener", e);
        }
      }

      freshShops.sort((a: any, b: any) => {
        if (a.status === "approved" && b.status !== "approved") return -1;
        if (a.status !== "approved" && b.status === "approved") return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setShops(freshShops);
    });

    // Real-time User Coins Listener
    const userQ = query(collection(db, "users"), where("email", "==", userEmail));
    const unsubUser = onSnapshot(userQ, (snap) => {
      if (!snap.empty) {
        setCoins(snap.docs[0].data().coins || 0);
      }
    });

    return () => {
      unsubShops();
      unsubUser();
    };
  }, [userEmail]);

  useEffect(() => {
    if (!selectedShopId) return;

    // Real-time Orders Listener
    const ordersQ = query(collection(db, "orders"), where("shopId", "==", selectedShopId));
    const unsubOrders = onSnapshot(ordersQ, async (snap) => {
      let freshOrders = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() as any }));

      const encryptedAddresses = freshOrders
        .filter(o => o.deliveryAddress?.startsWith("ENC:"))
        .map(o => o.deliveryAddress);

      if (encryptedAddresses.length > 0) {
        try {
          const res = await fetch('/api/decrypt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encryptedData: encryptedAddresses })
          });
          const data = await res.json();
          if (data.success && Array.isArray(data.decrypted)) {
            let i = 0;
            freshOrders = freshOrders.map(o => {
              if (o.deliveryAddress?.startsWith("ENC:")) {
                return { ...o, deliveryAddress: data.decrypted[i++] };
              }
              return o;
            });
          }
        } catch (e) {
          console.error("Failed to decrypt addresses in real-time listener", e);
        }
      }

      freshOrders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(freshOrders);
    });

    // Real-time Reviews Listener
    const reviewsQ = query(collection(db, "reviews"), where("shopId", "==", selectedShopId));
    const unsubReviews = onSnapshot(reviewsQ, (snap) => {
      const freshReviews = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      freshReviews.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setShopReviews(freshReviews);
    });

    // Real-time Products Listener
    const productsQ = query(collection(db, "products"), where("shopId", "==", selectedShopId));
    const unsubProducts = onSnapshot(productsQ, (snap) => {
      const freshProducts = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      freshProducts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setProducts(freshProducts);
    });

    // Real-time Chats Listener
    const chatsQ = query(
      collection(db, "shop_chats"),
      where("shopId", "==", selectedShopId)
    );
    const unsubChats = onSnapshot(chatsQ, (snap) => {
      let freshChats = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      freshChats = freshChats.filter((c: any) => !c.deletedByShopOwner);
      freshChats.sort((a: any, b: any) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

      setCustomerChats(freshChats);

      if (selectedChat) {
        const updated = freshChats.find((c: any) => c.id === selectedChat.id);
        if (updated) setSelectedChat(updated);
      }
    });

    return () => {
      unsubOrders();
      unsubReviews();
      unsubProducts();
      unsubChats();
    };
  }, [selectedShopId, selectedChat?.id]);

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
      const newMessage = { text: textToSend, sender: "shop_owner", timestamp: new Date().toISOString() };
      setSelectedChat((prev: any) => ({
        ...prev,
        messages: [...(prev.messages || []), newMessage]
      }));

      await fetch("/api/shop-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: selectedShopId,
          shopperEmail: selectedChat.shopperEmail,
          text: textToSend
        }),
      });
      // The onSnapshot listener will automatically update the chat
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setChatLoading(false);
    }
  };

  const triggerDeleteChat = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    setChatToDelete(chatId);
  };

  const confirmDeleteChat = async () => {
    if (!chatToDelete) return;
    const chatId = chatToDelete;

    try {
      const res = await fetch("/api/shop-chat", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, shopId: selectedShopId })
      });
      if (res.ok) {
        setCustomerChats(prev => prev.filter(c => c.id !== chatId));
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

  const handleChatWithCustomer = (shopperEmail: string) => {
    const existingChat = customerChats.find(c => c.shopperEmail === shopperEmail);
    if (existingChat) {
      setSelectedChat(existingChat);
    } else {
      setSelectedChat({
        id: `temp_${shopperEmail}`,
        shopId: selectedShopId,
        shopperEmail: shopperEmail,
        messages: []
      });
    }
    document.getElementById("customer-messages-section")?.scrollIntoView({ behavior: 'smooth' });
  };

  const submitReply = async (reviewId: string) => {
    if (!replyInput[reviewId]) return;
    setReplyLoading(reviewId);
    try {
      const res = await fetch("/api/shop-owner/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId,
          replyText: replyInput[reviewId]
        })
      });
      if (res.ok) {
        setShopReviews(prev => prev.map(r =>
          r.id === reviewId ? { ...r, ownerReply: replyInput[reviewId] } : r
        ));
        setReplyInput(prev => {
          const next = { ...prev };
          delete next[reviewId];
          return next;
        });
      } else {
        const data = await res.json();
        alert(data.error || "Failed to submit reply");
      }
    } catch (e) {
      alert("Something went wrong");
    } finally {
      setReplyLoading(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFile = e.target.files[0];
      if (files.length >= 3) {
        setError("You can only upload a maximum of 3 images per product.");
      } else {
        setError("");
        setFiles(prev => [...prev, newFile]);
      }
      // Reset input so they can add the same file again if they deleted it
      e.target.value = "";
    }
  };

  const removeFile = (indexToRemove: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
    setError("");
  };

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    tags: "",
    options: [] as { name: string; choices: string[]; required: boolean; allowMultiple?: boolean }[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShopId) return;

    setLoading(true);
    setError("");

    try {
      const uploadedImageUrls: string[] = [];

      // Upload images securely via our backend Firebase Storage route
      if (files.length > 0) {
        for (const f of files) {
          const uploadData = new FormData();
          uploadData.append("file", f);

          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: uploadData,
          });

          const uploadJson = await uploadRes.json();
          if (!uploadRes.ok) {
            throw new Error(uploadJson.error || "Failed to upload image");
          }
          uploadedImageUrls.push(uploadJson.url);
        }
      }

      const method = editingProduct ? "PUT" : "POST";
      const payload: any = {
        ...formData,
        shopId: selectedShopId
      };

      if (editingProduct) {
        payload.productId = editingProduct.id;
      }

      if (files.length > 0) {
        payload.imageUrls = uploadedImageUrls;
      } else if (!editingProduct) {
        payload.imageUrls = [];
      }

      const res = await fetch("/api/shop-owner/products", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save product");
      }

      setIsAddingProduct(false);
      setEditingProduct(null);
      setFormData({ name: "", description: "", price: "", tags: "", options: [] });
      setFiles([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openEditProduct = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      price: product.price ? product.price.toString() : "",
      tags: product.tags ? product.tags.join(", ") : "",
      options: product.options || [],
    });
    setFiles([]);
    setIsAddingProduct(true);
  };

  const cancelProductForm = () => {
    setIsAddingProduct(false);
    setEditingProduct(null);
    setFormData({ name: "", description: "", price: "", tags: "", options: [] });
    setFiles([]);
    setError("");
  };

  const toggleProductAvailability = async (product: any) => {
    try {
      const newStatus = product.isAvailable === undefined ? false : !product.isAvailable;

      // Optimistic UI Update
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isAvailable: newStatus } : p));

      const res = await fetch("/api/shop-owner/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggleAvailability",
          productId: product.id,
          shopId: selectedShopId,
          isAvailable: newStatus
        })
      });

      if (!res.ok) {
        throw new Error("Failed to update availability");
      }
    } catch (e) {
      // Revert on error
      setProducts(initialProducts);
      alert("Error updating product availability");
    }
  };

  const [spotlightConfirmData, setSpotlightConfirmData] = useState<any | null>(null);
  const [promotingProductId, setPromotingProductId] = useState<string | null>(null);
  const [spotlightTier, setSpotlightTier] = useState<2 | 3 | 5>(2);

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

  const confirmSpotlightPromotion = async () => {
    if (!spotlightConfirmData || !selectedShopId) return;
    setPromotingProductId(spotlightConfirmData.id);
    try {
      const res = await fetch("/api/shop-owner/products/spotlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: spotlightConfirmData.id, shopId: selectedShopId, coins: spotlightTier })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "INSUFFICIENT_COINS") {
          // Open insufficient coins modal
          setSpotlightConfirmData({ ...spotlightConfirmData, insufficientCoins: true });
        } else {
          throw new Error(data.error || "Failed to promote product");
        }
        return;
      }
      setSpotlightConfirmData(null);
      if (data.newCoinBalance !== undefined) {
        setCoins(data.newCoinBalance);
      }
      // Real-time listener will pick up the change
    } catch (e: any) {
      alert(e.message || "Error promoting product");
    } finally {
      setPromotingProductId(null);
    }
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete || !selectedShopId) return;
    try {
      const res = await fetch(`/api/shop-owner/products?productId=${productToDelete}&shopId=${selectedShopId}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to delete product");
      setProductToDelete(null);
    } catch (e) {
      alert("Error deleting product");
    }
  };

  const confirmDeleteShop = async () => {
    if (!shopToDelete) return;
    try {
      const res = await fetch(`/api/shop-owner/shops?shopId=${shopToDelete}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to delete shop");
      // Since shop is deleted, we should redirect to dashboard home or refresh
      window.location.reload();
    } catch (e) {
      alert("Error deleting shop");
      setShopToDelete(null);
    }
  };

  const handleReviseShopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShopId) return;

    setLoading(true);
    setError("");

    try {
      let finalImageUrl = shopReviseData.coverImage;

      if (shopReviseFile) {
        const uploadData = new FormData();
        uploadData.append("file", shopReviseFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadData });
        const uploadJson = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadJson.error || "Failed to upload image");
        finalImageUrl = uploadJson.url;
      }

      const res = await fetch("/api/shop-owner/shops/revise", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: selectedShopId,
          name: shopReviseData.name,
          description: shopReviseData.description,
          category: shopReviseData.category,
          houseNumber: shopReviseData.locationType === "house" ? shopReviseData.houseNumber : "",
          location: shopReviseData.locationType === "area" ? shopReviseData.location : "",
          promptpayId: shopReviseData.promptpayId,
          promptpayName: shopReviseData.promptpayName,
          coverImage: finalImageUrl
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revise shop");

      router.refresh();
      setIsRevisingShop(false);

      if (selectedShop.status === "approved") {
        setShowSuccessModal(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const [declineCancelModalOpen, setDeclineCancelModalOpen] = useState(false);
  const [declineCancelOrderId, setDeclineCancelOrderId] = useState("");
  const [declineCancelReason, setDeclineCancelReason] = useState("");
  const [isDecliningCancel, setIsDecliningCancel] = useState(false);

  // Order history
  const [selectedPastOrder, setSelectedPastOrder] = useState<any | null>(null);

  const handleDeclineCancel = async () => {
    setIsDecliningCancel(true);
    try {
      const res = await fetch("/api/shop-owner/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          orderId: declineCancelOrderId, 
          declineCancel: true, 
          declineReason: declineCancelReason 
        }),
      });
      if (res.ok) {
        setDeclineCancelModalOpen(false);
        setDeclineCancelReason("");
        setDeclineCancelOrderId("");
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to decline cancellation");
      }
    } catch (err) {
      alert("Something went wrong");
    } finally {
      setIsDecliningCancel(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string, cancelReason?: string) => {
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch("/api/shop-owner/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: newStatus, cancelReason }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update order status");
      }
    } catch (err) {
      alert("Something went wrong");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  if (shops.length === 0) {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
        <p className="text-sm text-yellow-700">
          You don't have any shops yet! Go to the Shopper Dashboard to open a shop.
        </p>
      </div>
    );
  }

  const actualMaxProductSlots = Math.max(selectedShop?.maxProductSlots || 1, selectedShopProducts.length);

return (
    <ErrorBoundary>
      {showQrModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full text-center">
            <h3 className="font-bold text-lg mb-4">{t("scanToPay")}</h3>
            <div className="inline-block bg-white p-2 rounded-lg border">
              <QRCodeSVG 
                value={generatePayload(showQrModal.promptpayId, { amount: showQrModal.amount })}
                size={256}
                level="H"
              />
            </div>
            <p className="mt-4 text-sm font-semibold text-gray-700">{showQrModal.promptpayName}</p>
            <p className="text-xl font-bold text-brand-600">฿{showQrModal.amount.toFixed(2)}</p>
            <button 
              onClick={() => setShowQrModal(null)}
              className="mt-6 w-full py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-bold"
            >
              {t("close")}
            </button>
          </div>
        </div>
      )}
      <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 relative group">
            <h1 className="text-3xl font-bold text-gray-900">{t("shopDashboard")}</h1>
          </div>
          <p className="text-gray-500 mt-1">{t("manageProducts")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => setIsTermsOpen(true)}
            className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-md hover:bg-red-100 transition shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-red-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <span className="font-bold text-sm">{navT("termsOfUse") || "Terms of Use"}</span>
          </button>
          <button
            onClick={() => setShowFeedbackModal(true)}
            className="flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-md hover:bg-blue-100 transition shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span className="font-bold text-sm">{t("leaveComment")}</span>
          </button>
          {selectedShop && (
            <div className="flex flex-col items-center">
              <button
                onClick={handleToggleShopStatus}
                disabled={isTogglingStatus}
                className={`text-sm font-semibold px-4 py-2 rounded-full transition shadow-sm ${selectedShop.operatingStatus === 'closed'
                    ? 'bg-red-100 text-red-800 hover:bg-red-200'
                    : 'bg-green-100 text-green-800 hover:bg-green-200'
                  }`}
              >
                {isTogglingStatus ? t("updating") : (selectedShop.operatingStatus === 'closed' ? t("statusClosed") : t("statusOpen"))}
              </button>
              <span className="text-[10px] text-gray-500 mt-0.5">
                {selectedShop.operatingStatus === 'closed' ? t("clickToOpen") : t("clickToClose")}
              </span>
            </div>
          )}
          <button
            onClick={() => {
              setShopReviseData({
                name: selectedShop.name,
                description: selectedShop.description || "",
                category: selectedShop.category || CATEGORIES[0],
                locationType: selectedShop.houseNumber ? "house" : "area",
                houseNumber: selectedShop.houseNumber || "",
                location: selectedShop.location || "",
                coverImage: selectedShop.coverImage || "",
                promptpayId: selectedShop.promptpayId || "",
                promptpayName: selectedShop.promptpayName || ""
              });
              setIsRevisingShop(true);
            }}
            className="text-brand-600 hover:text-brand-800 text-sm font-semibold border border-brand-200 rounded-lg px-4 py-2 transition hover:bg-brand-50 bg-white shadow-sm"
          >
            {t("editShop")}
          </button>
          <button
            onClick={() => setShopToDelete(selectedShopId)}
            className="text-red-600 hover:text-red-800 text-sm font-semibold border border-red-200 rounded-lg px-4 py-2 transition hover:bg-red-50 bg-white shadow-sm"
          >
            {t("deleteShop")}
          </button>

          {/* Shop Selector and Slots */}
          <div className="flex flex-col items-end gap-1.5">
            {shops.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-500 mr-1 uppercase tracking-wider">{t("managing")}</span>
                {shops.map(shop => {
                  const marketName = (initialMarkets || []).find(m => m.id === shop.marketId)?.name || shop.marketId;
                  const isSelected = selectedShopId === shop.id;
                  return (
                    <button
                      key={shop.id}
                      onClick={() => setSelectedShopId(shop.id)}
                      className={`flex flex-col items-start px-4 py-2 rounded-xl transition shadow-sm border ${isSelected
                          ? "bg-brand-600 text-white border-brand-600 ring-2 ring-brand-200 ring-offset-1"
                          : "bg-white text-gray-700 border-gray-200 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300"
                        }`}
                    >
                      <span className="font-bold text-sm leading-none">{shop.name} {shop.status === "pending" && "⏳"}</span>
                      <span className={`text-[10px] mt-0.5 leading-none ${isSelected ? "text-brand-100" : "text-gray-500"}`}>
                        {t("inMarket", { marketName })}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <span className="text-[10px] text-gray-500 font-medium tracking-wide">
              {t("usedShopSlots", { count: shops.length, max: Math.max(userMaxShopSlots || 1, shops.length) })}
            </span>
          </div>
        </div>
      </div>

      {selectedShop?.status === "pending" && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-md">
          <p className="font-semibold text-lg flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            {t("shopPendingApproval")}
          </p>
          <p className="text-sm mt-1" dangerouslySetInnerHTML={{ __html: t("shopPendingDesc", { name: `<b>${selectedShop.name}</b>` }) }} />
        </div>
      )}

      {selectedShop?.status === "needs_revision" && (
        <div className="bg-red-50 border border-red-200 p-6 rounded-md">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="font-semibold text-xl text-red-800 flex items-center">
                {t("shopRevisionNeeded")}
              </p>
              <p className="text-red-700 mt-2">
                <b>{t("feedbackFromMarketOwner")}</b> {selectedShop.feedback || "Please revise your shop details."}
              </p>
            </div>
            {!isRevisingShop && (
              <button
                onClick={() => {
                  setShopReviseData({
                    name: selectedShop.name,
                    description: selectedShop.description || "",
                    category: selectedShop.category || CATEGORIES[0],
                    locationType: selectedShop.houseNumber ? "house" : "area",
                    houseNumber: selectedShop.houseNumber || "",
                    location: selectedShop.location || "",
                    coverImage: selectedShop.coverImage || "",
                    promptpayId: selectedShop.promptpayId || "",
                    promptpayName: selectedShop.promptpayName || ""
                  });
                  setIsRevisingShop(true);
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-red-700 transition"
              >
                {t("reviseShop")}
              </button>
            )}
          </div>
        </div>
      )}

      {selectedShop?.status === "approved" && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`px-3 py-2 rounded-full text-xs font-bold border shadow-sm flex items-center gap-1 ${isShopInactiveDueToZeroCoins ? "bg-red-100 text-red-800 border-red-200" : "bg-green-100 text-green-800 border-green-200"}`}>
                  <span className={`w-2 h-2 rounded-full ${isShopInactiveDueToZeroCoins ? "bg-red-500" : "bg-green-500"}`}></span>
                  {isShopInactiveDueToZeroCoins ? t("statusInactiveZeroCoins") || "Inactive (Zero Coins)" : t("statusActive") || "Active"}
                </span>

                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-2 rounded-full border border-blue-200 shadow-sm flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-blue-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t("monthlyMaintenanceFee", { fee: maintenanceFee }) || `Monthly Maintenance: ${maintenanceFee} coins`}
                </span>

                <button
                  onClick={() => router.push('/shopper/wallet')}
                  className="flex items-center bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-2 rounded-full border border-yellow-200 hover:bg-yellow-200 hover:border-yellow-300 transition shadow-sm cursor-pointer group relative"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 mr-1 text-yellow-500">
                    <path d="M10.464 8.746c.227-.18.497-.311.786-.394v2.795a2.252 2.252 0 01-.786-.393c-.394-.313-.546-.681-.546-1.004 0-.313.152-.68.546-1.004zM12.75 15.662v-2.824c.347.085.664.228.921.421.427.32.579.686.579.991 0 .302-.152.668-.579.991a2.534 2.534 0 01-.921.42z" />
                    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v.816a3.836 3.836 0 00-1.72.756c-.712.566-1.112 1.464-1.112 2.428 0 .964.4 1.862 1.112 2.428.42.333.864.55 1.346.68V15.54a2.54 2.54 0 01-1.346-.68.75.75 0 00-1.06 1.06c.712.566 1.57.864 2.446.963V18a.75.75 0 001.5 0v-.816a3.836 3.836 0 001.72-.756c.712-.566 1.112-1.464 1.112-2.428 0-.964-.4-1.862-1.112-2.428a3.836 3.836 0 00-1.346-.68V7.46c.482.13.926.347 1.346.68a.75.75 0 001.06-1.06c-.712-.566-1.57-.864-2.446-.963V6z" clipRule="evenodd" />
                  </svg>
                  {t("coins", { coins: coins }) || `${coins} Coins`}
                </button>

                <button
                  onClick={() => setShowCoffeeModal(true)}
                  className="flex items-center gap-1 bg-orange-100 text-orange-800 text-xs font-bold px-3 py-2 rounded-full border border-orange-200 hover:bg-orange-200 hover:border-orange-300 transition shadow-sm cursor-pointer"
                >
                  <Coffee className="w-4 h-4 text-orange-500" />
                  {t("buyCoffee") || "Buy developer a coffee"}
                </button>
              </div>
              <p className="text-xs text-gray-500 ml-1">
                {t("feeDeductionNotice", { days: daysUntilNextFee, date: nextDeductionDateStr }) || `Monthly fee will be deducted from your coin balance within ${daysUntilNextFee} days (on ${nextDeductionDateStr}).`}
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end w-full sm:w-auto mt-4 sm:mt-0">
              <button
                onClick={() => {
                  if (isAddingProduct) {
                    cancelProductForm();
                  } else {
                    setIsAddingProduct(true);
                  }
                }}
                className="bg-brand-600 text-white px-4 py-2 rounded-md font-medium hover:bg-brand-700 transition flex items-center gap-2 w-full sm:w-auto justify-center"
              >
                {isAddingProduct ? t("cancel") : (
                  <>
                    {t("addProduct")}
                    {!editingProduct && selectedShopProducts.length >= actualMaxProductSlots && (
                      <span className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                          <path d="M10.464 8.746c.227-.18.497-.311.786-.394v2.795a2.252 2.252 0 01-.786-.393c-.394-.313-.546-.681-.546-1.004 0-.323.152-.691.546-1.004zM12.75 15.662v-2.824c.347.085.664.228.921.421.427.32.579.686.579.991 0 .305-.152.671-.579.991a2.534 2.534 0 01-.921.42z" />
                          <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v.816a3.836 3.836 0 00-1.72.756c-.712.566-1.112 1.35-1.112 2.178 0 .829.4 1.612 1.113 2.178.502.4 1.102.647 1.719.756v2.978a2.536 2.536 0 01-.921-.421l-.879-.66a.75.75 0 00-.9 1.2l.879.66c.533.4 1.169.645 1.821.75V18a.75.75 0 001.5 0v-.81a4.124 4.124 0 001.821-.749c.745-.559 1.179-1.344 1.179-2.191 0-.847-.434-1.632-1.179-2.191a4.122 4.122 0 00-1.821-.75V8.354c.29.082.559.213.786.393l.415.33a.75.75 0 00.933-1.175l-.415-.33a3.836 3.836 0 00-1.719-.755V6z" clipRule="evenodd" />
                        </svg>
                        {t("coins", { coins: 5 }) || "5 Coins"}
                      </span>
                    )}
                  </>
                )}
              </button>
              <div className="mt-1.5 mr-1 w-full text-center sm:text-right">
                <span className="text-[10px] text-gray-500 font-medium tracking-wide">
                  {t("usedProductSlots", { count: selectedShopProducts.length, max: actualMaxProductSlots })}
                </span>
              </div>
            </div>
          </div>

          {isAddingProduct && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">{editingProduct ? t("editProduct") : t("addNewProduct")}</h2>
                  <button onClick={cancelProductForm} className="text-gray-500 hover:text-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                {error && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t("productName")}</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Spicy Papaya Salad"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t("priceTHB")}</label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 50"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t("description")}</label>
                    <textarea
                      rows={2}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t("customTags")}</label>
                    <input
                      type="text"
                      placeholder="e.g. Spicy, Vegan, Best Seller (comma separated)"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    />
                    <p className="text-xs text-gray-500 mt-1">{t("separateTags")}</p>
                  </div>

                  {/* Options Section */}
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-medium text-gray-700">{t("productOptions")}</label>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, options: [...prev.options, { name: "", choices: [], required: true, allowMultiple: false }] }))}
                        className="text-xs bg-brand-100 text-brand-700 px-2 py-1 rounded hover:bg-brand-200 font-medium"
                      >
                        {t("addOption")}
                      </button>
                    </div>

                    {formData.options.length === 0 ? (
                      <p className="text-xs text-gray-500">{t("noOptionsAdded")}</p>
                    ) : (
                      <div className="space-y-3">
                        {formData.options.map((opt, idx) => (
                          <div key={idx} className="bg-white p-3 rounded border border-gray-200 relative">
                            <button
                              type="button"
                              onClick={() => {
                                const newOpts = [...formData.options];
                                newOpts.splice(idx, 1);
                                setFormData(prev => ({ ...prev, options: newOpts }));
                              }}
                              className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2 pr-6">
                              <div>
                                <label className="block text-xs font-medium text-gray-700">{t("optionName")}</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Size"
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-1.5 text-sm focus:ring-brand-500 focus:border-brand-500"
                                  value={opt.name}
                                  onChange={(e) => {
                                    const newOpts = [...formData.options];
                                    newOpts[idx].name = e.target.value;
                                    setFormData(prev => ({ ...prev, options: newOpts }));
                                  }}
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">{t("choices")}</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                  {opt.choices.map((choice, cIdx) => (
                                    <span key={cIdx} className="bg-brand-100 text-brand-800 text-[11px] font-medium px-2 py-1 rounded flex items-center gap-1">
                                      {choice}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newOpts = [...formData.options];
                                          newOpts[idx].choices.splice(cIdx, 1);
                                          setFormData(prev => ({ ...prev, options: newOpts }));
                                        }}
                                        className="hover:text-brand-900 text-sm font-bold leading-none"
                                      >
                                        &times;
                                      </button>
                                    </span>
                                  ))}
                                </div>
                                <input
                                  type="text"
                                  placeholder={t("typeChoiceEnter")}
                                  className="block w-full rounded-md border-gray-300 shadow-sm border p-1.5 text-sm focus:ring-brand-500 focus:border-brand-500"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ',') {
                                      e.preventDefault();
                                      const val = e.currentTarget.value.trim();
                                      if (val) {
                                        const newOpts = [...formData.options];
                                        if (!newOpts[idx].choices.includes(val)) {
                                          newOpts[idx].choices.push(val);
                                        }
                                        setFormData(prev => ({ ...prev, options: newOpts }));
                                        e.currentTarget.value = "";
                                      }
                                    }
                                  }}
                                />
                              </div>
                            </div>
                            <div className="flex items-center mt-2 gap-4">
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  id={`req-${idx}`}
                                  checked={opt.required}
                                  onChange={(e) => {
                                    const newOpts = [...formData.options];
                                    newOpts[idx].required = e.target.checked;
                                    setFormData(prev => ({ ...prev, options: newOpts }));
                                  }}
                                  className="h-3.5 w-3.5 text-brand-600 focus:ring-brand-500 border-gray-300 rounded"
                                />
                                <label htmlFor={`req-${idx}`} className="ml-1.5 block text-xs text-gray-700">
                                  {t("required")}
                                </label>
                              </div>
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  id={`mult-${idx}`}
                                  checked={opt.allowMultiple}
                                  onChange={(e) => {
                                    const newOpts = [...formData.options];
                                    newOpts[idx].allowMultiple = e.target.checked;
                                    setFormData(prev => ({ ...prev, options: newOpts }));
                                  }}
                                  className="h-3.5 w-3.5 text-brand-600 focus:ring-brand-500 border-gray-300 rounded"
                                />
                                <label htmlFor={`mult-${idx}`} className="ml-1.5 block text-xs text-gray-700">
                                  {t("allowMultipleChoices")}
                                </label>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t("productImagesMax3")}</label>
                    {files.length < 3 && (
                      <input
                        type="file"
                        accept="image/*"
                        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                        onChange={handleFileChange}
                      />
                    )}
                    {files.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {files.map((f, idx) => (
                          <li key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded-md border border-gray-100">
                            <span className="text-xs text-gray-600 truncate max-w-[200px]">{f.name}</span>
                            <button
                              type="button"
                              onClick={() => removeFile(idx)}
                              className="text-red-500 hover:text-red-700 text-xs font-semibold px-2"
                            >
                              {t("remove")}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="pt-4 flex gap-3 justify-end border-t border-gray-100">
                    <button
                      type="button"
                      onClick={cancelProductForm}
                      className="px-6 py-2 rounded-md font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-brand-600 text-white px-6 py-2 rounded-md font-medium hover:bg-brand-700 transition disabled:opacity-50"
                    >
                      {loading ? t("saving") : (editingProduct ? t("saveChanges") : t("saveProduct"))}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-xl font-semibold mb-1 border-b pb-2">
                {t("yourProductsIn")} <span className="text-brand-600">"{selectedShop?.name}"</span>
              </h2>
              <p className="text-xs text-gray-500 mb-4 font-medium uppercase tracking-wider">
                {t("market")} {(initialMarkets || []).find(m => m.id === selectedShop?.marketId)?.name || "Unknown Market"}
              </p>

              {selectedShopProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  <p>{t("noProductsYet")}</p>
                  <p className="text-sm mt-1" dangerouslySetInnerHTML={{ __html: t("clickAddProduct") }}></p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {selectedShopProducts.map(product => (
                    <div key={product.id} className="flex space-x-3 border border-gray-100 p-3 rounded-lg hover:shadow-md transition">
                      {product.imageUrls && product.imageUrls.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          <img src={product.imageUrls[0]} alt={product.name} className="h-20 w-20 object-cover rounded-md" />
                          {product.imageUrls.length > 1 && (
                            <span className="text-[10px] text-gray-500 text-center">+{product.imageUrls.length - 1} more</span>
                          )}
                        </div>
                      ) : (product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="h-20 w-20 object-cover rounded-md" />
                      ) : (
                        <div className="h-20 w-20 bg-gray-100 rounded-md flex items-center justify-center text-gray-400 text-xs text-center p-1">
                          {t("noImg")}
                        </div>
                      ))}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="text-md font-medium text-gray-900 truncate flex-1">{product.name}</h3>
                          <div className="flex items-start gap-2 flex-shrink-0">
                            {product.isSpotlight && new Date(product.spotlightExpiry) > new Date() && (() => {
                              const hrs = Math.max(0, Math.ceil((new Date(product.spotlightExpiry).getTime() - new Date().getTime()) / (1000 * 60 * 60)));
                              return (
                                <div className="flex flex-col items-end">
                                  <span className="bg-yellow-100 text-yellow-800 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 mb-0.5 whitespace-nowrap">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                                      <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                                    </svg>
                                    {t("spotlightBadge")}
                                  </span>
                                  <span className="text-[9px] text-gray-500 font-medium whitespace-nowrap">
                                    {t("hoursLeft", { hours: hrs })}
                                  </span>
                                </div>
                              );
                            })()}
                            <span className="text-brand-700 font-bold whitespace-nowrap">฿{product.price}</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-1 mt-1">{product.description}</p>

                        {Array.isArray(product.tags) && product.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {product.tags.map((tag: string, i: number) => (
                              <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {selectedShop?.status === 'approved' && (
                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-700">
                              {(product.isAvailable === undefined || product.isAvailable) ? t("available") : t("unavailable")}
                            </span>
                            <button
                              onClick={() => toggleProductAvailability(product)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${(product.isAvailable === undefined || product.isAvailable) ? 'bg-brand-500' : 'bg-gray-300'
                                }`}
                            >
                              <span
                                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${(product.isAvailable === undefined || product.isAvailable) ? 'translate-x-5' : 'translate-x-1'
                                  }`}
                              />
                            </button>
                          </div>
                        )}

                        <div className="mt-3 flex gap-3 justify-end border-t border-gray-100 pt-2">
                          {(!product.isSpotlight || new Date(product.spotlightExpiry) < new Date()) ? (
                            <button onClick={() => { setSpotlightConfirmData(product); setSpotlightTier(2); }} className="text-xs text-yellow-600 hover:text-yellow-800 font-medium px-2 py-1 bg-yellow-50 rounded">{t("promote")}</button>
                          ) : (
                            <button onClick={() => { setSpotlightConfirmData(product); setSpotlightTier(2); }} className="text-xs text-yellow-600 hover:text-yellow-800 font-medium px-2 py-1 bg-yellow-50 rounded">{t("topUpSpotlight")}</button>
                          )}
                          <button onClick={() => openEditProduct(product)} className="text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1 bg-brand-50 rounded">{t("edit")}</button>
                          <button onClick={() => setProductToDelete(product.id)} className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 bg-red-50 rounded">{t("delete")}</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col">
              <h2 className="text-xl font-semibold mb-4">{t("incomingActiveOrders")}</h2>

              <div className="flex-1 overflow-y-auto space-y-4 max-h-[600px]">
                {activeOrders.length === 0 ? (
                  <div className="text-gray-500 text-sm text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                    <p>{t("noActiveOrders")}</p>
                  </div>
                ) : (
                  activeOrders.map(order => {
                    try {
                      return (
                        <div key={order.id} className="border border-brand-200 rounded-lg p-4 bg-brand-50 text-sm relative">
                          <div className="flex justify-between items-start border-b border-brand-200 pb-2 mb-2">
                            <div>
                              <p className="font-bold text-gray-900">{order.shopperName}</p>
                              <p className="text-xs text-gray-500" suppressHydrationWarning>{new Date(order.createdAt).toLocaleString('en-GB')}</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${order.status === 'Pending Completion' ? 'bg-blue-100 text-blue-800' :
                                order.status === 'Out for Delivery' ? 'bg-purple-100 text-purple-800' :
                                  order.status === 'Preparing' ? 'bg-yellow-100 text-yellow-800' :
                                    order.status === 'Cancel Requested' ? 'bg-orange-100 text-orange-800' :
                                      'bg-gray-200 text-gray-800'
                              }`}>
                              {order.status}
                            </span>
                          </div>

                          {(() => {
                            const deliveryAddressStr = typeof order.deliveryAddress === 'string' ? order.deliveryAddress : "";
                            const houseNoMatch = deliveryAddressStr.match(/House No(?:[.:\s]*)([^\n,]+)/i) || 
                                                 deliveryAddressStr.match(/บ้านเลขที่(?:[.:\s]*)([^\n,]+)/i);
                            const houseNo = houseNoMatch ? houseNoMatch[1].trim() : "-";
                            
                            return (
                              <div className="flex justify-between items-center mb-3 bg-white p-2.5 rounded border border-gray-100 shadow-sm">
                                <div className="flex flex-col gap-1.5">
                                  <span className="font-semibold text-gray-700 text-xs">{t("houseNo") || "House No"}: <span className="font-bold text-brand-700">{houseNo}</span></span>
                                  <span className="font-bold text-gray-900 text-sm">฿{Number(order.totalAmount || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                  <button
                                    onClick={() => setSelectedPastOrder(order)}
                                    className="text-brand-600 hover:text-brand-800 font-medium text-xs bg-brand-50 hover:bg-brand-100 px-3 py-2 rounded transition shadow-sm border border-brand-100"
                                  >
                                    {t("viewDetails") || "View Details"}
                                  </button>
                                  <button
                                    onClick={() => handleChatWithCustomer(order.shopperEmail)}
                                    className="text-white font-medium text-xs bg-gray-900 hover:bg-gray-800 px-3 py-2 rounded transition shadow-sm"
                                  >
                                    {t("chatWithCustomer") || "Chat with Customer"}
                                  </button>
                                </div>
                              </div>
                            );
                          })()}

                          <div className="flex flex-col gap-2 mt-3">
                            {order.status === "Pending" && (
                              <button
                                disabled={updatingOrderId === order.id}
                                onClick={() => handleUpdateOrderStatus(order.id, "Preparing")}
                                className="w-full bg-brand-600 text-white font-medium py-2 rounded text-xs hover:bg-brand-700 transition disabled:opacity-50"
                              >
                                {t("startPreparing")}
                              </button>
                            )}
                            {order.status === "Preparing" && (
                              <button
                                disabled={updatingOrderId === order.id}
                                onClick={() => handleUpdateOrderStatus(order.id, "Out for Delivery")}
                                className="w-full bg-purple-600 text-white font-medium py-2 rounded text-xs hover:bg-purple-700 transition disabled:opacity-50"
                              >
                                {t("markOutForDelivery")}
                              </button>
                            )}
                            {(order.status === "Pending" || order.status === "Preparing") && (
                              <button
                                disabled={updatingOrderId === order.id}
                                onClick={() => setShopCancelModalOrderId(order.id)}
                                className="w-full bg-red-50 text-red-600 border border-red-200 font-medium py-2 rounded text-xs hover:bg-red-100 transition disabled:opacity-50"
                              >
                                {t("cancelOrder") || "Cancel Order"}
                              </button>
                            )}
                            {order.status === "Cancel Requested" && (
                              <div className="bg-orange-50 border border-orange-200 rounded p-3 flex flex-col gap-2">
                                <p className="text-orange-800 text-xs font-semibold">{t("shopperRequestedCancel") || "Shopper requested cancellation:"}</p>
                                {order.cancelReason && <p className="text-orange-700 text-xs italic border-l-2 border-orange-300 pl-2">"{order.cancelReason}"</p>}
                                <div className="flex gap-2 mt-1">
                                  <button
                                    disabled={updatingOrderId === order.id}
                                    onClick={() => handleUpdateOrderStatus(order.id, "Cancelled")}
                                    className="flex-1 bg-red-600 text-white font-medium py-1.5 rounded text-xs hover:bg-red-700 transition disabled:opacity-50 shadow-sm"
                                  >
                                    {t("acceptCancel") || "Accept"}
                                  </button>
                                  <button
                                    disabled={updatingOrderId === order.id}
                                    onClick={() => {
                                      setDeclineCancelOrderId(order.id);
                                      setDeclineCancelModalOpen(true);
                                    }}
                                    className="flex-1 bg-white text-gray-700 border border-gray-300 font-medium py-1.5 rounded text-xs hover:bg-gray-50 transition disabled:opacity-50 shadow-sm"
                                  >
                                    {t("declineCancel") || "Decline"}
                                  </button>
                                </div>
                              </div>
                            )}
                            {(order.status === "Pending Completion" || order.status === "Out for Delivery") && selectedShop?.promptpayId && (
                              <button
                                onClick={() => setShowQrModal({ amount: order.totalAmount, promptpayId: selectedShop.promptpayId, promptpayName: selectedShop.promptpayName })}
                                className="w-full text-brand-700 font-bold bg-brand-100 hover:bg-brand-200 border border-brand-300 py-2 rounded text-xs transition shadow-sm flex items-center justify-center gap-2"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                                </svg>
                                {t("showPromptpayQr") || "Show PromptPay QR"}
                              </button>
                            )}
                            {order.status === "Out for Delivery" && (
                              <button
                                disabled={updatingOrderId === order.id}
                                onClick={() => handleUpdateOrderStatus(order.id, "Pending Completion")}
                                className="w-full bg-gray-800 text-white font-medium py-2 rounded text-xs hover:bg-gray-900 transition disabled:opacity-50"
                              >
                                {t("requestCompletion")}
                              </button>
                            )}
                            {order.status === "Pending Completion" && (
                              <p className="text-xs text-center text-blue-600 font-medium p-2 bg-blue-50 rounded">
                                {t("waitingForShopperToAccept")}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    } catch (e) {
                      console.error("Error rendering active order", e);
                      return null;
                    }
                  })
                )}
              </div>
            </div>
          </div>

          {/* SHOP OWNER REPORTING / TRANSACTION HISTORY */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <h2 className="text-xl font-semibold">{t("orderHistory") || t("transactionHistorySummary")}</h2>
              <div className="flex flex-col sm:flex-row gap-4 items-center w-full md:w-auto">
                <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-200 w-full sm:w-auto">
                  <span className="text-xs text-gray-500 font-medium whitespace-nowrap">{t("filterByDate")}:</span>
                  <input 
                    type="date" 
                    value={dateRange.start}
                    onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                    className="text-sm border border-gray-300 rounded px-2 py-1 w-full sm:w-auto"
                  />
                  <span className="text-gray-400 hidden sm:inline">-</span>
                  <input 
                    type="date" 
                    value={dateRange.end}
                    onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                    className="text-sm border border-gray-300 rounded px-2 py-1 w-full sm:w-auto"
                  />
                  {(dateRange.start || dateRange.end) && (
                    <button onClick={() => setDateRange({start: '', end: ''})} className="text-xs text-red-500 hover:text-red-700 ml-1 whitespace-nowrap">
                      {t("clearDates")}
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-200 flex flex-col items-center sm:items-end w-full sm:w-auto">
                    <p className="text-xs text-blue-700 font-medium uppercase tracking-wider">{t("completedOrdersPeriod") || "Monthly Orders"}</p>
                    <p className="text-xl sm:text-2xl font-bold text-blue-800">{filteredCompletedOrders.length}</p>
                  </div>
                  <div className="bg-green-50 px-4 py-2 rounded-lg border border-green-200 flex flex-col items-center sm:items-end w-full sm:w-auto">
                    <p className="text-xs text-green-700 font-medium uppercase tracking-wider">{t("filteredTotalEarnings") || "Total Earnings"}</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-800">฿{filteredTotalEarnings.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            {pastOrders.length === 0 ? (
              <p className="text-gray-500 text-sm">{t("noCompletedTransactions")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("date")}</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("orderId")}</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("shopper")}</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t("houseNo")}</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t("amount")}</th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pastOrders.map((order) => {
                      try {
                        const deliveryAddressStr = typeof order.deliveryAddress === 'string' ? order.deliveryAddress : "";
                        const houseNoMatch = deliveryAddressStr.match(/House No(?:[.:\s]*)([^\n,]+)/i) || 
                                             deliveryAddressStr.match(/บ้านเลขที่(?:[.:\s]*)([^\n,]+)/i);
                        const houseNo = houseNoMatch ? houseNoMatch[1].trim() : "-";
                        
                        return (
                          <tr key={order.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex flex-col">
                                <span suppressHydrationWarning>{new Date(order.createdAt).toLocaleDateString('en-GB')}</span>
                                {order.status === "Cancelled" && (
                                  <span className="text-[10px] bg-red-100 text-red-800 px-1.5 rounded w-fit mt-1">Cancelled</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                              {(order.id || "").slice(-8)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {order.shopperName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {houseNo}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                              ฿{Number(order.totalAmount || 0).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                              <button
                                onClick={() => setSelectedPastOrder(order)}
                                className="text-brand-600 hover:text-brand-800 font-medium bg-brand-50 hover:bg-brand-100 px-3 py-1 rounded transition"
                              >
                                {t("viewDetails")}
                              </button>
                            </td>
                          </tr>
                        );
                      } catch (e) {
                        console.error("Error rendering past order", e);
                        return null;
                      }
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* CUSTOMER MESSAGES */}
          <div id="customer-messages-section" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-6 scroll-mt-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              {t("customerMessages")}
              {customerChats.some(c => c.unreadByShopOwner) && (
                <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">NEW</span>
              )}
            </h2>

            <div className="flex flex-col md:flex-row border border-gray-200 rounded-lg overflow-hidden h-[75vh] max-h-[600px] md:h-[500px]">
              {/* Chat List */}
              <div className={`w-full md:w-1/3 h-full border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50 flex-col overflow-y-auto ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
                {customerChats.length === 0 ? (
                  <p className="p-4 text-sm text-gray-500 text-center mt-10">{t("noCustomerMessages")}</p>
                ) : (
                  customerChats.map(chat => (
                    <div key={chat.id} className="relative group">
                      <button
                        onClick={() => setSelectedChat(chat)}
                        className={`w-full p-4 text-left border-b border-gray-200 hover:bg-gray-100 transition pr-10 ${selectedChat?.id === chat.id ? 'bg-brand-50 border-l-4 border-l-brand-600' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-medium text-gray-900 text-sm truncate pr-2">{chat.shopperEmail}</p>
                          {chat.unreadByShopOwner && (
                            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1.5"></span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].text : t("newChat")}
                        </p>
                      </button>
                      <button
                        onClick={(e) => triggerDeleteChat(e, chat.id)}
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
              <div className={`w-full md:w-2/3 h-full bg-white flex-col relative ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
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
                      <h3 className="font-bold text-gray-900">{selectedChat.shopperEmail}</h3>
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col space-y-3">
                      {(selectedChat.messages || []).map((msg: any, i: number) => (
                        <div key={i} className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.sender === "shop_owner"
                            ? "bg-brand-600 text-white self-end rounded-br-none"
                            : "bg-gray-200 text-gray-800 self-start rounded-bl-none"
                          }`}>
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                          <span suppressHydrationWarning className={`text-[10px] mt-1 block ${msg.sender === "shop_owner" ? "text-brand-200" : "text-gray-500"}`}>
                            {new Date(msg.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
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
                          placeholder={t("typeReply")}
                          className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-brand-500"
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

          {/* SHOP REVIEWS */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-6 mb-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">{t("customerReviews")}</h2>
              <div className="flex items-center gap-2">
                {liveAverageRating ? (
                  <span className="flex items-center gap-1 bg-yellow-50 text-yellow-800 px-3 py-1 rounded-full text-sm font-bold border border-yellow-200">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-yellow-500">
                      <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                    </svg>
                    {liveAverageRating} ({shopReviews.length} Reviews)
                  </span>
                ) : (
                  <span className="text-sm text-gray-500">{t("noRatingYet")}</span>
                )}
              </div>
            </div>
            {shopReviews.length === 0 ? (
              <p className="text-gray-500 text-sm">{t("noReviewsYet")}</p>
            ) : (
              <div className="space-y-6">
                {shopReviews.map(review => (
                  <div key={review.id} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{review.shopperEmail}</p>
                        <p className="text-xs text-gray-500" suppressHydrationWarning>{new Date(review.createdAt).toLocaleDateString('en-GB')}</p>
                      </div>
                      <div className="flex text-yellow-400">
                        {[1, 2, 3, 4, 5].map(star => (
                          <svg key={star} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={star <= review.rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap mb-4">{review.comment}</p>
                    )}

                    {review.ownerReply ? (
                      <div className="mt-2 bg-white p-3 rounded border border-gray-200 text-sm">
                        <p className="font-bold text-gray-900 text-xs mb-1">{t("yourReply")}</p>
                        <p className="text-gray-700">{review.ownerReply}</p>
                      </div>
                    ) : (
                      <div className="mt-4 flex gap-2">
                        <input
                          type="text"
                          className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-brand-500 focus:border-brand-500"
                          placeholder={t("writeReply")}
                          value={replyInput[review.id] || ""}
                          onChange={(e) => setReplyInput(prev => ({ ...prev, [review.id]: e.target.value }))}
                          disabled={replyLoading === review.id}
                        />
                        <button
                          onClick={() => submitReply(review.id)}
                          disabled={!replyInput[review.id]?.trim() || replyLoading === review.id}
                          className="bg-brand-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50"
                        >
                          {replyLoading === review.id ? "..." : t("reply")}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
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
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-2">{t("deleteConversation")}</h3>
            <p className="text-sm text-gray-500 mb-6">
              {t("sureDeleteConversation")}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setChatToDelete(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition font-medium"
              >
                {t("cancel")}
              </button>
              <button
                onClick={confirmDeleteChat}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition font-medium"
              >
                {t("delete")}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Product Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">{t("deleteProduct")}</h3>
            <p className="text-sm text-gray-600 mb-6">{t("sureDeleteProduct")}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                {t("cancel")}
              </button>
              <button
                onClick={confirmDeleteProduct}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                {t("delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Shop Confirmation Modal */}
      {shopToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{t("deleteEntireShop")}</h3>
            <p className="text-sm text-gray-600 mb-6">
              {t("sureDeleteShop")}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShopToDelete(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteShop}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Delete Shop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SPOTLIGHT CONFIRMATION MODAL */}
      {spotlightConfirmData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
            {spotlightConfirmData.insufficientCoins ? (
              <>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-red-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-2">{t("insufficientCoins")}</h3>
                <p className="text-sm text-gray-500 mb-6">
                  {t("needCoins", { coins: spotlightTier, balance: coins })}
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setSpotlightConfirmData(null)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition font-medium text-sm"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    onClick={() => {
                      setSpotlightConfirmData(null);
                      router.push("/shopper/wallet");
                    }}
                    className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 transition font-medium text-sm"
                  >
                    {t("buyCoins")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-yellow-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                </div>
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-2">{t("promoteProductSpotlight")}</h3>
                <p className="text-sm text-gray-500 mb-4">
                  {t("promoteProductDesc")}
                </p>
                <div className="flex flex-col gap-2 mb-6">
                  {[
                    { coins: 2, hours: 24, label: t("twoCoins24Hours") },
                    { coins: 3, hours: 40, label: t("threeCoins40Hours") },
                    { coins: 5, hours: 72, label: t("fiveCoins72Hours") }
                  ].map(tier => (
                    <button
                      key={tier.coins}
                      onClick={() => setSpotlightTier(tier.coins as 2 | 3 | 5)}
                      className={`flex items-center justify-between p-3 border rounded-lg transition-all ${spotlightTier === tier.coins ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-gray-200 hover:border-brand-300 hover:bg-gray-50"}`}
                    >
                      <span className="font-medium text-gray-900">{tier.label}</span>
                      <span className="font-bold text-brand-600">{t("coins", { coins: tier.coins }) || `${tier.coins} Coins`}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setSpotlightConfirmData(null)}
                    disabled={promotingProductId === spotlightConfirmData.id}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition font-medium text-sm"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    onClick={confirmSpotlightPromotion}
                    disabled={promotingProductId === spotlightConfirmData.id}
                    className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 transition font-medium text-sm disabled:opacity-50"
                  >
                    {promotingProductId === spotlightConfirmData.id ? "..." : t("confirmPromotion")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Shop Modal */}
      {isRevisingShop && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-4 text-gray-900">Edit Shop Details</h3>
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm">{error}</div>}

            <form onSubmit={handleReviseShopSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Shop Name *</label>
                <input
                  required
                  type="text"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                  value={shopReviseData.name}
                  onChange={(e) => setShopReviseData({ ...shopReviseData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Category *</label>
                <select
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                  value={shopReviseData.category}
                  onChange={(e) => setShopReviseData({ ...shopReviseData, category: e.target.value })}
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
                  value={shopReviseData.description}
                  onChange={(e) => setShopReviseData({ ...shopReviseData, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location Type *</label>
                <div className="flex gap-6 mb-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="reviseLocationType"
                      value="house"
                      checked={shopReviseData.locationType === "house"}
                      onChange={() => setShopReviseData({ ...shopReviseData, locationType: "house" })}
                      className="text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                    />
                    House Number
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="reviseLocationType"
                      value="area"
                      checked={shopReviseData.locationType === "area"}
                      onChange={() => setShopReviseData({ ...shopReviseData, locationType: "area" })}
                      className="text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                    />
                    Nearby Area
                  </label>
                </div>

                {shopReviseData.locationType === "house" ? (
                  <div>
                    <input
                      required
                      type="number"
                      placeholder="e.g. 123"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                      value={shopReviseData.houseNumber}
                      onChange={(e) => setShopReviseData({ ...shopReviseData, houseNumber: e.target.value })}
                    />
                  </div>
                ) : (
                  <div>
                    <input
                      required
                      type="text"
                      maxLength={100}
                      placeholder="e.g. Near the main gate"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                      value={shopReviseData.location}
                      onChange={(e) => setShopReviseData({ ...shopReviseData, location: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h4 className="font-bold text-gray-900 mb-2">{t("promptpaySetup") || "PromptPay Details (Optional)"}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t("promptpayId") || "PromptPay ID"}</label>
                    <input
                      type="text"
                      placeholder="0812345678"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                      value={shopReviseData.promptpayId}
                      onChange={(e) => setShopReviseData({ ...shopReviseData, promptpayId: e.target.value })}
                    />
                    <p className="text-[10px] text-gray-500 mt-1">{t("promptpaySecurityNote") || "Your ID is securely stored and encrypted in our database."}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t("promptpayName") || "Account Name"}</label>
                    <input
                      type="text"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500"
                      value={shopReviseData.promptpayName}
                      onChange={(e) => setShopReviseData({ ...shopReviseData, promptpayName: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">Shop Cover Image</label>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                  onChange={(e) => setShopReviseFile(e.target.files ? e.target.files[0] : null)}
                />
              </div>

              <div className="flex gap-2 pt-4 justify-end">
                <button
                  type="button"
                  onClick={() => setIsRevisingShop(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-brand-600 text-white px-6 py-2 rounded-md font-medium hover:bg-brand-700 transition disabled:opacity-50"
                >
                  {loading ? "Submitting..." : (selectedShop?.status === "approved" ? "Save Changes" : "Save Changes & Request Approval")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{t("success")}</h3>
            <p className="text-sm text-gray-600 mb-6">
              {t("changesSaved")}
            </p>
            <div className="flex justify-center">
              <button
                onClick={() => setShowSuccessModal(false)}
                className="px-6 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700 transition"
              >
                {t("okay")}
              </button>
            </div>
          </div>
        </div>
      )}

      <BuyCoffeeModal isOpen={showCoffeeModal} onClose={() => setShowCoffeeModal(false)} />
      <TermsModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />

      {/* DECLINE CANCEL MODAL */}
      {declineCancelModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">{t("declineCancelTitle") || "Decline Cancellation"}</h2>
              <button onClick={() => setDeclineCancelModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">{t("declineCancelDesc") || "Let the shopper know why you cannot accept the cancellation request."}</p>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("reasonOptional") || "Reason (Optional)"}</label>
              <textarea
                rows={3}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500 p-2"
                placeholder={t("declineReasonPlaceholder") || "e.g., The food is already cooked."}
                value={declineCancelReason}
                onChange={(e) => setDeclineCancelReason(e.target.value)}
              ></textarea>
              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                <button type="button" onClick={() => setDeclineCancelModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition">
                  {t("cancel") || "Close"}
                </button>
                <button 
                  onClick={handleDeclineCancel}
                  disabled={isDecliningCancel} 
                  className="bg-brand-600 text-white px-6 py-2 rounded-md font-medium hover:bg-brand-700 disabled:opacity-50 transition"
                >
                  {isDecliningCancel ? t("submitting") || "Submitting..." : t("submit")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* APP FEEDBACK MODAL */}
      {/* Order Details Modal */}
      {selectedPastOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">{t("orderDetails") || "Order Details"}</h2>
              <button onClick={() => setSelectedPastOrder(null)} className="text-gray-400 hover:text-gray-600 transition">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{selectedPastOrder.shopperName}</h3>
                  <p className="text-sm text-gray-500" suppressHydrationWarning>{new Date(selectedPastOrder.createdAt).toLocaleString('en-GB')}</p>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    selectedPastOrder.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedPastOrder.status}
                  </span>
                  <p className="text-xs text-gray-500 font-mono mt-2">ID: {(selectedPastOrder.id || "").slice(-8)}</p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mb-6">
                <h4 className="text-sm font-bold text-gray-900 mb-2">{t("deliveryAddress")}</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedPastOrder.deliveryAddress}</p>
              </div>

              <h4 className="text-sm font-bold text-gray-900 mb-3 border-b pb-2">{t("items")}</h4>
              <div className="space-y-4 mb-6">
                {(Array.isArray(selectedPastOrder.items) ? selectedPastOrder.items : []).map((item: any, i: number) => (
                  <div key={i} className="flex flex-col text-gray-700">
                    <div className="flex justify-between">
                      <span className="font-medium text-sm">{item.quantity}x {item.productName}</span>
                      <span className="text-sm font-medium">฿{((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
                    </div>

                    {item.selectedOptions && typeof item.selectedOptions === 'object' && Object.keys(item.selectedOptions).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.selectedOptions && typeof item.selectedOptions === 'object' && Object.entries(item.selectedOptions).map(([key, value]) => (
                          <span key={key} className="text-[10px] bg-white text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                            {key}: {Array.isArray(value) ? value.join(', ') : (value as string)}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.note && (
                      <p className="text-xs text-gray-500 mt-1 italic bg-white p-2 rounded border border-gray-100">{t("note")} {item.note}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between font-bold text-lg text-gray-900 pt-4 border-t border-gray-200">
                <span>{t("total")}</span>
                <span>฿{Number(selectedPastOrder.totalAmount || 0).toFixed(2)}</span>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button type="button" onClick={() => setSelectedPastOrder(null)} className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                {t("cancel") || "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
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
      {/* SHOP OWNER CANCEL ORDER MODAL */}
      {shopCancelModalOrderId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">{t("cancelOrderModalTitle") || "Cancel Order"}</h3>
              <button onClick={() => { setShopCancelModalOrderId(null); setShopCancelReason(""); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("cancelReasonPlaceholder") || "Why are you cancelling this order?"}</label>
              
              {/* Predefined Reasons */}
              <div className="flex flex-wrap gap-2 mb-3">
                {[t("predefinedReason1") || "Out of stock", t("predefinedReason2") || "Cannot deliver right now", t("predefinedReason3") || "Shop is closing"].map((reason, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setShopCancelReason(reason)}
                    className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition border border-gray-200"
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <textarea
                required
                rows={3}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500 p-2 border"
                placeholder={t("cancelReasonPlaceholder") || "Enter cancellation reason..."}
                value={shopCancelReason}
                onChange={(e) => setShopCancelReason(e.target.value)}
              ></textarea>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => { setShopCancelModalOrderId(null); setShopCancelReason(""); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition"
              >
                {t("close") || "Close"}
              </button>
              <button
                type="button"
                disabled={!shopCancelReason.trim() || updatingOrderId === shopCancelModalOrderId}
                onClick={async () => {
                  await handleUpdateOrderStatus(shopCancelModalOrderId, "Cancelled", shopCancelReason);
                  setShopCancelModalOrderId(null);
                  setShopCancelReason("");
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-md font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {updatingOrderId === shopCancelModalOrderId ? "..." : (t("submitCancel") || "Confirm Cancellation")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}
