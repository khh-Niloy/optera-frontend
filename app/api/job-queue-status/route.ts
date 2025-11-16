import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(req: NextRequest) {
  try {
    // Extract user_id from URL query parameters for user-specific data
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get("user_id");

    // Validate required parameter to ensure proper data isolation
    if (!user_id) {
      return NextResponse.json(
        { error: "user_id is required" },
        { status: 400 }
      );
    }

    // Join job_queue with jobs table to get enriched job details for UI display
    // Returns newest jobs first for better user experience (recent activity at top)
    const { data: queueJobs, error } = await supabase
      .from("job_queue")
      .select(`
        id,
        job_id,
        status,
        created_at,
        started_at,
        error_message,
        jobs:job_id (
          title,
          postedcompany
        )
      `)
      .eq("user_id", user_id)
      .order("created_at", { ascending: false }); // Recent jobs first

    if (error) {
      console.error("Error fetching job queue status:", error);
      return NextResponse.json(
        { error: "Failed to fetch job queue status" },
        { status: 500 }
      );
    }

    // Calculate status summary for dashboard/progress indicators
    // Uses reduce for efficient single-pass counting across all job statuses
    const queueSummary = queueJobs.reduce(
      (acc, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      },
      // Initialize all status types to 0 for consistent response structure
      { pending: 0, processing: 0, completed: 0, failed: 0 } as Record<string, number>
    );

    // Return both detailed job list and summary counts for flexible frontend usage
    return NextResponse.json({
      success: true,
      queue: queueJobs, // Detailed job list with timestamps and error messages
      summary: queueSummary, // Status counts for progress indicators
      total: queueJobs.length, // Total count for pagination or limits
    });
  } catch (error) {
    console.error("Error in job-queue-status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}