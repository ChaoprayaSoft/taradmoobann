import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import LoginButton from "@/components/LoginButton";
import Link from "next/link";
import CartSidebar from "@/components/CartSidebar";
import ChatWidget from "@/components/ChatWidget";
import NotificationPrompt from "@/components/NotificationPrompt";
import Logo from "@/components/Logo";
import WelcomeModal from "@/components/WelcomeModal";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TaradMooBann",
  description: "Your local neighborhood online market.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-gray-50 flex flex-col">
            <nav className="bg-white shadow-sm sticky top-0 z-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <div className="flex-shrink-0 font-bold text-2xl text-brand-600">
                  <Link href="/" className="flex items-center gap-2 group">
                    <div className="bg-brand-50 p-1.5 rounded-xl group-hover:scale-105 transition-transform duration-300">
                      <Logo />
                    </div>
                    <span className="tracking-tight">TaradMooBann</span>
                  </Link>
                </div>
                <div className="flex items-center space-x-4">
                  <LoginButton />
                </div>
              </div>
            </nav>
            <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
              {children}
            </main>
            <footer className="bg-white border-t border-gray-200 py-6 mt-auto">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
                <p>&copy; {new Date().getFullYear()} ChaoprayaSoft, THAILAND | Contact : tiawongsombat@gmail.com | Tel : 0909739266 | LinID : yok_tiaw</p>
              </div>
            </footer>
            <CartSidebar />
            <ChatWidget />
            <NotificationPrompt />
            <WelcomeModal />
          </div>
        </Providers>
      </body>
    </html>
  );
}
