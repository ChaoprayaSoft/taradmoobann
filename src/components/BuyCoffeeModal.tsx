"use client";

import { useState } from "react";
import generatePayload from "promptpay-qr";
import { QRCodeSVG } from "qrcode.react";

const DRINKS = [
  { name: "Pure Matcha", price: 30, icon: "🍵" },
  { name: "Matcha Latte", price: 40, icon: "🍵" },
  { name: "Americano", price: 35, icon: "☕" },
  { name: "Soy Milk", price: 7, icon: "🥛" },
  { name: "Starbuck", price: 100, icon: "🥤" },
];

export default function BuyCoffeeModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [selectedDrink, setSelectedDrink] = useState<{ name: string; price: number; icon: string } | null>(null);
  const [showQR, setShowQR] = useState(false);

  if (!isOpen) return null;

  const handleSelect = (drink: { name: string; price: number; icon: string }) => {
    setSelectedDrink(drink);
    setShowQR(true);
  };

  const handleClose = () => {
    setSelectedDrink(null);
    setShowQR(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 relative">
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-orange-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900">Buy Developer a Coffee</h3>
          <p className="text-sm text-gray-500 mt-1">Thank you for supporting this project!</p>
        </div>

        {!showQR ? (
          <div className="space-y-3">
            {DRINKS.map((drink) => (
              <button
                key={drink.name}
                onClick={() => handleSelect(drink as any)}
                className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition text-left group"
              >
                <span className="font-medium text-gray-800 flex items-center gap-3">
                  <span className="text-xl group-hover:scale-110 transition-transform">{drink.icon}</span>
                  {drink.name}
                </span>
                <span className="font-bold text-orange-600">{drink.price} Baht</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center animate-fade-in">
            <div className="bg-white p-2 border-4 border-gray-800 inline-block rounded-xl shadow-sm mb-4">
              {selectedDrink && (
                <QRCodeSVG 
                  value={generatePayload("0909739266", { amount: selectedDrink.price })} 
                  size={192} 
                />
              )}
            </div>
            <p className="font-medium text-gray-800 text-lg mb-1 flex items-center justify-center gap-2">
              <span className="text-2xl">{selectedDrink?.icon}</span>
              {selectedDrink?.name}
            </p>
            <p className="text-orange-600 font-bold text-xl mb-4">{selectedDrink?.price} Baht</p>
            <button 
              onClick={() => setShowQR(false)}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Choose a different drink
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
