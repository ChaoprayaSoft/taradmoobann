"use client";

import { useState } from "react";
import { useCart } from "./CartProvider";

export default function ProductCard({ product, shopName, isClosed }: { product: any, shopName?: string, isClosed?: boolean }) {
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const { addToCart } = useCart();
  
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string | string[]>>({});
  const [note, setNote] = useState("");

  const images = product.imageUrls || (product.imageUrl ? [product.imageUrl] : []);
  const options = product.options || [];
  
  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIdx((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIdx((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleOpenConfig = () => {
    // Pre-select first choice for required options
    const defaults: Record<string, string | string[]> = {};
    options.forEach((opt: any) => {
      if (opt.allowMultiple) {
        defaults[opt.name] = [];
      } else if (opt.choices && opt.choices.length > 0) {
        defaults[opt.name] = opt.choices[0];
      }
    });
    setSelectedOptions(defaults);
    setNote("");
    setShowConfigModal(true);
  };

  const confirmAddToCart = () => {
    addToCart(product, selectedOptions, note);
    setShowConfigModal(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition flex flex-col h-full relative">
      {/* Image Carousel Area */}
      <div className="relative w-full h-48 bg-gray-100 group">
        {images.length > 0 ? (
          <>
            <img 
              src={images[currentImageIdx]} 
              alt={product.name} 
              className="w-full h-48 object-cover" 
            />
            {images.length > 1 && (
              <>
                <button 
                  onClick={handlePrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <button 
                  onClick={handleNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
                {/* Dots indicator */}
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                  {images.map((_: any, idx: number) => (
                    <div 
                      key={idx} 
                      className={`w-1.5 h-1.5 rounded-full ${idx === currentImageIdx ? "bg-white" : "bg-white/50"}`} 
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            No Image
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-bold text-lg text-gray-900">{product.name}</h3>
          <span className="font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded text-sm whitespace-nowrap ml-2">
            ฿{product.price}
          </span>
        </div>
        {shopName && (
          <p className="text-xs text-brand-600 font-medium mb-2">From: {shopName}</p>
        )}
        <p className="text-gray-500 text-sm mb-4 line-clamp-2 flex-1">{product.description}</p>
        
        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {product.tags.map((tag: string) => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
        
        {isClosed ? (
          <button 
            disabled
            className="w-full bg-gray-300 text-gray-500 font-medium py-2 rounded-md mt-auto cursor-not-allowed"
          >
            Shop Closed
          </button>
        ) : (
          <button 
            onClick={handleOpenConfig}
            className="w-full bg-brand-600 text-white font-medium py-2 rounded-md hover:bg-brand-700 transition mt-auto"
          >
            Add to Cart
          </button>
        )}
      </div>

      {/* Add to Cart Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-xl text-gray-900 mb-2">{product.name}</h3>
            <p className="text-gray-500 mb-6 text-sm">{product.description}</p>
            
            <div className="space-y-4">
              {options.map((opt: any, idx: number) => (
                <div key={idx} className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {opt.name} {opt.required && <span className="text-red-500">*</span>}
                    {opt.allowMultiple && <span className="text-gray-400 text-xs font-normal ml-2">(Choose multiple)</span>}
                  </label>
                  
                  <div className="space-y-2 pl-1">
                    {opt.choices.map((choice: string) => {
                      if (opt.allowMultiple) {
                        const isChecked = Array.isArray(selectedOptions[opt.name]) && selectedOptions[opt.name].includes(choice);
                        return (
                          <label key={choice} className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                setSelectedOptions(prev => {
                                  const currentArr = Array.isArray(prev[opt.name]) ? [...prev[opt.name]] : [];
                                  if (e.target.checked) {
                                    return { ...prev, [opt.name]: [...currentArr, choice] };
                                  } else {
                                    return { ...prev, [opt.name]: currentArr.filter(c => c !== choice) };
                                  }
                                });
                              }}
                              className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                            />
                            <span className="text-sm text-gray-800">{choice}</span>
                          </label>
                        );
                      } else {
                        // Radio button for single choice
                        const isChecked = selectedOptions[opt.name] === choice;
                        return (
                          <label key={choice} className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio"
                              name={`opt-${opt.name}-${product.id}`}
                              checked={isChecked}
                              onChange={() => setSelectedOptions(prev => ({ ...prev, [opt.name]: choice }))}
                              className="w-4 h-4 text-brand-600 border-gray-300 focus:ring-brand-500"
                            />
                            <span className="text-sm text-gray-800">{choice}</span>
                          </label>
                        );
                      }
                    })}
                  </div>
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Special Instructions (Note)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. No onions, extra spicy"
                  className="w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-8 flex gap-3 justify-end">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 font-medium text-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddToCart}
                className="px-4 py-2 text-white bg-brand-600 rounded-md hover:bg-brand-700 font-medium text-sm transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
