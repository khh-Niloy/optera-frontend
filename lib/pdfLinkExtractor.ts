import { PDFDocument } from 'pdf-lib';

export interface SocialLink {
  type: string;
  url: string;
}

export interface ProjectLink {
  type: string;
  url: string;
  category: 'project' | 'social' | 'portfolio';
}

export async function extractPdfLinks(pdfBuffer: Buffer): Promise<SocialLink[]> {
  try {
    console.log('Starting comprehensive PDF links extraction (social + projects)...');
    
    let allLinks: ProjectLink[] = [];
    
    // Method 1: Try annotation-based extraction (works for normal PDFs)
    allLinks = await extractFromAnnotations(pdfBuffer);
    
    if (allLinks.length > 0) {
      console.log(`✅ Method 1 (annotations) found ${allLinks.length} links`);
      return convertToSocialLinks(allLinks);
    }
    
    // Method 2: Try text-based extraction (works for Canva/image-based PDFs)
    console.log('📝 Method 1 failed, trying text extraction...');
    allLinks = await extractFromText(pdfBuffer);
    
    if (allLinks.length > 0) {
      console.log(`✅ Method 2 (text) found ${allLinks.length} links`);
      return convertToSocialLinks(allLinks);
    }
    
    // Method 3: Try raw binary search (last resort)
    console.log('🔍 Method 2 failed, trying raw binary search...');
    allLinks = await extractFromBinary(pdfBuffer);
    
    console.log(`🎯 Final result: ${allLinks.length} total links found`);
    return convertToSocialLinks(allLinks);
    
  } catch (error) {
    console.error('❌ All PDF links extraction methods failed:', error);
    return [];
  }
}

export async function extractAllPdfLinks(pdfBuffer: Buffer): Promise<{
  socialLinks: SocialLink[];
  projectLinks: { type: string; url: string; }[];
  portfolioLinks: { type: string; url: string; }[];
}> {
  try {
    console.log('🔗 Starting comprehensive PDF links extraction for all categories...');
    
    let allLinks: ProjectLink[] = [];
    
    // Use the same multi-method extraction approach
    allLinks = await extractFromAnnotations(pdfBuffer);
    
    if (allLinks.length === 0) {
      allLinks = await extractFromText(pdfBuffer);
    }
    
    if (allLinks.length === 0) {
      allLinks = await extractFromBinary(pdfBuffer);
    }
    
    // Categorize links
    const socialLinks = allLinks
      .filter(link => link.category === 'social')
      .map(link => ({ type: link.type, url: link.url }));
    
    const projectLinks = allLinks
      .filter(link => link.category === 'project')
      .map(link => ({ type: link.type, url: link.url }));
    
    const portfolioLinks = allLinks
      .filter(link => link.category === 'portfolio')
      .map(link => ({ type: link.type, url: link.url }));
    
    console.log(`🎯 Extraction complete:`);
    console.log(`   📱 Social links: ${socialLinks.length}`);
    console.log(`   🚀 Project links: ${projectLinks.length}`);
    console.log(`   💼 Portfolio links: ${portfolioLinks.length}`);
    
    return {
      socialLinks,
      projectLinks,
      portfolioLinks
    };
    
  } catch (error) {
    console.error('❌ All PDF links extraction failed:', error);
    return {
      socialLinks: [],
      projectLinks: [],
      portfolioLinks: []
    };
  }
}

function convertToSocialLinks(projectLinks: ProjectLink[]): SocialLink[] {
  return projectLinks.map(link => ({
    type: link.type,
    url: link.url
  }));
}

