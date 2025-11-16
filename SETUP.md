# Smart Job Applier - Setup Guide

This guide will help you set up the Smart Job Applier project on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js)
- **Git** (for cloning the repository)

## 1. Clone the Repository

```bash
git clone <repository-url>
cd smart-job-applier
```

## 2. Install Dependencies

```bash
npm install
```

This will install all required dependencies including Next.js 15, React 19, TypeScript, Tailwind CSS, and other packages.

## 3. Environment Variables Setup

Create a `.env` file in the root directory of the project:

```bash
touch .env
```

Add the following environment variables to your `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Google AI (Gemini API)
GOOGLE_API_KEY=your_google_ai_api_key

# Cloudinary (File Storage)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Google OAuth (Gmail Integration)
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URL=http://localhost:3000/api/google/auth/callback
```

### How to Get API Keys

#### Supabase
1. Go to [supabase.com](https://supabase.com)
2. Create a new project or use an existing one
3. Go to Project Settings > API
4. Copy the `URL` (for `SUPABASE_URL`)
5. Copy the `anon/public` key (for `SUPABASE_ANON_KEY`)

#### Google AI (Gemini)
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Copy the key (for `GOOGLE_API_KEY`)

#### Cloudinary
1. Go to [cloudinary.com](https://cloudinary.com)
2. Sign up or log in
3. Go to Dashboard
4. Copy `Cloud Name`, `API Key`, and `API Secret`

#### Google OAuth (Gmail)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the Gmail API
4. Go to Credentials > Create Credentials > OAuth 2.0 Client ID
5. Configure OAuth consent screen
6. Add authorized redirect URI: `http://localhost:3000/api/google/auth/callback` (for local development)
7. Copy `Client ID` and `Client Secret`

## 4. Database Setup (Supabase)

You need to create the following tables in your Supabase database:

### `resumes` Table
```sql
CREATE TABLE resumes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  location TEXT,
  summary TEXT,
  skills JSONB,
  education JSONB,
  work_experience JSONB,
  projects JSONB,
  certifications JSONB,
  social_links JSONB,
  resume_storage_url TEXT,
  raw_text TEXT,
  extraction_confidence NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own resumes
CREATE POLICY "Users can view own resume" ON resumes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resume" ON resumes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resume" ON resumes
  FOR UPDATE USING (auth.uid() = user_id);
```

### `jobs` Table
```sql
CREATE TABLE jobs (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid(),
  title TEXT,
  posted_company TEXT,
  logo_upload_path TEXT,
  salary_minimum NUMERIC,
  salary_maximum NUMERIC,
  employment_types TEXT[],
  districts TEXT[],
  address TEXT,
  skills TEXT[],
  new_posting_date TIMESTAMPTZ,
  job_details_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `job_queue` Table
```sql
CREATE TABLE job_queue (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  job_id BIGINT REFERENCES jobs(id) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- Enable Row Level Security
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own queue
CREATE POLICY "Users can view own queue" ON job_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own queue" ON job_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### `user_tokens` Table
```sql
CREATE TABLE user_tokens (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  refresh_token TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own tokens
CREATE POLICY "Users can view own tokens" ON user_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens" ON user_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens" ON user_tokens
  FOR UPDATE USING (auth.uid() = user_id);
```

### `applied_jobs` Table
```sql
CREATE TABLE applied_jobs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  job_id BIGINT REFERENCES jobs(id) NOT NULL,
  direction TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  match_score NUMERIC,
  is_submitted_email BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMPTZ
);

-- Enable Row Level Security
ALTER TABLE applied_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own applied jobs
CREATE POLICY "Users can view own applied jobs" ON applied_jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own applied jobs" ON applied_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

## 5. Run the Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## 6. Build for Production

```bash
npm run build
npm start
```

## 7. Run Linting

```bash
npm run lint
```

## Project Structure

```
smart-job-applier/
├── app/                    # Next.js 15 app directory
│   ├── (auth)/            # Authentication pages (login, register)
│   ├── (main)/            # Protected main pages (home, profile, applied-jobs)
│   └── api/               # API route handlers
├── components/            # React components
│   └── ui/                # Reusable UI components
├── helper/                # Helper functions
├── lib/                   # Core libraries (email, PDF processing)
├── utils/                 # Utility functions and templates
├── CLAUDE.md              # Project documentation for AI
├── .env                   # Environment variables (not committed)
└── package.json           # Dependencies
```

## Features

- **Tinder-style Job Swiping**: Swipe right to apply, left to skip
- **AI-Powered Email Generation**: Personalized application emails using Google Gemini AI
- **Resume Upload & Parsing**: PDF resume extraction with AI
- **Gmail Integration**: Send emails directly through your Gmail account
- **Real-time Notifications**: Get notified when applications are sent
- **Job Queue System**: Sequential processing of job applications

## Authentication Flow

1. Register/Login via Supabase Auth
2. Connect Google account for Gmail sending
3. Upload your resume (PDF format)
4. Start swiping on jobs!

## Important Notes

- Make sure to update `GOOGLE_REDIRECT_URL` to match your deployment URL for production
- The backend worker that processes the job queue is external and not included in this repository
- All API routes use Next.js 15 App Router conventions

## Troubleshooting

### Build Errors
- Ensure you're using Node.js v18 or higher
- Delete `node_modules` and `.next` folder, then run `npm install` again

### Environment Variables Not Loading
- Make sure `.env` file is in the root directory
- Restart the development server after changing `.env`

### Supabase Connection Issues
- Verify your Supabase URL and anon key are correct
- Check if your Supabase project is active

### Gmail OAuth Issues
- Ensure redirect URLs match in Google Cloud Console and `.env`
- Check if Gmail API is enabled in Google Cloud Console

## Support

For issues and questions, please refer to the project documentation in `CLAUDE.md` or contact the development team.

## License

This project is private and proprietary.
