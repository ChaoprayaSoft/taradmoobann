"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Confetti from "react-confetti";
import { Coins, X, PartyPopper } from "lucide-react";

export default function WelcomeModal() {
  const { data: session, update } = useSession();
  const [isVisible, setIsVisible] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    // Only show if session exists and showWelcomeModal is true
    if (session?.user && (session.user as any).showWelcomeModal) {
      setIsVisible(true);
      // Capture window size for confetti
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
  }, [session]);

  const handleDismiss = async () => {
    setIsVisible(false);
    try {
      await fetch("/api/user/dismiss-welcome", { method: "POST" });
      // Update local session state to avoid showing it again if component remounts
      await update({
        ...session,
        user: {
          ...session?.user,
          showWelcomeModal: false,
        },
      });
    } catch (error) {
      console.error("Failed to dismiss welcome modal:", error);
    }
  };

  if (!isVisible) return null;

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.15}
          className="!z-[101]"
        />
        
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 relative z-[102] text-center animate-scale-up border-4 border-brand-100">
          <button 
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mx-auto w-20 h-20 bg-brand-100 rounded-full flex items-center justify-center mb-6">
            <PartyPopper className="w-10 h-10 text-brand-600" />
          </div>

          <h2 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">
            Welcome to TaradMooBann!
          </h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            We're thrilled to have you here. To get you started on your journey, we've deposited a welcome gift into your account!
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 mb-8 transform hover:scale-105 transition duration-300">
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Coins className="w-7 h-7 text-yellow-600" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-yellow-700 mb-1">50 Free Coins!</h3>
            <p className="text-sm text-yellow-600 font-medium">Added to your wallet</p>
          </div>

          <button
            onClick={handleDismiss}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 px-6 rounded-xl transition duration-200 shadow-lg shadow-brand-200"
          >
            Start Exploring
          </button>
        </div>
      </div>
    </>
  );
}