async function extractFromAnnotations(pdfBuffer: Buffer): Promise<ProjectLink[]> {
  try {
    console.log('🔗 Trying annotation-based extraction...');
    
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const allLinks: ProjectLink[] = [];
    const pages = pdfDoc.getPages();
    
    console.log(`PDF has ${pages.length} pages`);
    
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];
      const annotations = page.node.Annots();
      
      if (annotations) {
        const annotArray = pdfDoc.context.lookup(annotations);
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (annotArray && 'asArray' in annotArray && typeof (annotArray as any).asArray === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const annotationsArray = (annotArray as any).asArray();
          
          for (let i = 0; i < annotationsArray.length; i++) {
            try {
              const annotRef = annotationsArray[i];
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const annotation = pdfDoc.context.lookup(annotRef as any);
              
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              if (annotation && (annotation as any).has('A')) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const actionRef = (annotation as any).get('A');
                const action = pdfDoc.context.lookup(actionRef);
                
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (action && (action as any).has('URI')) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const uri = (action as any).get('URI');
                  const urlValue = pdfDoc.context.lookup(uri);
                  
                  if (urlValue) {
                    let url = '';
                    
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if (typeof (urlValue as any).asString === 'function') {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      url = (urlValue as any).asString();
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    } else if ((urlValue as any).encodedBytes) {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      url = String.fromCharCode(...(urlValue as any).encodedBytes);
                    }
                    
                    if (url && url.length > 0) {
                      const categorizedLink = categorizeAllLinks(url);
                      if (categorizedLink) {
                        allLinks.push(categorizedLink);
                        console.log(`✅ Found annotation link: ${categorizedLink.type} (${categorizedLink.category}) - ${categorizedLink.url}`);
                      }
                    }
                  }
                }
              }
            } catch {
              // Continue processing
            }
          }
        }
      }
    }
    
    return allLinks;
    
  } catch (error) {
    console.log('❌ Annotation extraction failed:', error instanceof Error ? error.message : error);
    return [];
  }
}

async function extractFromText(pdfBuffer: Buffer): Promise<ProjectLink[]> {
  try {
    console.log('📝 Trying text-based extraction...');
    
    // Use pdf-parse to extract text content
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(pdfBuffer);
    const text = pdfData.text || '';
    
    console.log(`Extracted ${text.length} characters of text`);
    
    if (text.length === 0) {
      console.log('❌ No text extracted from PDF');
      return [];
    }
    
    const allLinks: ProjectLink[] = [];
    
    // Enhanced URL patterns for all types of links
    const urlPatterns = [
      // Social platforms
      { pattern: /https?:\/\/(?:www\.)?github\.com\/[\w.-]+(?:\/[\w.-]+)?/gi, type: 'github' },
      { pattern: /https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w.-]+/gi, type: 'linkedin' },
      { pattern: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[\w.-]+/gi, type: 'twitter' },
      { pattern: /https?:\/\/(?:www\.)?instagram\.com\/[\w.-]+/gi, type: 'instagram' },
      { pattern: /https?:\/\/(?:www\.)?facebook\.com\/[\w.-]+/gi, type: 'facebook' },
      { pattern: /https?:\/\/(?:www\.)?youtube\.com\/[\w.-\/]+/gi, type: 'youtube' },
      { pattern: /https?:\/\/(?:www\.)?youtu\.be\/[\w.-]+/gi, type: 'youtube' },
      
      // Portfolio/Project hosting platforms
      { pattern: /https?:\/\/[\w.-]+\.(?:vercel\.app|netlify\.app|github\.io)(?:\/[\w.-]*)?/gi, type: 'portfolio' },
      { pattern: /https?:\/\/[\w.-]+\.(?:herokuapp\.com|railway\.app|render\.com)(?:\/[\w.-]*)?/gi, type: 'project' },
      { pattern: /https?:\/\/[\w.-]+\.(?:surge\.sh|firebase\.app|web\.app|fly\.dev)(?:\/[\w.-]*)?/gi, type: 'project' },
      { pattern: /https?:\/\/[\w.-]+\.(?:cyclic\.app|deta\.dev|koyeb\.app)(?:\/[\w.-]*)?/gi, type: 'project' },
      
      // Developer platforms
      { pattern: /https?:\/\/(?:www\.)?codeforces\.com\/profile\/[\w.-]+/gi, type: 'codeforces' },
      { pattern: /https?:\/\/(?:www\.)?beecrowd\.com\.br\/[\w.-\/]+/gi, type: 'beecrowd' },
      { pattern: /https?:\/\/(?:judge\.)?beecrowd\.com\/[\w.-\/]+/gi, type: 'beecrowd' },
      { pattern: /https?:\/\/(?:www\.)?leetcode\.com\/[\w.-]+/gi, type: 'leetcode' },
      { pattern: /https?:\/\/(?:www\.)?codepen\.io\/[\w.-]+/gi, type: 'codepen' },
      { pattern: /https?:\/\/(?:www\.)?stackoverflow\.com\/users\/[\w.-\/]+/gi, type: 'stackoverflow' },
      { pattern: /https?:\/\/(?:www\.)?dev\.to\/[\w.-]+/gi, type: 'dev' },
      { pattern: /https?:\/\/(?:www\.)?medium\.com\/[\w.-\/]+/gi, type: 'medium' },
      
      // Project repositories and demos
      { pattern: /https?:\/\/(?:www\.)?github\.com\/[\w.-]+\/[\w.-]+/gi, type: 'repository' },
      { pattern: /https?:\/\/(?:www\.)?gitlab\.com\/[\w.-]+\/[\w.-]+/gi, type: 'repository' },
      { pattern: /https?:\/\/(?:www\.)?bitbucket\.org\/[\w.-]+\/[\w.-]+/gi, type: 'repository' },
      
      // Custom domains and other websites
      { pattern: /https?:\/\/[\w.-]+\.(?:com|org|net|io|dev|tech|app|co|me|xyz|live|site)(?:\/[\w.-\/]*)?/gi, type: 'website' },
      
      // Catch-all for any remaining HTTP/HTTPS links
      { pattern: /https?:\/\/[\w.-]+\.[\w.-]+(?:\/[\w.-\/]*)?/gi, type: 'website' }
    ];
    
    for (const { pattern } of urlPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const url of matches) {
          const cleanUrl = url.trim();
          
          // Avoid duplicates
          if (!allLinks.find(link => link.url === cleanUrl)) {
            const categorizedLink = categorizeAllLinks(cleanUrl);
            if (categorizedLink) {
              allLinks.push(categorizedLink);
              console.log(`✅ Found text link: ${categorizedLink.type} (${categorizedLink.category}) - ${categorizedLink.url}`);
            }
          }
        }
      }
    }
    
    return allLinks;
    
  } catch (error) {
    console.log('❌ Text extraction failed:', error instanceof Error ? error.message : error);
    return [];
  }
}

