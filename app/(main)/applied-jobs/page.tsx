"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type AppliedRow = {
  id: string;
  user_id: string;
  job_id: string;
  direction: string;
  created_at: string;
  match_score: number;
  is_submitted_email: boolean;
  submitted_at: string;
};

export default function AppliedJobsPage() {
  type JobRow = {
    id: number;
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

  type AppliedWithJob = AppliedRow & {
    job: JobRow | null;
  };

  const [data, setData] = useState<AppliedWithJob[]>([]);

  useEffect(() => {
    const fetchAppliedWithJobs = async () => {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      if (authError || !authData?.user) {
        console.error(authError || new Error("No authenticated user"));
        return;
      }

      // First, get all applied jobs for this user
      const { data: appliedRows, error: appliedError } = await supabase
        .from("applied")
        .select("*")
        .eq("user_id", authData.user.id)
        .order("created_at", { ascending: false });

      if (appliedError) {
        console.error("Error fetching applied jobs:", appliedError);
        return;
      }

      if (!appliedRows || appliedRows.length === 0) {
        setData([]);
        return;
      }

      // Get all unique job IDs
      const jobIds = appliedRows.map((row) => row.job_id);

      // Fetch job details for all job IDs
      const { data: jobRows, error: jobError } = await supabase
        .from("jobs")
        .select("*")
        .in("id", jobIds);

      if (jobError) {
        console.error("Error fetching job details:", jobError);
        return;
      }

      // Manually join the data
      const combined = appliedRows.map((appliedJob) => {
        // job_id is TEXT, could be either id (number) or uuid (string)
        const job = jobRows?.find((j) =>
          j.id.toString() === appliedJob.job_id || j.uuid === appliedJob.job_id
        ) || null;
        return {
          ...appliedJob,
          job,
        } as AppliedWithJob;
      });

      setData(combined);
      console.log("Applied jobs with details:", combined);
    };

    fetchAppliedWithJobs();
  }, []);

  return (
    <div className="w-[85%] mx-auto pb-10 pt-7">
      <div className="grid grid-cols-2 gap-5 mt-7">
        {data.map((job) => (
          <div
            key={job.id}
            className="bg-white rounded-lg border border-gray-300 p-4 space-y-3"
          >
              {/* Company and Position */}
              <div className="space-y-1">
                <h3 className="font-semibold text-black text-sm">
                  {job.job?.posted_company}
                </h3>
                <p className="text-gray-600 text-xs">{job.job?.title}</p>
              </div>

              {/* Address */}
              {job.job?.address && (
                <div className="flex flex-col items-start gap-2">
                  <span className="text-gray-500 text-xs">Address:</span>
                  <p className="text-gray-600 text-xs">{job.job.address}</p>
                </div>
              )}

              {/* Employment Type */}
              {job.job?.employment_types &&
                job.job.employment_types.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs">Type:</span>
                    <div className="flex flex-wrap gap-1 text-xs">
                      {job.job.employment_types.map((type, index) => (
                        <span
                          key={index}
                          className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* Match Score */}
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-xs">Match Score:</span>
                <span className="font-semibold text-black text-sm">
                  {job.match_score}
                </span>
              </div>

              {/* Posting Date */}
              {job.job?.new_posting_date && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-xs">Posted:</span>
                  <span className="text-gray-600 text-xs">
                    {new Date(job.job.new_posting_date).toLocaleDateString()}
                  </span>
                </div>
              )}

              {/* Applied Date */}
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-xs">Applied:</span>
                <span className="text-gray-600 text-xs">
                  {new Date(job.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
        ))}
      </div>

      {data.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">
            No applied jobs yet. Start swiping on jobs to see them here!
          </p>
        </div>
      )}
    </div>
  );
}
