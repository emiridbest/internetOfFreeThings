import { ReactNode } from "react";
import AppProvider from "@/app/providers";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { FreeClaimProvider } from "@/context/FreeClaimProvider";
import BiconomyWrapper from "@/components/BiconomyWrapper";

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  // Remove hooks from server component - they belong in client components
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <AppProvider>
            <BiconomyWrapper>
              <div className="min-h-screen bg-gradient-radial from-white via-gray-50 to-gray-100 dark:from-black dark:via-black dark:to-black">
                <FreeClaimProvider>
                  <Header />
                  <main className="py-6 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-7xl mx-auto">
                      {children}
                    </div>
                  </main>
                  <Toaster />
                  <Footer />
                </FreeClaimProvider>
              </div>
            </BiconomyWrapper>
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}