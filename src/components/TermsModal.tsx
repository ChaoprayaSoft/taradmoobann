"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTranslations } from "next-intl";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TermsModal({ isOpen, onClose }: TermsModalProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const t = useTranslations("Navigation");

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      const fetchTerms = async () => {
        try {
          const docRef = doc(db, "settings", "terms_of_use");
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setContent(docSnap.data().content || "");
          } else {
            setContent("<p>Terms of Use have not been set yet.</p>");
          }
        } catch (error) {
          console.error("Error fetching terms:", error);
          setContent("<p>Error loading Terms of Use.</p>");
        } finally {
          setLoading(false);
        }
      };
      fetchTerms();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-900">{t("termsOfUse") || "Terms of Use"}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition p-2 rounded-full hover:bg-gray-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
            </div>
          ) : (
            <div 
              className="prose prose-sm sm:prose-base max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition"
          >
            {t("close") || "Close"}
          </button>
        </div>

      </div>
    </div>
  );
}
