import { useEffect } from "react";
import { toast } from "react-hot-toast";
import { supabase } from "@/lib/supabaseClient";

export const useJobNotifications = (userId: string | null) => {
  useEffect(() => {
    console.log("🎯 useJobNotifications hook called with userId:", userId);
    if (!userId) {
      console.log("⚠️ No userId provided, skipping realtime subscription");
      return;
    }

    console.log("🔌 Setting up Supabase Realtime subscription for applied jobs...");

    // Create a channel for this user's job applications
    const channel = supabase
      .channel(`applied-jobs-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'applied',
          filter: `user_id=eq.${userId}`
        },
        async (payload) => {
          console.log("📨 Realtime INSERT event received:", payload);

          // Extract job_id from the inserted row
          const jobId = payload.new.job_id;

          if (!jobId) {
            console.error("⚠️ No job_id in payload");
            return;
          }

          try {
            // Fetch job details to get company name
            console.log("🔍 Fetching job details for job_id:", jobId);
            const { data: job, error } = await supabase
              .from('jobs')
              .select('posted_company, title')
              .eq('id', jobId)
              .single();

            if (error || !job) {
              console.error("❌ Error fetching job details:", error);
              // Fallback toast without company name
              toast.success("Application email sent successfully!", {
                duration: 4000,
                position: "top-center"
              });
              return;
            }

            console.log("✅ Job details found:", job);

            // Show success toast with company name
            toast.success(
              `Email sent to ${job.posted_company}!`,
              {
                duration: 4000,
                position: "top-center"
              }
            );
          } catch (error) {
            console.error("❌ Error handling realtime event:", error);
          }
        }
      )
      .subscribe((status) => {
        console.log("📡 Realtime subscription status:", status);
        if (status === 'SUBSCRIBED') {
          console.log("✅ Successfully subscribed to applied jobs realtime updates");
        } else if (status === 'CHANNEL_ERROR') {
          console.error("❌ Realtime subscription error");
        } else if (status === 'TIMED_OUT') {
          console.error("⏱️ Realtime subscription timed out");
        }
      });

    // Cleanup on unmount or when userId changes
    return () => {
      console.log("🧹 Cleaning up Supabase Realtime subscription for userId:", userId);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return {};
};
