import NextAuth, { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Here you would typically check if the user exists in your Google Sheet
      // If they don't, you add them.
      // E.g., await syncUserToSheet(user);
      return true;
    },
    async session({ session, token }) {
      // Attach extra information to the session if needed (like Role)
      if (session.user) {
         // session.user.role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin', // Custom signin page we'll create later
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
