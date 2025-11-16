export const getQueueStatus = async (userId: string) => {
  try {
    const response = await fetch(`/api/job-queue-status?user_id=${userId}`);
    
    if (!response.ok) {
      throw new Error("Failed to fetch queue status");
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching queue status:", error);
    return { success: false, error: "Failed to fetch queue status" };
  }
};