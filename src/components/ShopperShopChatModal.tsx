"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

interface ShopperShopChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  shopName: string;
}

export default function ShopperShopChatModal({ isOpen, onClose, shopId, shopName }: ShopperShopChatModalProps) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("ShopperShopChatModal");

  const fetchChat = async () => {
    if (!session?.user?.email || !shopId) return;
    try {
      const res = await fetch(`/api/shop-chat?shopId=${shopId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages) {
          setMessages(data.messages);
        }
      }
    } catch (error) {
      console.error("Failed to fetch chat:", error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchChat();
      const interval = setInterval(fetchChat, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, shopId, session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setLoading(true);
    const textToSend = inputText;
    setInputText("");

    try {
      // Optimistic update
      setMessages(prev => [...prev, { text: textToSend, sender: "shopper", timestamp: new Date().toISOString() }]);

      await fetch("/api/shop-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId, text: textToSend }),
      });
      await fetchChat();
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col h-[500px] max-h-[90vh]">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div>
            <h3 className="font-bold text-lg text-gray-900">{t("chatWith", { shopName })}</h3>
            <p className="text-xs text-gray-500">{t("shopOwner")}</p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col space-y-3">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-gray-400 mt-auto mb-auto">{t("sendToStartShop")}</p>
          ) : (
            messages.map((msg, i) => (
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
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 bg-white border-t border-gray-200">
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t("typeMessageShop")}
              className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-brand-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="bg-brand-600 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-brand-700 transition disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-1">
                <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
