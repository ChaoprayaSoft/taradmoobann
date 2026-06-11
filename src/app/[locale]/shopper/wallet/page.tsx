import WalletClient from "./WalletClient";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { adminDb } from "@/lib/firebaseAdmin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user?.email) {
    redirect("/auth/signin");
  }

  // Fetch current user coins
  const userDoc = await adminDb.collection("users").doc(session.user.email).get();
  const userData = userDoc.data();
  const currentCoins = userData?.coins || 0;

  return <WalletClient currentCoins={currentCoins} />;
}
