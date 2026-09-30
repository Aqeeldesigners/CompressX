# Compress-X Studio — Next-Gen High-Fidelity Media Optimizer

A high-performance, privacy-first web platform for batch image compression, PDF optimization, format conversion, and intelligent media processing.

## 🌟 Key Features

- **100% Client-Side Privacy**: High-speed multi-threaded Web Workers compress images inside the user's browser without uploading private media to third-party servers.
- **Modern Clean Architecture**: Express.js REST API with automated Vercel Serverless routing.
- **Supabase Cloud Ready**: Seamless PostgreSQL database integration for Auth, Profiles, Contact Inquiries, and Pro Subscriptions.
- **Clean URLs**: Professional URL routing (`/`, `/admin`, `/api/...`) with no ugly `.html` extensions.
- **PWA & Offline Ready**: Service worker integration for fast caching and offline reliability.

## 🚀 Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Configure Environment Variables
# Copy .env.example to .env and insert your Supabase credentials
cp .env.example .env

# 3. Start local development server
npm start
```

## ☁️ Deployment on Vercel

1. Push your repository to GitHub.
2. Import the repository in [Vercel](https://vercel.com).
3. In **Project Settings ➔ Environment Variables**, add:
   - `SUPABASE_URL`: Your Supabase Project URL
   - `SUPABASE_ANON_KEY`: Your Supabase Anon Public Key
   - `SUPABASE_SERVICE_ROLE_KEY`: (Optional) Your Supabase Service Role Key
4. Click **Deploy**. Vercel will automatically build and host your production-grade application with clean URLs.

## 🛡️ License
MIT License
