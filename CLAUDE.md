# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Smart Job Applier is a Next.js 15 application that automates job applications through a Tinder-style swipe interface. Users swipe right to queue job applications, and the system automatically sends personalized emails with their resume attached using AI-generated content.

## Common Commands

### Development
```bash
npm run dev          # Start development server with Turbopack
npm run build        # Build for production with Turbopack
npm start            # Start production server
npm run lint         # Run ESLint
```

### Environment Setup
The application requires a `.env` file with the following variables:
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` - Supabase connection
- `GOOGLE_API_KEY` - Gemini AI API key
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` - File storage
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URL` - OAuth for Gmail sending

## Tech Stack

- **Framework**: Next.js 15.5.4 with Turbopack, React 19.1.0, TypeScript 5
- **Styling**: Tailwind CSS 4, Framer Motion, Radix UI components
- **Database**: Supabase (PostgreSQL + Auth with Row Level Security)
- **AI**: Google Gemini AI (gemini-2.5-flash-lite via @google/genai)
- **Cloud Services**: Cloudinary (PDF storage), Gmail OAuth2 (email sending via nodemailer)
- **Key Libraries**: react-tinder-card, pdf-lib, pdf-parse, googleapis, EJS templates
- **Real-time**: Supabase Realtime (postgres_changes subscription)

## Architecture

### Core Application Flow

1. **Authentication & Onboarding**: Users register via Supabase Auth, verify their Google account (OAuth), and upload their resume
2. **Job Discovery**: Main page displays a swipeable card interface (`SwipeCards.tsx`) showing jobs from Supabase `jobs` table
3. **Job Queue System**: Right swipes add jobs to `job_queue` table with `pending` status for sequential processing
4. **Backend Processing**: External backend worker processes the queue, generates personalized emails using Gemini AI, and sends via Gmail OAuth
5. **Real-time Notifications**: Supabase Realtime connection (`useJobNotifications` hook) provides live updates when emails are sent

### Key Data Flow

**Swipe → Queue → Background Processing → Email → Notification**

- Frontend queues jobs via `/api/queue-job-application`
- Backend worker (external, not in this repo) processes queue entries
- Email generation uses Gemini AI with `EmailBodyPrompt.ts` template
- Emails sent via Gmail OAuth with resume attachment
- Supabase Realtime notifies frontend of completion via `applied_jobs` table INSERT

### Route Handlers (app/api/)

- `queue-job-application/route.ts` - Add jobs to processing queue (uses upsert to handle duplicates)
- `job-queue-status/route.ts` - Fetches queue status with job details and summary statistics (used for progress tracking)
- `resume-extract/route.ts` - Extracts structured data from PDF resumes using Gemini AI and custom PDF link parser
- `google/auth/route.ts` - Initiates Google OAuth flow for Gmail sending permissions
- `google/auth/callback/route.ts` - OAuth callback that stores refresh tokens in Supabase `user_tokens` table

### Important Implementation Details

**Email Sending (`lib/sendEmail.ts`)**
- Uses nodemailer with Gmail OAuth2 (not SMTP with password)
- Requires refresh_token and access_token from `user_tokens` table
- Renders email body from EJS template at `utils/template/email.ejs`
- All emails currently sent to hardcoded address: `lintworkspace@gmail.com`
- Uses `server-only` import to prevent client-side execution

**Resume Processing (`app/api/resume-extract/route.ts`)**
- Uploads PDF to Cloudinary first (folder: "resumes")
- Uses Gemini 2.5 Flash Lite model for extraction
- Extracts: name, email, phone, skills, education, work_experience, projects, certifications, social_links
- Custom PDF link extractor (`lib/pdfLinkExtractor.ts`) uses three fallback methods:
  1. Annotation-based extraction (normal PDFs with link annotations)
  2. Text-based regex extraction (Canva/image-based PDFs)
  3. Raw binary search (last resort for edge cases)
- Merges PDF-extracted links with Gemini results (PDF extractor takes precedence for social links)
- Categorizes links into: social (LinkedIn, GitHub, Twitter), project URLs, portfolios
- Returns structured JSON with normalized fields safe for JSX rendering

**Job Queue System**
- Uses Supabase `job_queue` table with upsert on (user_id, job_id) to prevent duplicates
- Backend worker (not in this repo) processes queue sequentially
- Frontend only queues jobs - does not trigger processing
- Queue status is `pending` → `processing` → `completed` (managed by backend)

**Real-time Notifications (`useJobNotifications` hook)**
- Uses Supabase Realtime to listen for INSERT events on `applied_jobs` table
- Channel subscribed on component mount: `supabase.channel('applied-jobs-${userId}')`
- Listens to postgres_changes with filter: `user_id=eq.${userId}`
- When backend inserts row into `applied_jobs`, event fires immediately
- Fetches job details from `jobs` table to get company name
- Shows toast notification: "Email sent to {company_name}!" (4s duration)
- Automatically unsubscribes on component unmount or userId change

### Database Tables (Supabase)

**`resumes`** - User resume data and Cloudinary URL
- Fields: user_id (unique), name, email, phone, location, summary, skills (JSONB array), education (JSONB array), work_experience (JSONB array), projects (JSONB array with links), certifications (JSONB array), social_links (JSONB array with type and url), resume_storage_url, raw_text, extraction_confidence, notes, created_at, updated_at
- Row Level Security enabled - users can only access their own data

**`jobs`** - Job listings
- Key fields: id, uuid, title, posted_company, logo_upload_path, salary_minimum, salary_maximum, employment_types (array), districts, address, skills (array), new_posting_date, job_details_url, email (company contact)
- Fetched on home page, sorted by posting date

**`job_queue`** - Queued applications for processing
- Fields: id, user_id, job_id (FK to jobs.id or jobs.uuid), status ('pending' | 'processing' | 'completed' | 'failed'), created_at, started_at, error_message
- UNIQUE constraint on (user_id, job_id) to prevent duplicate applications
- FIFO ordering by created_at timestamp
- job_id stored as TEXT to support both numeric id and uuid formats

**`user_tokens`** - Google OAuth tokens
- Fields: user_id (primary key), refresh_token, email (Gmail address)
- Used for Gmail OAuth2 authentication when sending emails

**`applied_jobs`** - Application history
- Fields: id, user_id, job_id, direction, created_at, match_score, is_submitted_email, submitted_at
- Shows on /applied-jobs page

### Route Groups

- `(auth)` - Login and register pages (redirects to localhost after auth)
- `(main)` - Protected pages with shared layout (home, profile, applied-jobs)

### Component Structure

**UI Components** (`components/ui/`)
- Reusable components following shadcn/ui patterns
- `file-upload.tsx` - Drag-and-drop resume uploader
- `resizable-navbar.tsx` - Animated navigation bar

**Feature Components**
- `SwipeCards.tsx` - Main job card interface with TinderCard library
  - Checks three conditions before allowing swipes: user logged in, Google verified, resume uploaded
  - Prevents right swipes with `preventSwipe` prop when conditions not met
  - Uses toast notifications for feedback
  - Filters out cards after any swipe direction
  - Touch event handling to prevent vertical dragging (only horizontal swipes allowed)
  - Displays company logo, title, employment type, salary range, address, posting date
- `FloatingBottomNav.tsx` and `TopNavbar.tsx` - Navigation components
- `FileUploadDemo.tsx` - Resume upload interface using react-dropzone (PDF only)

### Helpers (`helper/`)

- `getSingleJob.ts` - Fetch individual job from Supabase
- `getUserInfoFromResume.ts` - Extract user info from resume data
- `updateApplyStatus.ts` - Update job application status
- `getQueueStatus.ts` - Check queue processing status

### AI Integration

**Gemini AI** is used in two places:
1. Resume extraction (`resume-extract/route.ts`) - Structured data extraction from PDFs
2. Email generation (via backend, using `EmailBodyPrompt.ts`) - Personalized email content

The `EmailBodyPrompt` generates two sections: "introduction" and "fitInterestAndWillingnessToLearn"
- Never uses placeholders like [Company Name]
- Returns strict JSON format
- Focuses on authenticity and professionalism

### Path Aliases

`@/*` maps to root directory (configured in `tsconfig.json`)

### Authentication Flow

1. **User registers/logs in** via Supabase Auth (email/password)
2. **Verify Google account** via `/api/google/auth?uid={user_id}`
   - Redirects to Google OAuth consent screen
   - Grants permissions: gmail.send, userinfo.email, userinfo.profile, full mail access
   - Uses `access_type: offline` and `prompt: consent` to force refresh token generation
3. **OAuth callback** (`/api/google/auth/callback`)
   - Exchanges authorization code for tokens (access_token + refresh_token)
   - Fetches Gmail profile to get user's email address
   - Stores `user_id`, `refresh_token`, and `email` in `user_tokens` table (upsert on conflict)
   - Redirects to home page
4. **Upload resume** on `/profile` page
   - PDF sent to `/api/resume-extract`
   - Gemini AI extracts structured data
   - Stored in `resumes` table with Cloudinary URL
5. **Swipe right on jobs** (only allowed after all steps complete)
   - Frontend checks: `user && isVerified && isResumeSubmitted`
   - If any check fails, right-swipe is blocked via `preventSwipe` prop

### Email Template Structure

The EJS template at `utils/template/email.ejs` renders HTML email with the following structure:

**Data passed to template (`emailBody` object):**
```typescript
{
  greeting: string;                    // "Hi {name},"
  introduction: string;                // AI-generated (3-4 sentences, no placeholders)
  technicalSkills: string;             // Comma-separated skill list
  projects: [{
    name: string;
    description: string;
    links: [{ url: string; name: string; type: string; }];
  }];
  experience: [{
    role: string;
    company: string;
    duration: string;                  // "Jan 2020 - Present"
    description: string;
  }];
  fitInterestAndWillingnessToLearn: string;  // AI-generated (3-4 sentences)
  closing: string;                     // "Best regards,"
  myEmail: string;                     // User's email from resume
  phone: string;                       // User's phone from resume
  attachementsAndLinks: [{             // Social links
    type: string;                      // "LinkedIn", "GitHub", etc.
    url: string;
  }];
}
```

**Template sections rendered:**
1. Greeting with candidate name
2. Introduction (AI-generated from EmailBodyPrompt)
3. Technical Skills (comma-separated list)
4. Projects (with clickable anchor tags, opens in new tab)
5. Work Experience (role, company, duration, description)
6. Fit/Interest/Willingness to Learn (AI-generated)
7. Closing
8. Contact Info (email, phone)
9. Social Links (LinkedIn, GitHub, etc. as clickable URLs)

**Important**: All variables escaped by EJS default (`<%= variable %>`). Safe for JSX rendering.

### Critical Implementation Patterns

**Job Queue Duplicate Prevention**
- `/api/queue-job-application` uses Supabase upsert with `onConflict: "user_id,job_id"`
- If duplicate exists, API returns success (idempotent operation)
- UNIQUE constraint at database level prevents race conditions
- Frontend shows "Already in queue" toast if duplicate detected

**Job ID Handling (Dual Format Support)**
- Jobs table has both `id` (BIGINT) and `uuid` (UUID) fields
- `job_queue` and `applied_jobs` store job_id as TEXT to support both formats
- When fetching jobs, compare against both: `j.id.toString() === job_id || j.uuid === job_id`
- Flexible for migration scenarios and mixed usage patterns

**PDF Link Extraction (Three-Method Fallback)**
- Uses `lib/pdfLinkExtractor.ts` with cascading strategies:
  1. **Annotation-based**: Extract from PDF link annotations using pdf-lib (most reliable for standard PDFs)
  2. **Text-based regex**: Apply 30+ URL patterns on extracted text (handles Canva/image-based PDFs)
  3. **Binary search**: Raw buffer pattern matching (last resort for edge cases)
- Categorizes links as: social (LinkedIn, GitHub), project URLs, portfolios
- Merges with Gemini results—PDF extractor takes precedence for social links
- Distributes project links evenly across Gemini-extracted projects

**Resume Data Merging Strategy**
- Gemini AI extracts structured resume data (can miss links)
- PDF extractor finds all URLs with high accuracy
- If PDF finds links: use PDF social_links, distribute project links across Gemini projects
- If PDF finds nothing: fallback to Gemini-extracted links
- Always returns normalized structure safe for JSX rendering

**Touch Event Handling (SwipeCards)**
- Prevents vertical scrolling from triggering card swipes
- Uses three layers:
  1. Native touchmove listener with `passive: false` to call preventDefault()
  2. React synthetic events on card wrapper
  3. CSS: `touchAction: 'pan-x'` (horizontal only)
- Calculates deltaX vs deltaY—blocks swipe if vertical movement dominates
- TinderCard props: `swipeRequirementType="position"`, `swipeThreshold={50}`

**Conditional Swipe Prevention**
- Top card (index 0) blocks right-swipe if user missing requirements
- Uses `preventSwipe` prop: `["up", "down", "right"]` when `!canApply`
- Checks: user logged in, Google verified (`user_tokens` exists), resume uploaded (`resumes` exists)
- UI shows guidance messages directing user to complete missing steps
- All other cards allow horizontal swipes but block vertical

**Component Ref Forwarding (FileUploadDemo)**
- Uses `forwardRef` + `useImperativeHandle` to expose methods:
  - `triggerFileSelect()`: Opens file picker programmatically
  - `reset()`: Clears component state
- Allows parent (profile page) to control child behavior without prop drilling
- Better pattern than state props for imperative actions

**Server-Only Protection**
- `lib/sendEmail.ts` uses `import "server-only"` at top
- Prevents accidental client-side bundling (build error if imported in client component)
- Guards sensitive operations: email sending with OAuth tokens, Cloudinary secrets
- Critical for security—OAuth tokens must never reach browser

**Supabase Realtime Channel Naming**
- Channel name includes userId: `applied-jobs-${userId}`
- Filter also includes userId: `user_id=eq.${userId}`
- Double filtering ensures only relevant events delivered
- Prevents cross-user notification leakage
- Each user gets isolated channel subscription

### Important Notes

**Security & Best Practices**
- `server-only` import used for email sending (prevents client-side execution)
- Row Level Security on all Supabase tables
- OAuth tokens stored securely in database
- Refresh tokens used for persistent email access
- File upload validation (PDF only)

**Current Limitations**
- All emails sent to hardcoded address: `lintworkspace@gmail.com`
- Login/register forms redirect to localhost (not production URL)
- Backend worker for processing queue is external (not in this repo)

**State Management**
- No global state library (uses React hooks and Supabase Auth state)
- SSE for real-time updates
- Local state for UI components
