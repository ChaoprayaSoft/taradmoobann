"use client";

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import MysteryChests from './MysteryChests';
import SpinWheel from './SpinWheel';
import ScratchCard from './ScratchCard';

export default function MiniGameContainer() {
  const { data: session, status } = useSession();
  const t = useTranslations('minigame');
  const [selectedGame, setSelectedGame] = useState<'chest' | 'wheel' | 'scratch' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePlay = async (gameType: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/minigame/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameType })
      });
      const data = await res.json();
      
      // We don't trigger context updates for coins here directly, 
      // but ideally we would have a global state or SWR mutate.
      // For now, next page load or wallet check will update it.
      
      setIsProcessing(false);
      return data;
    } catch (err: any) {
      setIsProcessing(false);
      return { success: false, error: err.message || 'Error connecting to server' };
    }
  };

  if (status === 'loading') {
    return <div className="animate-pulse h-48 bg-gray-100 rounded-2xl w-full max-w-4xl mx-auto"></div>;
  }

  return (
    <div className="w-full max-w-4xl mx-auto my-12 p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl shadow-sm border border-indigo-100">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
          {t('title')}
        </h2>
      </div>

      {!session ? (
        <div className="text-center py-8">
          <p className="text-lg text-gray-600 mb-6">{t('loginToPlay')}</p>
          <Link href="/auth/signin" className="inline-block px-8 py-3 bg-indigo-600 text-white rounded-full font-bold shadow-md hover:bg-indigo-700 transition hover:-translate-y-1">
            Login
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          {!selectedGame ? (
            <div className="w-full">
              <p className="text-center text-gray-600 mb-6 font-medium">{t('selectGame')}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button 
                  onClick={() => setSelectedGame('chest')}
                  className="p-6 bg-white rounded-2xl shadow hover:shadow-lg transition flex flex-col items-center gap-3 border-2 border-transparent hover:border-amber-400 group"
                >
                  <span className="text-5xl group-hover:scale-110 transition">🎁</span>
                  <span className="font-bold text-gray-800">{t('mysteryChest')}</span>
                </button>
                <button 
                  onClick={() => setSelectedGame('wheel')}
                  className="p-6 bg-white rounded-2xl shadow hover:shadow-lg transition flex flex-col items-center gap-3 border-2 border-transparent hover:border-pink-400 group"
                >
                  <span className="text-5xl group-hover:scale-110 group-hover:rotate-45 transition">🎡</span>
                  <span className="font-bold text-gray-800">{t('spinWheel')}</span>
                </button>
                <button 
                  onClick={() => setSelectedGame('scratch')}
                  className="p-6 bg-white rounded-2xl shadow hover:shadow-lg transition flex flex-col items-center gap-3 border-2 border-transparent hover:border-gray-400 group"
                >
                  <span className="text-5xl group-hover:scale-110 transition">🎫</span>
                  <span className="font-bold text-gray-800">{t('scratchCard')}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full relative bg-white p-6 rounded-2xl shadow-inner min-h-[300px]">
              <button 
                onClick={() => setSelectedGame(null)}
                className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 font-medium text-sm"
              >
                ← Back
              </button>
              
              <div className="pt-8">
                {selectedGame === 'chest' && <MysteryChests onPlay={() => handlePlay('chest')} isProcessing={isProcessing} />}
                {selectedGame === 'wheel' && <SpinWheel onPlay={() => handlePlay('wheel')} isProcessing={isProcessing} />}
                {selectedGame === 'scratch' && <ScratchCard onPlay={() => handlePlay('scratch')} isProcessing={isProcessing} />}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
