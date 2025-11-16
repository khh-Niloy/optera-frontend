import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import cloudinary from "@/lib/Cloudinary";
import { extractAllPdfLinks } from "@/lib/pdfLinkExtractor";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Convert file to buffer and base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Pdf = buffer.toString("base64");

    // Upload to Cloudinary
    const uploadResult = await new Promise<{ secure_url: string }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: "raw", folder: "resumes" },
          (error, result) => {
            if (error) reject(error);
            else if (result) resolve(result);
            else reject(new Error("Upload failed"));
          }
        );
        stream.end(buffer);
      }
    );

    const fileUrl = uploadResult.secure_url;

    // Initialize Gemini client
    const client = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY!,
    });

    const instruction = `
Extract this resume into JSON with fully normalized fields for safe JSX rendering:

- name (string)
- email (string, this is very important, you have to extract the email from the resume, dont use any demo email)
- phone (string)

- skills (array of strings)
- education (array of objects with keys: degree, school, start_year, end_year; use "" if missing)

- work_experience (array of objects with keys: company, title, start, end, description; use "" if missing)

- projects (array of objects with keys: name, description, links; use "" or empty array if missing)
  - links: array of objects with keys: type (string, e.g., "repository", "demo", "live", "frontend", "backend", or any detected type), url (string; "" if missing)

- certifications (array of objects with keys: name, authority, year, link; use "" if missing)

- social_links (array of objects with keys: type (string, e.g., "linkedin", "github", "twitter", "facebook", "instagram", "youtube", "website"), url (string; "" if missing))

Rules:
1. All object keys must match exactly as listed.
2. Use empty strings ("") for missing text fields, and empty arrays ([]) for missing lists.
3. For arrays of objects (education, work_experience, projects, certifications), always include all keys, even if the resume has no data for them.
4. For projects, detect **any and all links**, including frontend, backend, repository, demo, live site, or other relevant links; normalize them into the 'links' array with 'type' (e.g., "repository", "demo", "live", "frontend", "backend") and 'url'.
5. If the resume contains unusual formatting, tables, or non-English text, include as much data as possible; fallback values must still conform to the structure.
6. If the resume contains social links, include them in the social_links array. (important)
7. Return only valid JSON.
`;

    let response;
    try {
      response = await client.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: [
          {
            role: "user",
            parts: [
              { text: instruction },
              {
                inlineData: {
                  data: base64Pdf,
                  mimeType: "application/pdf",
                },
              },
            ],
          },
        ],
      });
    } catch (geminiError) {
      console.error("Gemini API error:", geminiError);
      throw new Error(
        `Gemini API failed: ${
          geminiError instanceof Error ? geminiError.message : "Unknown error"
        }`
      );
    }

    const rawOutput = response.text || "";

    let data;
    try {
      // Remove markdown code blocks if present
      let cleanJson = rawOutput;
      if (cleanJson.includes("```json")) {
        cleanJson = cleanJson.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      }

      data = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error("JSON parsing error:", parseError);
      // fallback: send raw string if JSON parsing fails
      data = { raw: rawOutput, error: "Failed to parse JSON response" };
    }

    // Extract all types of links using our dedicated extractor (Gemini often misses these)
    let extractedLinks = {
      socialLinks: [] as Array<{type: string, url: string}>,
      projectLinks: [] as Array<{type: string, url: string}>,
      portfolioLinks: [] as Array<{type: string, url: string}>
    };
    
    try {
      console.log('🔍 Extracting all links from PDF metadata...');
      extractedLinks = await extractAllPdfLinks(buffer);
      console.log(`📊 PDF Extractor Results:`);
      console.log(`  📱 Social links: ${extractedLinks.socialLinks.length}`);
      console.log(`  🚀 Project links: ${extractedLinks.projectLinks.length}`);
      console.log(`  💼 Portfolio links: ${extractedLinks.portfolioLinks.length}`);
      
      // Log all extracted links
      extractedLinks.socialLinks.forEach((link, i) => {
        console.log(`  📱 ${i + 1}. ${link.type}: "${link.url}"`);
      });
      extractedLinks.projectLinks.forEach((link, i) => {
        console.log(`  🚀 ${i + 1}. ${link.type}: "${link.url}"`);
      });
      extractedLinks.portfolioLinks.forEach((link, i) => {
        console.log(`  💼 ${i + 1}. ${link.type}: "${link.url}"`);
      });
    } catch (linkError) {
      console.error('❌ Links extraction failed:', linkError);
    }

    // Debug Gemini's social links
    console.log('🤖 Gemini Data Analysis:');
    console.log('  - Data type:', typeof data);
    console.log('  - Has error:', data?.error ? 'YES' : 'NO');
    if (data && typeof data === 'object' && !data.error) {
      console.log('  - Has social_links:', data.social_links ? 'YES' : 'NO');
      console.log('  - Social links type:', Array.isArray(data.social_links) ? 'Array' : typeof data.social_links);
      if (Array.isArray(data.social_links)) {
        console.log(`  - Gemini found ${data.social_links.length} social links:`);
        data.social_links.forEach((link: { type?: string; url?: string }, i: number) => {
          console.log(`    🤖 ${i + 1}. Type: "${link?.type || 'undefined'}", URL: "${link?.url || 'undefined'}"`);
        });
      }
    }

    // Merge Gemini results with extracted links (social + project)
    if (data && typeof data === 'object' && !data.error) {
      const geminiSocialLinks = Array.isArray(data.social_links) ? data.social_links : [];
      const geminiProjects = Array.isArray(data.projects) ? data.projects : [];
      
      console.log('🔄 Merging all extracted links...');
      console.log(`  - PDF extractor social links: ${extractedLinks.socialLinks.length}`);
      console.log(`  - PDF extractor project links: ${extractedLinks.projectLinks.length}`);
      console.log(`  - PDF extractor portfolio links: ${extractedLinks.portfolioLinks.length}`);
      console.log(`  - Gemini social links: ${geminiSocialLinks.length}`);
      console.log(`  - Gemini projects: ${geminiProjects.length}`);
      
      // Merge social links
      if (extractedLinks.socialLinks.length > 0) {
        console.log('✅ Using PDF extractor social links (has actual URLs)');
        data.social_links = extractedLinks.socialLinks;
      } else if (geminiSocialLinks.length > 0) {
        console.log('⚠️ Using Gemini social links (PDF extractor found nothing)');
        data.social_links = geminiSocialLinks;
      } else {
        console.log('❌ No social links found by any method');
        data.social_links = [];
      }
      
      // Enhance project links - merge PDF extracted project links with Gemini projects
      if (extractedLinks.projectLinks.length > 0 || extractedLinks.portfolioLinks.length > 0) {
        console.log('🚀 Enhancing projects with extracted links...');
        
        // Combine all project-related links
        const allProjectLinks = [
          ...extractedLinks.projectLinks,
          ...extractedLinks.portfolioLinks
        ];
        
        // If Gemini found projects, enhance them with extracted links
        if (geminiProjects.length > 0) {
          console.log(`🔗 Enhancing ${geminiProjects.length} Gemini projects with ${allProjectLinks.length} extracted links...`);
          
          // Create a copy of available links to distribute
          const availableLinks = [...allProjectLinks];
          
          data.projects = geminiProjects.map((project: { name?: string; links?: Array<{ type?: string; url?: string }> }, projectIndex: number) => {
            console.log(`  📝 Processing project ${projectIndex + 1}: "${project.name}"`);
            
            // Start with existing project links (clean them first)
            let projectLinks: Array<{ type?: string; url?: string }> = [];
            if (project.links && Array.isArray(project.links)) {
              projectLinks = project.links.filter((link: { type?: string; url?: string }) => 
                link && link.url && link.url !== "" && link.url !== "undefined"
              );
            }
            
            console.log(`    🔗 Existing valid links: ${projectLinks.length}`);
            
            // Simply distribute available links to projects evenly
            // Take up to 3-4 links per project to avoid overcrowding
            const linksPerProject = Math.max(1, Math.floor(allProjectLinks.length / geminiProjects.length));
            const maxLinksPerProject = Math.min(4, linksPerProject + 1);
            
            // Take links from the available pool
            let linksToAdd = 0;
            while (linksToAdd < maxLinksPerProject && availableLinks.length > 0) {
              const link = availableLinks.shift(); // Take first available link
              if (link) {
                const alreadyExists = projectLinks.some((existingLink: { type?: string; url?: string }) => 
                  existingLink.url === link.url
                );
                
                if (!alreadyExists) {
                  projectLinks.push(createProjectLink(link));
                  console.log(`      ✅ Added ${link.type}: ${link.url}`);
                  linksToAdd++;
                }
              }
            }
            
            return {
              ...project,
              links: projectLinks
            };
          });
          
          // If there are remaining unmatched links, distribute them or create new projects
          if (availableLinks.length > 0) {
            console.log(`📦 Creating additional projects for ${availableLinks.length} unmatched links...`);
            
            availableLinks.forEach((link, index) => {
              data.projects.push({
                name: `Additional Project ${index + 1}`,
                description: `Project hosted at ${link.url}`,
                links: [createProjectLink(link)]
              });
            });
          }
          
          console.log(`✅ Final result: ${data.projects.length} projects with enhanced links`);
        } else {
          // No Gemini projects found, create projects from extracted links
          console.log('🆕 Creating projects from extracted links...');
          
          data.projects = allProjectLinks.map((link, index) => ({
            name: `Project ${index + 1}`,
            description: `Project hosted at ${link.url}`,
            links: [createProjectLink(link)]
          }));
          
          console.log(`✅ Created ${data.projects.length} projects from extracted links`);
        }
      }
      
      console.log(`🎯 Final results:`);
      console.log(`  📱 Social links: ${data.social_links.length}`);
      console.log(`  🚀 Projects: ${data.projects?.length || 0}`);
      
      data.social_links.forEach((link: { type?: string; url?: string }, i: number) => {
        console.log(`    📱 ${i + 1}. ${link?.type || 'undefined'}: "${link?.url || 'undefined'}"`);
      });
      
      if (data.projects) {
        data.projects.forEach((project: { name?: string; links?: Array<{ type?: string; url?: string }> }, i: number) => {
          console.log(`    🚀 Project ${i + 1}: "${project?.name || 'unnamed'}" (${project?.links?.length || 0} links)`);
          if (project.links) {
            project.links.forEach((link: { type?: string; url?: string }, j: number) => {
              console.log(`      🔗 ${j + 1}. ${link?.type || 'undefined'}: "${link?.url || 'undefined'}"`);
            });
          }
        });
      }
    }

    return NextResponse.json({
      data: data,
      fileUrl: fileUrl,
      // fileBuffer: buffer,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Helper function to create properly formatted project links
function createProjectLink(link: { type: string; url: string }) {
  const linkTypeNames: { [key: string]: string } = {
    'repository': 'Source Code',
    'demo': 'Live Demo',
    'live': 'Live Site',
    'frontend': 'Frontend',
    'backend': 'Backend API',
    'portfolio': 'Portfolio',
    'website': 'Website',
    'github': 'GitHub',
    'gitlab': 'GitLab',
    'bitbucket': 'Bitbucket'
  };
  
  const linkName = linkTypeNames[link.type] || link.type.charAt(0).toUpperCase() + link.type.slice(1);
  
  return {
    name: linkName,
    type: link.type,
    url: link.url
  };
}
