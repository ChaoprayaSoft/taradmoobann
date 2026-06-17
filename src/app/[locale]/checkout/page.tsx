import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebaseAdmin";
import { decryptAddress } from "@/lib/encryption";
import CheckoutClient from "./CheckoutClient";

export default async function CheckoutPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/");
  }

  const userEmail = session.user?.email || "";
  let userAddresses: string[] = [];

  try {
    const userProfileSnapshot = await adminDb.collection("users").doc(userEmail).get();
    if (userProfileSnapshot.exists) {
      const data = userProfileSnapshot.data();
      userAddresses = (data?.addresses || []).map(decryptAddress);
      if (data?.address && userAddresses.length === 0) {
        userAddresses = [data.address]; 
      }
    }
  } catch (error) {
    console.error("Error fetching user addresses for checkout:", error);
  }

  return <CheckoutClient userAddresses={userAddresses} />;
}
