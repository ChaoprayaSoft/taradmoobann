"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  onPlay: () => Promise<{ success: boolean; reward?: number; error?: string }>;
  isProcessing: boolean;
}

export default function SpinWheel({ onPlay, isProcessing }: Props) {
  const t = useTranslations('minigame');
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [reward, setReward] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSpin = async () => {
    if (isProcessing || isSpinning) return;
    
    setReward(null);
    setError(null);
    setIsSpinning(true);
    
    // Start spinning fast visually
    const initialSpins = 5 * 360; 
    
    const result = await onPlay();
    
    if (result.success) {
      // Dummy logic to map reward to an angle
      // 0, 0.5, 1, 1.5, 3, 4, 5
      // Just pick random angle for now
      const extraAngle = Math.floor(Math.random() * 360);
      setRotation((prev) => prev + initialSpins + extraAngle);
      
      setTimeout(() => {
        setIsSpinning(false);
        setReward(result.reward || 0);
      }, 3000); // 3 seconds spin duration
    } else {
      setIsSpinning(false);
      setError(result.error || 'Failed to play');
    }
  };

  const reset = () => {
    setReward(null);
    setError(null);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <h3 className="text-xl font-bold mb-6">{t('spinWheel')}</h3>
      
      <div className="relative mb-8 w-64 h-64">
        {/* Pointer */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 text-3xl">
          👇
        </div>
        
        {/* Wheel */}
        <div 
          className="w-full h-full rounded-full border-4 border-indigo-600 shadow-xl overflow-hidden relative transition-transform"
          style={{
            background: 'conic-gradient(from 0deg, #fcd34d 0 60deg, #f87171 60deg 120deg, #60a5fa 120deg 180deg, #34d399 180deg 240deg, #c084fc 240deg 300deg, #fb923c 300deg 360deg)',
            transform: `rotate(${rotation}deg)`,
            transitionDuration: isSpinning ? '3s' : '0s',
            transitionTimingFunction: 'cubic-bezier(0.17, 0.67, 0.12, 0.99)'
          }}
        >
          {/* Wheel center dot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-inner z-20"></div>
        </div>
      </div>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      {reward === null && !isSpinning && (
        <button
          onClick={handleSpin}
          disabled={isProcessing}
          className="px-8 py-3 bg-gradient-to-r from-pink-500 to-indigo-500 text-white rounded-full font-bold shadow-lg hover:scale-105 transition disabled:opacity-50"
        >
          SPIN!
        </button>
      )}

      {reward !== null && !isSpinning && (
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
