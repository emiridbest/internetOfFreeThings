"use client";
import Portal from "@/components/graphics/portal";
import { useLogin } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useLogin({
    onComplete: () => router.push("/freebies"),
  });

  // Check for authentication on client side
  useEffect(() => {
    // Check if there's a cookie token in the client-side
    const checkAuthStatus = async () => {
      // You can use localStorage or document.cookie to check if the user is authenticated
      const isAuthenticated = document.cookie.includes('privy-token');
      if (isAuthenticated) {
        router.push("/freebies");
      }
    };

    checkAuthStatus();
  }, [router]);

  return (
    <main className="flex min-h-screen min-w-full">
      <div className="flex bg-privy-light-blue flex-1 p-6 justify-center items-center">
        <div>
          <div>
            <Portal style={{ maxWidth: "100%", height: "auto" }} />
          </div>
          <div className="mt-6 flex justify-center text-center">
            <button
              className="bg-violet-600 hover:bg-violet-700 py-3 px-6 text-white rounded-lg"
              onClick={login}
            >
              Log in
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
