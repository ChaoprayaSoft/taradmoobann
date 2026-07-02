import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebaseAdmin";
import AdminDashboardClient from "./AdminDashboardClient";

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);
  
  // Route Protection: Redirect if not logged in or not an admin
  const roles = (session?.user as any)?.roles || [];
  if (!session || !roles.includes("admin")) {
    redirect("/");
  }

  // Fetch existing markets on the server side
  let markets: any[] = [];
  let shops: any[] = [];
  let orders: any[] = [];
  let ads: any[] = [];
  let adsSettings: any = { maxAds: 3 };
  let totalUsers: number = 0;
  let initialUsers: any[] = [];
  let feedbacks: any[] = [];
  let initialTermsOfUse: any = null;
  let initialPlatformSettings: any = { isWalletEnabled: true };
  let topups: any[] = [];
  
  try {
    const snapshot = await adminDb.collection("markets").orderBy("createdAt", "desc").get();
    markets = snapshot.docs.map((doc: any) => doc.data());
    
    const shopsSnapshot = await adminDb.collection("shops").get();
    shops = shopsSnapshot.docs.map((doc: any) => doc.data());
    
    const ordersSnapshot = await adminDb.collection("orders").orderBy("createdAt", "desc").get();
    orders = ordersSnapshot.docs.map((doc: any) => doc.data());
    
    const adsSnapshot = await adminDb.collection("ads").orderBy("createdAt", "desc").get();
    ads = adsSnapshot.docs.map((doc: any) => doc.data());
    
    const settingsDoc = await adminDb.collection("settings").doc("ads").get();
    if (settingsDoc.exists) {
      adsSettings = settingsDoc.data();
    }
    
    const usersSnapshot = await adminDb.collection("users").orderBy("createdAt", "desc").get();
    initialUsers = usersSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    totalUsers = initialUsers.length;

    const feedbacksSnap = await adminDb.collection("app_feedback").orderBy("createdAt", "desc").get();
    feedbacks = feedbacksSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    const termsDoc = await adminDb.collection("settings").doc("terms_of_use").get();
    if (termsDoc.exists) {
      initialTermsOfUse = termsDoc.data() || null;
    }

    const platformSettingsDoc = await adminDb.collection("settings").doc("platform").get();
    if (platformSettingsDoc.exists) {
      initialPlatformSettings = { isWalletEnabled: true, ...platformSettingsDoc.data() };
    }
    
    const topupsSnapshot = await adminDb.collection("topups").orderBy("createdAt", "desc").get();
    topups = topupsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

  } catch (error) {
    console.error("Error fetching data for Admin Dashboard:", error);
  }

  return <AdminDashboardClient initialMarkets={markets} initialShops={shops} initialOrders={orders} initialAds={ads} initialAdsSettings={adsSettings} totalUsers={totalUsers} initialUsers={initialUsers} initialFeedbacks={feedbacks} initialTermsOfUse={initialTermsOfUse} initialPlatformSettings={initialPlatformSettings} initialTopups={topups} />;
}
