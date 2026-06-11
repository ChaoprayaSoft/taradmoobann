"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function HomePageMarketsClient({ 
  markets, 
  marketStatusMapObj, 
  userEmail,
  spotlightProducts 
}: { 
  markets: any[], 
  marketStatusMapObj: Record<string, string>,
  userEmail: string,
  spotlightProducts: any[]
}) {
  const router = useRouter();
  
  // Modals state
  const [requestingMarketId, setRequestingMarketId] = useState<string | null>(null);
  const [applicationNote, setApplicationNote] = useState("");
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [membershipError, setMembershipError] = useState("");
  const [showSignInModal, setShowSignInModal] = useState(false);

  const handleInteraction = (e: React.MouseEvent, marketId: string, action: "enter" | "request") => {
    e.preventDefault();
    
    if (!userEmail) {
      setShowSignInModal(true);
      return;
    }

    if (action === "enter") {
      router.push(`/market/${marketId}`);
    } else if (action === "request") {
      setRequestingMarketId(marketId);
      setApplicationNote("");
    }
  };

  const submitMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestingMarketId) return;

    setMembershipLoading(true);
    setMembershipError("");

    try {
      const res = await fetch("/api/shopper/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: requestingMarketId,
          applicationNote
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to request access");

      setRequestingMarketId(null);
      setApplicationNote("");
      router.refresh();
    } catch (err: any) {
      setMembershipError(err.message);
    } finally {
      setMembershipLoading(false);
    }
  };

  return (
    <>
      {spotlightProducts.length > 0 && (
        <div className="w-full mt-12 mb-12 text-left">
          <div className="flex items-center gap-2 mb-6 px-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-yellow-500">
              <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900">Spotlight Products</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 px-4">
            {spotlightProducts.map(product => {
              const status = product.marketId ? marketStatusMapObj[product.marketId] : null;

              return (
                <div key={product.id} className="bg-white rounded-xl shadow-sm border border-yellow-200 overflow-hidden hover:shadow-md transition relative flex flex-col group">
                  <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full z-10 shadow-sm flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                      <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                    </svg>
                    Spotlight
                  </div>

                  {product.imageUrl || (product.imageUrls && product.imageUrls.length > 0) ? (
                    <img
                      src={product.imageUrl || product.imageUrls[0]}
                      alt={product.name}
                      className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                      onClick={(e) => {
                        if (product.marketId) {
                          if (status === "approved") {
                            handleInteraction(e, product.marketId, "enter");
                          } else if (!status) {
                            handleInteraction(e, product.marketId, "request");
                          }
                        }
                      }}
                    />
                  ) : (
                    <div 
                      className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-gray-200 transition-colors cursor-pointer"
                      onClick={(e) => {
                        if (product.marketId) {
                          if (status === "approved") {
                            handleInteraction(e, product.marketId, "enter");
                          } else if (!status) {
                            handleInteraction(e, product.marketId, "request");
                          }
                        }
                      }}
                    >
                      No Image
                    </div>
                  )}
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-gray-900 line-clamp-1">{product.name}</h3>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mt-0.5">In {product.marketName}</p>
                    <p className="text-brand-600 font-bold mt-1">฿{product.price}</p>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-2 flex-1">{product.description}</p>
                    
                    {product.marketId && (
                      <button 
                        onClick={(e) => {
                          if (status === "approved") {
                            handleInteraction(e, product.marketId, "enter");
                          } else if (!status) {
                            handleInteraction(e, product.marketId, "request");
                          } else {
                            // Needs revision or pending
                            router.push("/shopper");
                          }
                        }}
                        className="mt-3 block text-center text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
                      >
                        {status === "approved" ? "View in Market \u2192" : 
                         status === "pending" ? "Pending Approval" :
                         status === "needs_revision" ? "Needs Revision" :
                         "Request to Enter \u2192"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold text-gray-900 mb-6 px-4">Discover Local Markets</h2>

      {markets.length === 0 ? (
        <div className="text-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-gray-500">No markets have been created yet. Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {markets.map(market => {
            const status = marketStatusMapObj[market.id];

            return (
              <div key={market.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition flex flex-col">
                {status === "approved" ? (
                  <button 
                    onClick={(e) => handleInteraction(e, market.id, "enter")}
                    className="block w-full h-48 overflow-hidden group text-left"
                  >
                    {market.coverImage ? (
                      <img src={market.coverImage} alt={market.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 transition-colors duration-300 group-hover:bg-gray-200">
                        No Image
                      </div>
                    )}
                  </button>
                ) : (
                  <button 
                    onClick={(e) => status ? undefined : handleInteraction(e, market.id, "request")}
                    className={`block w-full h-48 overflow-hidden group text-left relative ${!status ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {!status && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center">
                        <span className="text-white font-medium bg-black/50 px-3 py-1 rounded-full">Click to Request Access</span>
                      </div>
                    )}
                    {market.coverImage ? (
                      <img src={market.coverImage} alt={market.name} className={`w-full h-full object-cover ${!status ? 'transition-transform duration-300 group-hover:scale-105' : ''}`} />
                    ) : (
                      <div className={`w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 ${!status ? 'transition-colors duration-300 group-hover:bg-gray-200' : ''}`}>
                        No Image
                      </div>
                    )}
                  </button>
                )}
                
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-bold text-xl text-gray-900">{market.name}</h3>
                  <p className="text-gray-600 text-sm mt-2 line-clamp-2 flex-1">{market.description}</p>
                  
                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                    <div className="flex items-center gap-1.5" title="Approved Shops">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                      </svg>
                      <span>{market.shopsCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Approved Members">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                      </svg>
                      <span>{market.membersCount || 0}</span>
                    </div>
                  </div>

                  {status === "approved" && (
                    <button 
                      onClick={(e) => handleInteraction(e, market.id, "enter")}
                      className="mt-4 block w-full text-center bg-green-600 text-white font-medium py-2 rounded-md hover:bg-green-700 transition"
                    >
                      Enter Market
                    </button>
                  )}

                  {status === "pending" && (
                    <Link href="/shopper" className="mt-4 block w-full text-center bg-yellow-100 text-yellow-800 font-medium py-2 rounded-md hover:bg-yellow-200 transition">
                      Pending Approval
                    </Link>
                  )}

                  {status === "needs_revision" && (
                    <Link href="/shopper" className="mt-4 block w-full text-center bg-red-100 text-red-800 font-medium py-2 rounded-md hover:bg-red-200 transition">
                      Needs Revision
                    </Link>
                  )}

                  {!status && (
                    <button 
                      onClick={(e) => handleInteraction(e, market.id, "request")}
                      className="mt-4 block w-full text-center bg-brand-50 text-brand-700 font-medium py-2 rounded-md hover:bg-brand-100 transition"
                    >
                      Request to Enter
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* REQUEST MEMBERSHIP MODAL */}
      {requestingMarketId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Request Market Access</h2>
            <p className="text-sm text-gray-500 mb-4">Please provide a brief note to the Market Owner (e.g., your house number or name) to verify your residency.</p>
            
            {membershipError && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm">{membershipError}</div>}
            
            <form onSubmit={submitMembership}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Application Note *</label>
              <textarea
                required
                rows={3}
                placeholder="Hi, I live at House #42..."
                className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-brand-500 focus:border-brand-500 mb-4"
                value={applicationNote}
                onChange={(e) => setApplicationNote(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setRequestingMarketId(null);
                    setApplicationNote("");
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={membershipLoading}
                  className="px-4 py-2 text-sm bg-brand-600 text-white rounded-md hover:bg-brand-700 transition disabled:opacity-50"
                >
                  {membershipLoading ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SIGN IN REQUIRED MODAL */}
      {showSignInModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center relative">
            <button 
              onClick={() => setShowSignInModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-brand-100 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-brand-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Sign In Required</h3>
            <p className="text-sm text-gray-600 mb-6">
              You need to sign in or create an account before you can join a market and start shopping.
            </p>
            <button 
              onClick={() => signIn("google")}
              className="w-full bg-brand-600 text-white font-medium py-2 rounded-md hover:bg-brand-700 transition"
            >
              Sign in with Google
            </button>
          </div>
        </div>
      )}
    </>
  );
}
