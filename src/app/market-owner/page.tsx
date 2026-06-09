import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebaseAdmin";
import MarketOwnerDashboardClient from "./MarketOwnerDashboardClient";

export default async function MarketOwnerDashboard() {
  const session = await getServerSession(authOptions);
  
  // Route Protection: Redirect if not logged in or not a market_owner/admin
  const roles = (session?.user as any)?.roles || [];
  if (!session || (!roles.includes("market_owner") && !roles.includes("admin"))) {
    redirect("/");
  }

  const userEmail = session.user?.email || "";

  let markets: any[] = [];
  let shops: any[] = [];
  let memberships: any[] = [];
  
  try {
    const marketSnapshot = await adminDb
      .collection("markets")
      .where("ownerEmail", "==", userEmail)
      .get();
      
    markets = marketSnapshot.docs.map(doc => doc.data());

    if (markets.length > 0) {
      const marketIds = markets.map(m => m.id);
      
      const shopSnapshot = await adminDb
        .collection("shops")
        .where("marketId", "in", marketIds)
        .get();
        
      shops = shopSnapshot.docs.map(doc => doc.data());
      shops.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const membershipSnapshot = await adminDb
        .collection("market_memberships")
        .where("marketId", "in", marketIds)
        .get();
      
      memberships = membershipSnapshot.docs.map(doc => doc.data());
      memberships.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  } catch (error) {
    console.error("Error fetching data for Market Owner Dashboard:", error);
  }

  return <MarketOwnerDashboardClient initialMarkets={markets} initialShops={shops} initialMemberships={memberships} />;
}
