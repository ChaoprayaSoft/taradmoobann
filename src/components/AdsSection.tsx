"use client";

import { useState } from "react";
import Link from "next/link";

export default function AdsSection({ ads }: { ads: any[] }) {
  const [selectedAd, setSelectedAd] = useState<any | null>(null);

  if (!ads || ads.length === 0) return null;

  return (
    <div className="w-full mt-16 mb-8 px-4">
      <h2 className="text-xl font-bold text-gray-900 mb-6 text-left">Sponsored</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {ads.map((ad) => (
          <div 
            key={ad.id} 
            className="cursor-pointer group rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition relative bg-white"
            onClick={() => setSelectedAd(ad)}
          >
            {ad.imageUrl ? (
              <img src={ad.imageUrl} alt={ad.title} className="w-full h-40 object-cover group-hover:scale-105 transition duration-300" />
            ) : (
              <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400">
                No Image
              </div>
            )}
            <div className="p-4 absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-12">
              <h3 className="text-white font-bold text-lg line-clamp-1">{ad.title}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* AD MODAL */}
      {selectedAd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedAd(null)}>
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
