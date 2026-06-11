"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";

export default function LanguageSwitcher() {
  const [isPending, startTransition] = useTransition();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLanguageChange = (newLocale: string) => {
    startTransition(() => {
      // Strip the current locale from the pathname to build the new one
      const pathWithoutLocale = pathname.replace(new RegExp(`^/${locale}`), "") || "/";
      router.replace(`/${newLocale}${pathWithoutLocale}`);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        disabled={isPending}
        onClick={() => handleLanguageChange("en")}
        className={`px-2 py-1 text-xs font-bold rounded transition ${locale === "en" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
      >
        EN
      </button>
      <button
        disabled={isPending}
        onClick={() => handleLanguageChange("th")}
        className={`px-2 py-1 text-xs font-bold rounded transition ${locale === "th" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
      >
        TH
      </button>
    </div>
  );
}
