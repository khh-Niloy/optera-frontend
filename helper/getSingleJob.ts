import { supabase } from "@/lib/supabaseClient";

const getSingleJob = async (jobId: string) => {
  try {
    // 🪝 Step 1: Log the incoming jobId clearly
    console.log("🔹 Received jobId:", jobId);

    if (!jobId || jobId.trim() === '') {
      console.error("❌ Invalid jobId: empty or null");
      return null;
    }

    // 🪝 Step 2: Query Supabase
    const { data, error, status } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle(); // you can also use .single() if you're sure the record exists

    // 🪝 Step 3: Handle errors
    if (error) {
      console.error("❌ Supabase error:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        status,
      });
      return null;
    }

    // 🪝 Step 4: Handle no data found
    if (!data) {
      console.warn(`⚠️ No job found with id: ${jobId}`);
      return null;
    }

    // 🪝 Step 5: Log and return the result
    console.log("✅ Job data found:", data);
    return data;
  } catch (err) {
    // 🪝 Step 6: Catch unexpected runtime errors
    console.error("🚨 Unexpected error in getSingleJob:", err);
    return null;
  }
};

export default getSingleJob;
