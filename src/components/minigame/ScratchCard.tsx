"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  onPlay: () => Promise<{ success: boolean; reward?: number; error?: string }>;
  isProcessing: boolean;
}

export default function ScratchCard({ onPlay, isProcessing }: Props) {
  const t = useTranslations('minigame');
  const [scratched, setScratched] = useState(false);
  const [reward, setReward] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScratch = async () => {
    if (isProcessing || scratched) return;
    
    setError(null);
    const result = await onPlay();
    
    if (result.success) {
      setReward(result.reward || 0);
      setScratched(true);
    } else {
      setError(result.error || 'Failed to play');
    }
  };

  const reset = () => {
    setScratched(false);
    setReward(null);
    setError(null);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <h3 className="text-xl font-bold mb-2">{t('scratchCard')}</h3>
      <p className="text-gray-500 mb-6 text-sm">{t('scratchToWin')}</p>
      
      <div 
        onClick={handleScratch}
        className={`w-64 h-32 rounded-xl relative overflow-hidden cursor-pointer shadow-lg transition-transform ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
      >
        {/* Underneath (Result) */}
        <div className="absolute inset-0 bg-white flex items-center justify-center border-2 border-gray-200 rounded-xl">
          {scratched && reward !== null && (
            <div className="flex items-center space-x-4 animate-bounce">
              <span className="text-4xl">{reward > 0 ? '🤑' : '😭'}</span>
              <span className="text-3xl font-black text-amber-500">
                {reward > 0 ? `+${reward}` : '0'}
              </span>
            </div>
          )}
        </div>

        {/* Scratch Cover */}
        <div 
          className={`absolute inset-0 bg-gray-400 flex flex-col items-center justify-center transition-opacity duration-1000 ${scratched ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.4\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3Ccircle cx=\'13\' cy=\'13\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E")' }}
        >
          <span className="text-white font-bold tracking-widest uppercase">Scratch Here</span>
        </div>
      </div>

      {error && <div className="text-red-500 mt-4">{error}</div>}

      {scratched && reward !== null && (
        <div className="text-center mt-6 animate-fade-in-up">
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
