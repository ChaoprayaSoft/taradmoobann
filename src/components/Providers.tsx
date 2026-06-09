"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

import { CartProvider } from "./CartProvider";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <CartProvider>
        {children}
      </CartProvider>
    </SessionProvider>
  );
}
