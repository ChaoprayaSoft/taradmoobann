import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

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
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <nav className="bg-white shadow-sm sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <div className="flex-shrink-0 font-bold text-2xl text-brand-600">
                TaradMooBann
              </div>
              <div className="flex items-center space-x-4">
                {/* Auth/Profile will go here */}
                <button className="text-gray-500 hover:text-brand-600">Login</button>
              </div>
            </div>
          </nav>
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
