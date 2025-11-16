import { supabase } from "@/lib/supabaseClient";

const getUserInfoFromResume = async (userId: string) => {
    const { data: resumeData, error } = await supabase
          .from('resumes')
          .select('*')
          .eq('user_id', userId)
          .single();
    return resumeData;
}

export default getUserInfoFromResume;