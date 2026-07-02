"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  onPlay: () => Promise<{ success: boolean; reward?: number; error?: string }>;
  isProcessing: boolean;
}

export default function MysteryChests({ onPlay, isProcessing }: Props) {
  const t = useTranslations('minigame');
  const [selectedChest, setSelectedChest] = useState<number | null>(null);
  const [reward, setReward] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (index: number) => {
    if (isProcessing || selectedChest !== null) return;
    
    setSelectedChest(index);
    setError(null);
    
    const result = await onPlay();
    if (result.success) {
      setReward(result.reward || 0);
    } else {
      setError(result.error || 'Failed to play');
      setSelectedChest(null);
    }
  };

  const reset = () => {
    setSelectedChest(null);
    setReward(null);
    setError(null);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <h3 className="text-xl font-bold mb-4">{t('mysteryChest')}</h3>
      
      <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-6">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            onClick={() => handleSelect(index)}
            className={`w-24 h-24 sm:w-32 sm:h-32 flex items-center justify-center rounded-lg cursor-pointer transition-all duration-500 relative
              ${selectedChest === index ? 'bg-amber-100 scale-110 shadow-xl' : 'bg-amber-500 hover:bg-amber-400 hover:-translate-y-2'}
              ${isProcessing && selectedChest !== index ? 'opacity-50 cursor-not-allowed' : ''}
              ${selectedChest !== null && selectedChest !== index ? 'opacity-50 grayscale' : ''}
            `}
            style={{ perspective: '1000px' }}
          >
            {/* Simple chest representation */}
            <div className={`text-4xl transition-transform duration-700 ${selectedChest === index ? 'rotate-y-180 scale-0 opacity-0' : 'scale-100'}`}>
              🎁
            </div>
            
            {/* Result */}
            {selectedChest === index && reward !== null && (
              <div className="absolute inset-0 flex flex-col items-center justify-center animate-bounce">
                <span className="text-3xl sm:text-4xl">{reward > 0 ? '💰' : '😢'}</span>
                <span className="font-bold text-amber-600 mt-1">
                  {reward > 0 ? `+${reward}` : '0'}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      {reward !== null && (
        <div className="text-center animate-fade-in-up">
          <p className="text-lg font-bold text-green-600 mb-4">
            {reward > 0 ? t('youWon', { coins: reward }) : t('youLost')}
          </p>
          <button
            onClick={reset}
            className="px-6 py-2 bg-indigo-600 text-white rounded-full font-semibold hover:bg-indigo-700 transition"
          >
            {t('tryAgain')}
          </button>
        </div>
      )}
    </div>
  );
}
