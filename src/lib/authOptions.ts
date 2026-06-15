import { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { adminDb } from "@/lib/firebaseAdmin";

export const authOptions: AuthOptions = {
  session: {
    maxAge: 3 * 60 * 60, // 3 hours
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log("NextAuth signIn Triggered for user:", user?.email);
      
      if (!user || !user.email) {
        console.error("No email found in user object!");
        return false;
      }

      try {
        const userRef = adminDb.collection('users').doc(user.email);
        const doc = await userRef.get();

        if (!doc.exists) {
          console.log("Creating new user doc for:", user.email);
          await userRef.set({
            name: user.name || '',
            email: user.email,
            image: user.image || '',
            roles: ["shopper"],
            coins: 50,
            showWelcomeModal: true,
            isActive: true, // Default to true
            createdAt: new Date().toISOString()
          });
          console.log("Successfully created user doc");
        } else {
          const data = doc.data();
          if (data?.isActive === false) {
            console.error("User is inactive and blocked from logging in.");
            return false; // Blocks login
          }
        }
      } catch (error) {
        console.error("Error in NextAuth signIn callback:", error);
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session?.user) {
        // Handle session update from client
        if (session.name) token.name = session.name;
        if (session.user.showWelcomeModal !== undefined) {
          token.showWelcomeModal = session.user.showWelcomeModal;
        }
      }

      // Only hit the database to get roles when a new token is generated (on login)
      if (user && token.email) {
        try {
          const userRef = adminDb.collection('users').doc(token.email);
          const doc = await userRef.get();
          if (doc.exists) {
            const data = doc.data();
            token.roles = data?.roles || ["shopper"];
            token.showWelcomeModal = data?.showWelcomeModal || false;
          } else {
            token.roles = ["shopper"];
            token.showWelcomeModal = false;
          }
        } catch (error) {
          console.error("Error in NextAuth jwt callback:", error);
          token.roles = ["shopper"]; // Default fallback
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).roles = token.roles;
        (session.user as any).showWelcomeModal = token.showWelcomeModal;
      }
      return session;
    },
  },
};
