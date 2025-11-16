import { supabase } from "@/lib/supabaseClient";

export const updateApplyStatus = async (id: string) => {
  const { data, error } = await supabase
    .from("applied")
    .update({
      is_submitted_email: true,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select();

  if (error) {
    console.error("Error updating:", error);
    return null;
  }

  console.log("Updated row:", data);
  return data;
};
