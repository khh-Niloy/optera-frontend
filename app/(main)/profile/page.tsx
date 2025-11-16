"use client";

import React, { useState, useEffect, useRef } from "react";
import { FileUploadDemo, FileUploadDemoRef } from "@/components/FileUploadDemo";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import getUserInfoFromResume from "@/helper/getUserInfoFromResume";

export interface ResumeData {
  name: string;
  email: string;
  phone: string;
  location: string;
  summary?: string;
  skills: string[];
  education: Array<{
    degree: string;
    school: string;
    start_year: string;
    end_year: string;
  }>;
  work_experience: Array<{
    title: string;
    company: string;
    start: string;
    end: string;
    description: string;
  }>;
  projects: Array<{
    name: string;
    description: string;
    links: Array<{
      type: string;
      url: string;
    }>;
  }>;
  certifications: Array<{
    name: string;
    authority: string;
    year: string;
    link: string;
  }>;
  social_links?: Array<{
    type: string;
    url: string;
  }>;
  extraction_confidence?: number;
  notes?: string;
}

export default function ProfilePage() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ResumeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [savedResume, setSavedResume] = useState<ResumeData | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(
    "Scanning your resume..."
  );
  const [profileLoading, setProfileLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileUploadRef = useRef<FileUploadDemoRef>(null);
  const fileUploadBottomRef = useRef<FileUploadDemoRef>(null);

  const handleUpload = (files: File[]) => {
    if (!files[0]) {
      setUploadedFile(null);
      return;
    }
    // Validate PDF file
    const file = files[0];
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error("Please upload a PDF file only");
      return;
    }
    setUploadedFile(file);
    console.log("File selected:", file.name);
  };

  const handleSubmit = async () => {
    if (!uploadedFile) {
      toast.error("Please upload a resume first!");
      return;
    }

    if (!user) {
      toast.error("Please log in to save your resume data");
      return;
    }

    setLoading(true);

    // Progressive loading messages
    const messages = [
      "Scanning your resume...",
      "Hmm... nice resume!",
      "Extracting skills...",
      "Analyzing experience...",
      "Processing education...",
      "Almost done...",
      "Finalizing results...",
    ];

    let messageIndex = 0;
    setLoadingMessage(messages[0]);

    const messageInterval = setInterval(() => {
      messageIndex++;
      if (messageIndex < messages.length) {
        setLoadingMessage(messages[messageIndex]);
      }
    }, 3000);
    const formData = new FormData();
    formData.append("file", uploadedFile);

    try {
      const res = await fetch("/api/resume-extract", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("/api/resume-extract failed:", errText);
        const isUpdate = !!savedResume;
        toast.error(isUpdate ? "Failed to update resume. Please try again." : "Resume extraction failed");
        clearInterval(messageInterval);
        setLoading(false);
        setLoadingMessage("Scanning your resume...");
        return;
      }

      const { data, fileUrl } = await res.json();
      setResult(data);
      setUploadedFile(null);
      console.log("API Response:", data);
      console.log("File URL:", fileUrl);

      // Save to Supabase
      if (data && !data.error) {
        const isUpdate = !!savedResume;
        const { error: saveError } = await supabase.from("resumes").upsert(
          {
            user_id: user.id,
            name: data.name,
            email: data.email,
            phone: data.phone,
            skills: data.skills,
            education: data.education,
            work_experience: data.work_experience,
            projects: data.projects,
            certifications: data.certifications,
            social_links: data.social_links ?? [],
            resume_storage_url: fileUrl,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        );

        if (saveError) {
          console.error("Error saving to Supabase:", saveError);
          toast.error(isUpdate ? "Failed to update resume. Please try again." : "Failed to save resume data");
        } else {
          toast.success(isUpdate && "Resume updated successfully!");
          setSavedResume(data);
          setUploadedFile(null);
          
          // Clear file upload component after successful update
          if (isUpdate) {
            fileUploadBottomRef.current?.reset();
          } else {
            fileUploadRef.current?.reset();
          }
        }
      } else if (data && data.error) {
        const isUpdate = !!savedResume;
        toast.error(isUpdate ? "Failed to update resume. Please try again." : "Failed to process resume");
      }
    } catch (error) {
      console.error("Error:", error);
      const isUpdate = !!savedResume;
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      toast.error(isUpdate ? `Failed to update resume: ${errorMessage}` : `Failed to process resume: ${errorMessage}`);
    } finally {
      clearInterval(messageInterval);
      setLoading(false);
      setLoadingMessage("Scanning your resume..."); // Reset for next time
    }
  };

  const handleDeleteResume = async () => {
    if (!user) {
      toast.error("Please log in to delete your resume");
      return;
    }

    setIsDeleting(true);
    setShowDeleteModal(false);

    try {
      const { error } = await supabase
        .from("resumes")
        .delete()
        .eq("user_id", user.id);

      if (error) {
        console.error("Error deleting resume:", error);
        toast.error("Failed to delete resume");
        setIsDeleting(false);
        return;
      }

      // Clear all resume-related state
      setSavedResume(null);
      setResult(null);
      setUploadedFile(null);
      
      toast.success("Resume deleted successfully!");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to delete resume");
    } finally {
      setIsDeleting(false);
    }
  };

  // Get current user and load saved resume data
  useEffect(() => {
    const getUser = async () => {
      try {
        setProfileLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user);

        if (user) {
          // Load saved resume data
          const resumeData = await getUserInfoFromResume(user.id);

          if (resumeData) {
            setSavedResume(resumeData);
          }
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setProfileLoading(false);
      }
    };

    getUser();
  }, []);

  const displayData = savedResume || result;
  // console.log(displayData)

  // Show loading screen while profile data is being fetched
  if (profileLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mb-4"></div>
        <p className="text-gray-600 text-lg font-medium">Loading profile...</p>
        <p className="text-gray-400 text-sm mt-2">
          Please wait while we fetch your data
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Delete Resume Button - Show at top when resume exists */}
      {displayData && user && (
        <div className="p-4 max-w-4xl mx-auto">
          <div className="flex justify-start">
            <Button
              size="sm"
              className="bg-red-500 text-white"
              onClick={() => setShowDeleteModal(true)}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Resume"}
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteResume}
        title="Delete Resume"
        message="Are you sure you want to delete your resume? This action cannot be undone and all your resume data will be permanently removed."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />

      {/* Show file upload section at top only if no displayData */}
      {!displayData && (
        <>
          <FileUploadDemo ref={fileUploadRef} onUpload={handleUpload} disabled={!user} loading={loading} />

          <div className="flex justify-center items-center gap-4 mt-6">
            {user ? (
              <>
                {uploadedFile && !loading && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="px-6 border-gray-300"
                    onClick={() => fileUploadRef.current?.triggerFileSelect()}
                    disabled={loading}
                  >
                    Change File
                  </Button>
                )}
                <Button
                  size="lg"
                  className="px-8 bg-black text-white"
                  onClick={handleSubmit}
                  disabled={!uploadedFile || loading}
                >
                  {loading ? loadingMessage : "Submit Resume"}
                </Button>
              </>
            ) : (
              <p className="text-gray-600 text-sm font-medium px-4 py-1.5 bg-red-500/10 text-red-400 border border-red-200 rounded-lg">
                Please sign in first
              </p>
            )}
          </div>
        </>
      )}

      <div className="p-4 max-w-4xl mx-auto">
        {displayData ? (
          <>
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <p>
                    <strong>Name:</strong> {displayData.name}
                  </p>
                  <p>
                    <strong>Email:</strong> {displayData.email}
                  </p>
                  <p>
                    <strong>Phone:</strong> {displayData.phone}
                  </p>
                </div>
                {displayData.social_links &&
                  displayData.social_links.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-600 mb-2">
                        Social Links:
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {displayData.social_links.map((link, index: number) => (
                          <a
                            key={index}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm"
                          >
                            {link.type || link.url}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              {/* Skills */}
              {displayData.skills && displayData.skills.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h2 className="text-xl font-semibold mb-4">Skills</h2>
                  <div className="flex flex-wrap gap-2">
                    {displayData.skills.map((skill: string, index: number) => (
                      <span
                        key={index}
                        className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {displayData.education && displayData.education.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h2 className="text-xl font-semibold mb-4">Education</h2>
                  {displayData.education.map((edu, index: number) => (
                    <div key={index} className="mb-4">
                      <p>
                        <strong>{edu.degree}</strong>
                      </p>
                      <p>{edu.school}</p>
                      <p className="text-gray-600">
                        {edu.start_year} - {edu.end_year}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Work Experience */}
              {displayData.work_experience &&
                displayData.work_experience.length > 0 && (
                  <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4">
                      Work Experience
                    </h2>
                    {displayData.work_experience.map((exp, index: number) => (
                      <div key={index} className="mb-4">
                        <p>
                          <strong>{exp.title}</strong> at {exp.company}
                        </p>
                        <p className="text-gray-600">
                          {exp.start} - {exp.end}
                        </p>
                        <p className="text-gray-700 mt-2">{exp.description}</p>
                      </div>
                    ))}
                  </div>
                )}

              {/* Projects */}
              {displayData.projects && displayData.projects.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h2 className="text-xl font-semibold mb-4">Projects</h2>
                  {displayData.projects.map((project, index: number) => (
                    <div key={index} className="mb-4">
                      <p>
                        <strong>{project.name}</strong>
                      </p>
                      <p className="text-gray-700 mt-2">
                        {project.description}
                      </p>
                      {project.links && project.links.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-medium text-gray-600">
                            Links:
                          </p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {project.links.map((link, linkIndex) => (
                              <a
                                key={linkIndex}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-sm"
                              >
                                {link.type}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Certifications */}
              {displayData.certifications &&
                displayData.certifications.length > 0 && (
                  <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4">
                      Certifications
                    </h2>
                    {displayData.certifications.map((cert, index: number) => (
                      <div key={index} className="mb-4">
                        <p>
                          <strong>{cert.name}</strong>
                        </p>
                        {cert.authority && (
                          <p className="text-gray-600">by {cert.authority}</p>
                        )}
                        {cert.year && (
                          <p className="text-gray-600">Year: {cert.year}</p>
                        )}
                        {cert.link && (
                          <a
                            href={cert.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            View Certificate
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

              {/* File upload section at bottom when displayData exists */}
              <div className="mt-12 pt-8 border-t border-gray-200">
                <h2 className="text-xl font-semibold mb-6 text-center">
                  Update Your Resume
                </h2>
                <FileUploadDemo ref={fileUploadBottomRef} onUpload={handleUpload} disabled={!user} loading={loading} />

                <div className="flex justify-center items-center gap-4 mt-6">
                  {user ? (
                    <>
                      {uploadedFile && !loading && (
                        <Button
                          size="lg"
                          variant="outline"
                          className="px-6 border-gray-300"
                          onClick={() => fileUploadBottomRef.current?.triggerFileSelect()}
                          disabled={loading}
                        >
                          Change File
                        </Button>
                      )}
                      <Button
                        size="lg"
                        className="px-8 bg-black text-white"
                        onClick={handleSubmit}
                        disabled={!uploadedFile || loading}
                      >
                        {loading ? loadingMessage : "Upload Again"}
                      </Button>
                    </>
                  ) : (
                    <p className="text-gray-600 text-lg font-medium">
                      Please log in first
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-3">
            <p className="text-gray-500">
              No resume data available. <br /> Upload a resume to get started!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
