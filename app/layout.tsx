"use client"
import { ReactNode, useEffect } from "react";
import AppProvider from "@/app/providers";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import type { NavbarItem } from "@/components/Navbar";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { FreeClaimProvider } from "@/context/FreeClaimProvider";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";

type Props = {
  children?: React.ReactNode;
  accountId: string;
  appName: string;
  navbarItems: Array<NavbarItem>;
};

export default function RootLayout({
  children,
  accountId,
  appName,
  navbarItems,
}: Props) {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && !authenticated) {
      router.push("/");
    }
  }, [ready, authenticated, router]);
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <AppProvider>
              <div className="min-h-screen bg-gradient-radial from-white via-gray-50 to-gray-100 dark:from-black dark:via-black dark:to-black">
                <FreeClaimProvider>
                  <Navbar accountId={accountId} appName={appName} items={navbarItems} />
                  <main className="py-6 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-7xl mx-auto">
                      {children}
                    </div>
                  </main>
                  <Toaster />
                  <Footer />
                </FreeClaimProvider>
              </div>
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}