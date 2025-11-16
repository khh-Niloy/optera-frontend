"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

export default function TopNavbar() {
  const [user, setUser] = useState<User | null>(null);
  const [showSignInDropdown, setShowSignInDropdown] = useState(false);
  const [mounted, setMounted] = useState(false);
  // const [email, setEmail] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isVerified, setIsVerified] = useState(false);
  const router = useRouter();
  useEffect(() => {
    setMounted(true);
    getUser();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      if (event === "SIGNED_IN") {
        setShowSignInDropdown(false);
      }
    });

    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowSignInDropdown(false);
      }
    };

    if (showSignInDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSignInDropdown]);

  useEffect(() => {
    const checkUserVerification = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Check if user exists in user_tokens table (Google verified)
        const { data: tokenData, error } = await supabase
          .from("user_tokens")
          .select("user_id")
          .eq("user_id", user.id)
          .single();

        // console.log("tokenData", tokenData);

        setIsVerified(!!tokenData && !error);
      }
    };
    checkUserVerification();
  }, []);

  const getUser = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (!error.message.includes("Auth session missing")) {
        console.error(error);
      }
      setUser(null);
    } else {
      setUser(data.user);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error(error);
    } else {
      setUser(null);
      router.push("/");
    }
  };

  const verifyNow = async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id;
    window.location.href = uid
      ? `/api/google/auth?uid=${encodeURIComponent(uid)}`
      : "/api/google/auth";
  };

  const handleGoogleSignIn = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `https://smart-job-applier.vercel.app/`,
        },
      });
      console.log(data);
      if (error) {
        console.error(error);
      }
    } catch (error) {
      console.error("Error during Google sign in:", error);
    }
  };

  if (!mounted) return null;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-[1200] bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left - Company Name */}
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-gray-600">Optera</h1>
            </div>

            {/* Right - Auth Buttons */}
            <div className="flex items-center gap-3 relative">
              {user ? (
                <>
                  {!isVerified && (
                    <button
                      onClick={verifyNow}
                      className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-bold"
                    >
                      Verify
                    </button>
                  )}

                  <button
                    onClick={handleSignOut}
                    className="px-3 py-2 bg-red-500/90 text-white rounded-lg text-sm font-bold"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowSignInDropdown(!showSignInDropdown)}
                  className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-bold"
                >
                  Sign in
                </button>
              )}

              {/* Sign In Dropdown */}
              {showSignInDropdown && !user && (
                <div
                  ref={dropdownRef}
                  className="absolute top-12 right-0 bg-white rounded-2xl shadow-2xl w-80 p-5 border border-gray-200 z-50"
                >
                  {/* Header */}
                  <div className="flex justify-between items-center mb-3">
                    <button className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium">
                      Sign in
                    </button>
                    <button
                      onClick={() => setShowSignInDropdown(false)}
                      className="text-gray-500 text-sm font-medium"
                    >
                      CLOSE
                    </button>
                  </div>

                  {/* Description */}
                  <p className="text-gray-600 text-sm mb-3 leading-relaxed">
                    Use your email to sync saved contacts across devices.
                  </p>

                  {/* Google Sign In Button */}
                  <button
                    onClick={handleGoogleSignIn}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-full text-gray-700 text-sm font-medium"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Overlay for dropdown background */}
        {showSignInDropdown && (
          <div
            className="fixed inset-0 bg-black/20 z-30"
            onClick={() => setShowSignInDropdown(false)}
          />
        )}
      </nav>
    </>
  );
}
