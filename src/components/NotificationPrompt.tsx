"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { requestForToken } from "@/lib/firebase";
import { getMessaging, onMessage, isSupported } from "firebase/messaging";
import { getApp } from "firebase/app";
import { useTranslations } from "next-intl";

export default function NotificationPrompt() {
  const { data: session } = useSession();
  const [showPrompt, setShowPrompt] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [toastMessage, setToastMessage] = useState<{title: string, body: string} | null>(null);
  const t = useTranslations("NotificationPrompt");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
      
      // If user is logged in, and permission is not granted or denied, show prompt
      if (session && Notification.permission === "default") {
        // We can wait a few seconds before showing it so it's not too aggressive
        const timer = setTimeout(() => {
          setShowPrompt(true);
        }, 3000);
        return () => clearTimeout(timer);
      }
      
      // If already granted, let's just make sure we have their latest token saved
      if (session && Notification.permission === "granted") {
        handleEnableNotifications(true);
      }
      
        // Setup foreground listener
        const setupForegroundListener = async () => {
          if (await isSupported()) {
            const messaging = getMessaging(getApp());
            const unsubscribe = onMessage(messaging, (payload) => {
              console.log("Message received in foreground: ", payload);
              if (payload.notification) {
                // Play a simple beep sound using Web Audio API
                try {
                  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                  const oscillator = audioCtx.createOscillator();
                  const gainNode = audioCtx.createGain();
                  
                  oscillator.connect(gainNode);
                  gainNode.connect(audioCtx.destination);
                  
                  oscillator.type = 'sine';
                  oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
                  gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); // Volume
                  
                  oscillator.start();
                  gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);
                  oscillator.stop(audioCtx.currentTime + 0.5);
                } catch(e) {
                  console.error("Audio play failed:", e);
                }

                setToastMessage({
                  title: payload.notification.title || t("newNotification"),
                  body: payload.notification.body || ""
                });
                
                // Always trigger a system notification so they never miss it even if tab is unfocused
                if (Notification.permission === "granted") {
                  const notif = new Notification(payload.notification.title || t("newNotification"), { 
                    body: payload.notification.body,
                    icon: '/icon.svg',
                    data: payload.data
                  });
                  notif.onclick = function() {
                    window.focus();
                    if (this.data && this.data.url) {
                      window.location.href = this.data.url;
                    }
                    this.close();
                  };
                }
                
                setTimeout(() => {
                  setToastMessage(null);
                }, 5000); // hide toast after 5s
              }
            });
            return unsubscribe;
          }
        };
      
      let unsubscribeFn: any;
      setupForegroundListener().then(unsub => {
        unsubscribeFn = unsub;
      });
      
      return () => {
        if (unsubscribeFn) unsubscribeFn();
      };
    }
  }, [session]);

  const handleEnableNotifications = async (silent = false) => {
    try {
      if (!silent) {
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== "granted") {
          setShowPrompt(false);
          return;
        }
      }

      const token = await requestForToken();
      if (token) {
        await fetch("/api/user/fcm-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });
      }
      setShowPrompt(false);
    } catch (error) {
      console.error("Error enabling notifications:", error);
      setShowPrompt(false);
    }
  };

  if (!showPrompt && !toastMessage) return null;

  return (
    <>
      {showPrompt && (
        <div className="fixed bottom-4 right-4 max-w-sm bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 animate-fade-in-up">
          <div className="flex items-start gap-4">
            <div className="bg-brand-100 p-2 rounded-full text-brand-600 flex-shrink-0 mt-1">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-1">{t("enableTitle")}</h3>
              <p className="text-sm text-gray-500 mb-3">
                {t("enableDesc")}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEnableNotifications(false)}
                  className="bg-brand-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-brand-700 transition"
                >
                  {t("allow")}
                </button>
                <button
                  onClick={() => setShowPrompt(false)}
                  className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded-md text-sm font-medium hover:bg-gray-200 transition"
                >
                  {t("maybeLater")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed top-20 right-4 max-w-sm bg-white rounded-lg shadow-xl border border-l-4 border-l-brand-600 p-4 z-50 animate-fade-in-up">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-gray-900 mb-1">{toastMessage.title}</h3>
              <p className="text-sm text-gray-600">
                {toastMessage.body}
              </p>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-gray-400 hover:text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

