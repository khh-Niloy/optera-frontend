"use client";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState, useRef } from "react";
import TinderCard from "react-tinder-card";
import { toast } from "react-hot-toast";
import { User } from "@supabase/supabase-js";
import Image from "next/image";
import { useJobNotifications } from "@/hooks/useJobNotifications";
import Link from "next/link";

type JobRow = {
  id: string;
  uuid: string;
  title: string;
  posted_company: string;
  logo_upload_path: string | null;
  salary_minimum: number | null;
  salary_maximum: number | null;
  salary_type: string | null;
  employment_types: string[] | null;
  districts: string | null;
  address: string | null;
  skills: string[] | null;
  new_posting_date: string | null;
  flexible_work_arrangements: string[] | null;
  status: string | null;
  categories: string | null;
  position_levels: string | null;
  total_number_job_application: number | null;
  job_details_url: string | null;
  email: string | null;
};

export default function SwipeCards() {
  const [data, setData] = useState<JobRow[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isResumeSubmitted, setIsResumeSubmitted] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);

  // Listen for job completion notifications
  useJobNotifications(user?.id || null);

  // Add native event listener to completely block vertical dragging
  useEffect(() => {
    const container = cardContainerRef.current;
    if (!container) return;

    const handleNativeTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

      // Only block if movement is MORE vertical than horizontal
      if (deltaY > deltaX && deltaY > 5) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    container.addEventListener('touchmove', handleNativeTouchMove, { passive: false });

    return () => {
      container.removeEventListener('touchmove', handleNativeTouchMove);
    };
  }, []);
  
  // * 1. fetch jobs from supabase

  useEffect(() => {
    const fetchJobs = async () => {
      const { data: rows, error } = await supabase
        .from("jobs")
        .select("*")
        .order("new_posting_date", { ascending: false });
      if (!error && rows) setData(rows as JobRow[]);
      else if (error) console.error(error);
      console.log("rows", rows);
    };

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

        console.log("tokenData", tokenData);

        setIsVerified(!!tokenData && !error);
      }
    };

    const checkIsUserResumeSubmitted = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: resumeData, error } = await supabase
          .from("resumes")
          .select("*")
          .eq("user_id", user.id)
          .single();
        setIsResumeSubmitted(!!resumeData && !error);
      }
    };

    fetchJobs();
    checkUserVerification();
    checkIsUserResumeSubmitted();

    // Listen for auth state changes (sign in/out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state changed:", event, session?.user?.id);
        setUser(session?.user || null);
        
        if (!session?.user) {
          // User signed out, reset verification states
          setIsVerified(false);
          setIsResumeSubmitted(false);
        } else if (event === 'SIGNED_IN') {
          // User signed in, check their status
          checkUserVerification();
          checkIsUserResumeSubmitted();
        }
      }
    );

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const onSwipe = async (direction: string, jobId: string) => {
    console.log(`swiped ${direction} on ${jobId}`);

    // Remove the card for any successful swipe
    setData((prevData) => prevData.filter((card) => card.id !== jobId));

    if (direction !== "right") return;

    if (!user) {
      toast.error("Please log in to apply to jobs");
      return;
    }

    const applyingToastId = toast.loading("Applying to job...");
    setTimeout(() => {
      toast.dismiss(applyingToastId);
    }, 2000);

    try {
      const response = await fetch("/api/queue-job-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          job_id: jobId,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        if (result.message?.includes("already in queue")) {
          toast("Job already in queue", { duration: 2000 });
        }
      } else {
        toast.error(`Failed to queue job: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error queuing job:", error);
      toast.error("Failed to add job to queue");
    }
  };

  // Add a function to handle blocked swipes
  const handleBlockedSwipe = () => {
    if (!user) {
      // toast.error("Please sign in to apply for jobs");
    } else if (!isVerified) {
      // toast.error("Please verify to apply for jobs");
    } else if (!isResumeSubmitted) {
      // toast.error("Please submit your resume to apply for jobs");
    }
  };

  // Check if user can apply (all three conditions must be met)
  const canApply = user && isVerified && isResumeSubmitted;

  const onCardLeftScreen = (company: string) => {
    console.log(`skipped ${company}`);
  };

  // Touch event handlers to prevent vertical dragging
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

    // Only block if movement is MORE vertical than horizontal
    if (deltaY > deltaX && deltaY > 5) {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      return false;
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
  };

  return (
    <div className="relative w-full mx-auto" ref={cardContainerRef}>
      {/* Status Messages */}
      {!canApply && (
        <>
          {!user || !isVerified ? (
            <p className="fixed top-23 left-1/2 transform -translate-x-1/2 z-50 text-gray-500 text-sm font-medium flex items-center gap-2">
              <span className="inline-block">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="1.1em"
                  height="1.1em"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </span>
              {!user ? "Sign in to apply" : "Verify your account"}
            </p>
          ) : (
            <Link
              href="/profile"
              className="fixed top-23 left-1/2 transform -translate-x-1/2 z-50 group flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-400 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold rounded-full shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer z-60"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="group-hover:scale-110 transition-transform duration-300"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload your resume
            </Link>
          )}
        </>
      )}

      {/* No More Jobs Message */}
      {data.length === 0 && (
        <div className="flex flex-col items-center justify-center h-[400px] text-center px-8">
          <div className="bg-gray-100 rounded-full p-6 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-400"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            All caught up!
          </h3>
          <p className="text-gray-600 text-sm">
            You&apos;ve reviewed all available job cards. Check back later for new opportunities.
          </p>
        </div>
      )}

      {data.map((card, index) => (
        <div
          key={card.id}
          className="absolute w-full transition-all duration-300 ease-out swipe-card-wrapper swipe-card-horizontal-only"
          style={{
            zIndex: data.length - index,
            transform: `translateY(-${index * 10}px) scale(${
              1 - index * 0.02
            })`,
            opacity: index < 3 ? 1 : 0,
            touchAction: 'pan-x',
          }}
          onTouchStartCapture={handleTouchStart}
          onTouchMoveCapture={handleTouchMove}
          onTouchEndCapture={handleTouchEnd}
        >
          <TinderCard
            onSwipe={(dir) => onSwipe(dir, card.id)}
            onCardLeftScreen={() => onCardLeftScreen(card.posted_company)}
            preventSwipe={
              index === 0 && !canApply
                ? ["up", "down", "right"]
                : ["up", "down"]
            }
            swipeRequirementType="position"
            swipeThreshold={50}
          >
            <div
              className={`bg-white ${
                user ? "mt-24" : "mt-22"
              } rounded-2xl border border-gray-300 p-4 h-[380px] w-full relative overflow-hidden transition-transform duration-300 ease-out`}
              style={{ touchAction: 'pan-x' }}
              onTouchStart={(e) => {
                if (index === 0 && !canApply) {
                  const startX = e.touches[0].clientX;

                  const handleTouchMove = (moveEvent: TouchEvent) => {
                    const currentX = moveEvent.touches[0].clientX;
                    const deltaX = currentX - startX;

                    // If user is trying to swipe right (deltaX > 30)
                    if (deltaX > 30) {
                      handleBlockedSwipe();
                      document.removeEventListener(
                        "touchmove",
                        handleTouchMove
                      );
                    }
                  };

                  const handleTouchEnd = () => {
                    document.removeEventListener("touchmove", handleTouchMove);
                    document.removeEventListener("touchend", handleTouchEnd);
                  };

                  document.addEventListener("touchmove", handleTouchMove);
                  document.addEventListener("touchend", handleTouchEnd);
                }
              }}
              onClick={() => {
                if (index === 0 && !canApply) {
                  handleBlockedSwipe();
                }
              }}
            >
              {/* Header Section */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-4">
                  <Image
                    src={card.logo_upload_path || "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=100&h=100&fit=crop&crop=center"}
                    alt={`${card.posted_company} logo`}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                  <div className="flex flex-col">
                    <h2 className="text-lg font-semibold text-black truncate mb-1">
                      {card.posted_company}
                    </h2>
                    <div className="flex items-center gap-2">
                      <p className="text-gray-600 text-sm line-clamp-2 mb-2">
                        {card.title}
                        {card.employment_types &&
                          card.employment_types.length > 0 && (
                            <>
                              {" - "}
                              {card.employment_types.slice(0, 2).join(", ")}
                            </>
                          )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                {card.new_posting_date && (
                  <div className="text-left flex-shrink-0">
                    <p className="text-xs text-gray-400">Posted</p>
                    <p className="text-xs font-medium text-gray-600">
                      {new Date(card.new_posting_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {card.position_levels && (
                  <span className="inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-medium">
                    {card.position_levels}
                  </span>
                )}
              </div>

              {/* Salary Section */}
              {card.salary_minimum && card.salary_maximum && (
                <div className="bg-gray-50 rounded-lg p-2 mb-2 mt-4">
                  <p className="text-xs text-gray-500 mb-1">Salary Range</p>
                  <p className="text-lg font-semibold text-black">
                    ${card.salary_minimum.toLocaleString()} - $
                    {card.salary_maximum.toLocaleString()}
                    {card.salary_type && (
                      <span className="text-sm text-gray-500 font-normal ml-1">
                        / {card.salary_type}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Location */}
              {card.address && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-gray-600 text-sm">address: </span>
                  <p className="text-gray-600 text-xs truncate">
                    {card.address}
                  </p>
                </div>
              )}

              {/* Bottom Action Button */}
              <div className="absolute bottom-6 left-6 right-6">
                {card.job_details_url && (
                  <a
                    href={card.job_details_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-black text-white text-center py-3 rounded-lg font-medium text-sm"
                  >
                    View Full Details →
                  </a>
                )}
              </div>
            </div>
          </TinderCard>
        </div>
      ))}
    </div>
  );
}