async function extractFromBinary(pdfBuffer: Buffer): Promise<ProjectLink[]> {
  try {
    console.log('🔍 Trying raw binary search...');
    
    const pdfString = pdfBuffer.toString('binary');
    const allLinks: ProjectLink[] = [];
    
    // Search for URL patterns in raw PDF binary - comprehensive patterns
    const urlPatterns = [
      // Social platforms
      /https?:\/\/(?:www\.)?github\.com\/[\w.-]+/g,
      /https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w.-]+/g,
      /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[\w.-]+/g,
      
      // Project hosting platforms
      /https?:\/\/[\w.-]+\.(?:vercel\.app|netlify\.app|github\.io)/g,
      /https?:\/\/[\w.-]+\.(?:herokuapp\.com|railway\.app|render\.com)/g,
      /https?:\/\/[\w.-]+\.(?:surge\.sh|firebase\.app|web\.app)/g,
      
      // Developer platforms
      /https?:\/\/(?:www\.)?codeforces\.com\/profile\/[\w.-]+/g,
      /https?:\/\/(?:www\.)?beecrowd\.com\.br\/[\w.-\/]+/g,
      /https?:\/\/(?:judge\.)?beecrowd\.com\/[\w.-\/]+/g,
      /https?:\/\/(?:www\.)?leetcode\.com\/[\w.-]+/g,
      /https?:\/\/(?:www\.)?codepen\.io\/[\w.-]+/g,
      
      // Repository platforms
      /https?:\/\/(?:www\.)?github\.com\/[\w.-]+\/[\w.-]+/g,
      /https?:\/\/(?:www\.)?gitlab\.com\/[\w.-]+\/[\w.-]+/g,
      /https?:\/\/(?:www\.)?bitbucket\.org\/[\w.-]+\/[\w.-]+/g,
      
      // General websites
      /https?:\/\/[\w.-]+\.(?:com|org|net|io|dev|tech|app|co|me)/g
    ];
    
    for (const pattern of urlPatterns) {
      const matches = pdfString.match(pattern);
      if (matches) {
        for (const url of matches) {
          const cleanUrl = url.trim();
          
          // Avoid duplicates
          if (!allLinks.find(link => link.url === cleanUrl)) {
            const categorizedLink = categorizeAllLinks(cleanUrl);
            if (categorizedLink) {
              allLinks.push(categorizedLink);
              console.log(`✅ Found binary link: ${categorizedLink.type} (${categorizedLink.category}) - ${categorizedLink.url}`);
            }
          }
        }
      }
    }
    
    return allLinks;
    
  } catch (error) {
    console.log('❌ Binary extraction failed:', error instanceof Error ? error.message : error);
    return [];
  }
}

