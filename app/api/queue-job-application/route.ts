import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
  try {
    
    const { user_id, job_id } = await req.json();

    if (!user_id || !job_id) {
      return NextResponse.json(
        { error: "user_id and job_id are required" },
        { status: 400 }
      );
    }

    console.log("📝 Queuing job application:", job_id, "for user:", user_id);

    // Use upsert to atomically handle duplicates - safer than check-then-insert
    const { data: queuedJob, error: insertError } = await supabase
      .from("job_queue")
      .upsert({
        user_id,
        job_id,
        status: "pending", // Initial status for sequential processing
        created_at: new Date().toISOString(), // Timestamp for FIFO ordering
      }, { 
        onConflict: "user_id,job_id",
        ignoreDuplicates: false 
      })
      .select()
      .maybeSingle();

    if (insertError) {
      console.error("❌ Error inserting job to queue:", insertError);
      return NextResponse.json(
        { error: "Failed to add job to queue" },
        { status: 500 }
      );
    }

    // If upsert returned null, it means duplicate was ignored
    if (!queuedJob) {
      console.log("⚠️ Job already in queue:", job_id);
      return NextResponse.json(
        { message: "Job already in queue", job_id },
        { status: 200 }
      );
    }

    console.log("✅ Job added to queue:", job_id, "Queue ID:", queuedJob.id);
    
    // Backend will automatically process the queue - no need to trigger anything from frontend

    return NextResponse.json({
      success: true,
      message: "Job added to queue successfully",
      queue_id: queuedJob.id,
      job_id,
    });
  } catch (error) {
    console.error("Error in queue-job-application:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}