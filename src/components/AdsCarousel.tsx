"use client";

import { useState, useEffect } from "react";

export default function AdsCarousel({ ads, speed = 5 }: { ads: any[], speed?: number }) {
  const [selectedAd, setSelectedAd] = useState<any | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!ads || ads.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % ads.length);
    }, speed * 1000); // convert seconds to ms
    return () => clearInterval(interval);
  }, [ads, speed]);

  if (!ads || ads.length === 0) return null;

  return (
    <div className="w-full mt-12 mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4 px-4 sm:px-0">Sponsored</h2>
      
      <div className="relative overflow-hidden rounded-xl bg-gray-100 shadow-sm border border-gray-200">
        <div 
          className="flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {ads.map((ad) => (
            <div 
              key={ad.id} 
              className="w-full flex-shrink-0 cursor-pointer relative"
              onClick={() => setSelectedAd(ad)}
            >
              <div className="h-48 sm:h-64 md:h-80 w-full relative group">
                {ad.imageUrl ? (
                  <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover transition duration-300" />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">
                    No Image
                  </div>
                )}
                <div className="p-4 sm:p-6 absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16">
                  <h3 className="text-white font-bold text-xl sm:text-2xl line-clamp-1">{ad.title}</h3>
                  <p className="text-gray-200 text-sm sm:text-base mt-1 line-clamp-2">{ad.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Carousel Indicators */}
        {ads.length > 1 && (
          <div className="absolute bottom-4 right-4 flex space-x-2">
            {ads.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-2.5 h-2.5 rounded-full transition ${currentIndex === idx ? "bg-white" : "bg-white/50 hover:bg-white/80"}`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* AD MODAL (Same as AdsSection) */}
      {selectedAd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={() => setSelectedAd(null)}>
          <div 
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedAd.imageUrl && (
              <img src={selectedAd.imageUrl} alt={selectedAd.title} className="w-full h-56 object-cover" />
            )}
            <div className="p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedAd.title}</h3>
              <p className="text-gray-600 mb-6">{selectedAd.description}</p>
              
              <div className="flex gap-4">
                {selectedAd.linkUrl ? (
                  <a 
                    href={selectedAd.linkUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1 bg-brand-600 text-white text-center font-bold py-3 rounded-xl hover:bg-brand-700 transition"
                  >
                    Visit Link
                  </a>
                ) : (
                  <button 
                    disabled
                    className="flex-1 bg-gray-300 text-gray-500 font-bold py-3 rounded-xl cursor-not-allowed"
                  >
                    Visit Link
                  </button>
                )}
                <button 
                  onClick={() => setSelectedAd(null)}
                  className="px-6 py-3 flex-1 bg-gray-100 text-gray-800 font-bold rounded-xl hover:bg-gray-200 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