function categorizeAllLinks(url: string): ProjectLink | null {
  if (!url || typeof url !== 'string') {
    return null;
  }
  
  const cleanUrl = url.trim();
  
  // Filter out incomplete URLs (just domain names without paths)
  const incompleteUrlPatterns = [
    /^https?:\/\/(?:www\.)?github\.com\/?$/,
    /^https?:\/\/(?:www\.)?linkedin\.com\/?$/,
    /^https?:\/\/(?:www\.)?codeforces\.com\/?$/,
    /^https?:\/\/(?:www\.)?beecrowd\.com\.br\/?$/,
    /^https?:\/\/(?:judge\.)?beecrowd\.com\/?$/,
    /^https?:\/\/(?:www\.)?leetcode\.com\/?$/,
    /^https?:\/\/(?:www\.)?twitter\.com\/?$/,
    /^https?:\/\/(?:www\.)?instagram\.com\/?$/,
    /^https?:\/\/(?:www\.)?facebook\.com\/?$/
  ];
  
  for (const pattern of incompleteUrlPatterns) {
    if (pattern.test(cleanUrl)) {
      console.log(`❌ Skipping incomplete URL: ${cleanUrl}`);
      return null;
    }
  }
  
  // Check for URLs that are likely incomplete (too short and no path)
  try {
    const urlObj = new URL(cleanUrl);
    if (urlObj.pathname === '/' && urlObj.search === '' && urlObj.hash === '') {
      // This is just a domain with no path - likely incomplete
      console.log(`❌ Skipping domain-only URL: ${cleanUrl}`);
      return null;
    }
  } catch {
    // Invalid URL format, skip it
    console.log(`❌ Skipping invalid URL: ${cleanUrl}`);
    return null;
  }
  
  // Social Media Platforms
  if (cleanUrl.includes('linkedin.com')) {
    return { type: 'linkedin', url: cleanUrl, category: 'social' };
  }
  
  if (cleanUrl.includes('twitter.com') || cleanUrl.includes('x.com')) {
    return { type: 'twitter', url: cleanUrl, category: 'social' };
  }
  
  if (cleanUrl.includes('instagram.com')) {
    return { type: 'instagram', url: cleanUrl, category: 'social' };
  }
  
  if (cleanUrl.includes('facebook.com')) {
    return { type: 'facebook', url: cleanUrl, category: 'social' };
  }
  
  if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
    return { type: 'youtube', url: cleanUrl, category: 'social' };
  }
  
  // Developer/Coding Platforms (Social category)
  if (cleanUrl.includes('stackoverflow.com')) {
    return { type: 'stackoverflow', url: cleanUrl, category: 'social' };
  }
  
  if (cleanUrl.includes('medium.com')) {
    return { type: 'medium', url: cleanUrl, category: 'social' };
  }
  
  if (cleanUrl.includes('dev.to')) {
    return { type: 'dev', url: cleanUrl, category: 'social' };
  }
  
  if (cleanUrl.includes('codeforces.com')) {
    return { type: 'codeforces', url: cleanUrl, category: 'social' };
  }
  
  if (cleanUrl.includes('beecrowd.com.br') || cleanUrl.includes('judge.beecrowd.com')) {
    return { type: 'beecrowd', url: cleanUrl, category: 'social' };
  }
  
  if (cleanUrl.includes('leetcode.com')) {
    return { type: 'leetcode', url: cleanUrl, category: 'social' };
  }
  
  if (cleanUrl.includes('codepen.io')) {
    return { type: 'codepen', url: cleanUrl, category: 'social' };
  }
  
  // GitHub - Special handling for repositories vs profiles
  if (cleanUrl.includes('github.com')) {
    // Check if it's a repository (has two parts after github.com)
    const githubPathMatch = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (githubPathMatch && githubPathMatch[2] && githubPathMatch[2] !== '') {
      return { type: 'repository', url: cleanUrl, category: 'project' };
    } else {
      return { type: 'github', url: cleanUrl, category: 'social' };
    }
  }
  
  // Other Repository Platforms
  if (cleanUrl.includes('gitlab.com')) {
    const gitlabPathMatch = cleanUrl.match(/gitlab\.com\/([^\/]+)\/([^\/]+)/);
    if (gitlabPathMatch && gitlabPathMatch[2]) {
      return { type: 'repository', url: cleanUrl, category: 'project' };
    } else {
      return { type: 'gitlab', url: cleanUrl, category: 'social' };
    }
  }
  
  if (cleanUrl.includes('bitbucket.org')) {
    const bitbucketPathMatch = cleanUrl.match(/bitbucket\.org\/([^\/]+)\/([^\/]+)/);
    if (bitbucketPathMatch && bitbucketPathMatch[2]) {
      return { type: 'repository', url: cleanUrl, category: 'project' };
    } else {
      return { type: 'bitbucket', url: cleanUrl, category: 'social' };
    }
  }
  
  // Project Hosting Platforms
  if (cleanUrl.includes('vercel.app')) {
    return { type: 'demo', url: cleanUrl, category: 'project' };
  }
  
  if (cleanUrl.includes('netlify.app')) {
    return { type: 'demo', url: cleanUrl, category: 'project' };
  }
  
  if (cleanUrl.includes('github.io')) {
    return { type: 'demo', url: cleanUrl, category: 'project' };
  }
  
  if (cleanUrl.includes('herokuapp.com')) {
    return { type: 'demo', url: cleanUrl, category: 'project' };
  }
  
  if (cleanUrl.includes('railway.app')) {
    return { type: 'demo', url: cleanUrl, category: 'project' };
  }
  
  if (cleanUrl.includes('render.com')) {
    return { type: 'demo', url: cleanUrl, category: 'project' };
  }
  
  if (cleanUrl.includes('surge.sh')) {
    return { type: 'demo', url: cleanUrl, category: 'project' };
  }
  
  if (cleanUrl.includes('firebase.app') || cleanUrl.includes('web.app')) {
    return { type: 'demo', url: cleanUrl, category: 'project' };
  }
  
  if (cleanUrl.includes('fly.dev') || 
      cleanUrl.includes('cyclic.app') || 
      cleanUrl.includes('deta.dev') || 
      cleanUrl.includes('koyeb.app')) {
    return { type: 'demo', url: cleanUrl, category: 'project' };
  }
  
  // Portfolio/Personal Websites (common domains that are likely portfolios)
  if (cleanUrl.includes('.dev') || 
      cleanUrl.includes('.tech') || 
      cleanUrl.includes('.me') ||
      cleanUrl.includes('.io') && !cleanUrl.includes('github.io')) {
    return { type: 'portfolio', url: cleanUrl, category: 'portfolio' };
  }
  
  // Generic website classification
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    // Try to determine if it's likely a project vs portfolio vs other
    const domain = cleanUrl.toLowerCase();
    
    // Common project/demo indicators
    if (domain.includes('demo') || 
        domain.includes('app') || 
        domain.includes('project') ||
        domain.includes('live')) {
      return { type: 'demo', url: cleanUrl, category: 'project' };
    }
    
    // Common portfolio indicators
    if (domain.includes('portfolio') || 
        domain.includes('resume') ||
        domain.includes('cv') ||
        domain.includes('about')) {
      return { type: 'portfolio', url: cleanUrl, category: 'portfolio' };
    }
    
    // Default to website
    return { type: 'website', url: cleanUrl, category: 'portfolio' };
  }
  
  return null;
}

// Keep the old function for backward compatibility if needed
// function categorizeSocialLink(url: string): SocialLink | null {
//   const projectLink = categorizeAllLinks(url);
//   if (projectLink) {
//     return { type: projectLink.type, url: projectLink.url };
//   }
//   return null;
// }