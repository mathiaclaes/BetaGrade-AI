# BetaGrade AI

**AI-powered bouldering route grader** - Analyze climbing routes from multiple angles to get accurate grade estimations and beta descriptions.

## 🎯 Features

- **Multi-angle Analysis**: Upload 3 photos (front, side, close-up) of a bouldering route
- **AI Grade Estimation**: Uses Google Gemini AI to estimate route difficulty using French Font grading system
- **Beta Generation**: Get detailed descriptions of route characteristics
- **Historical Tracking**: View all previous analyses with Supabase
- **Feedback Loop**: Provide verified grades to improve AI accuracy over time

## 🏗️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite
- **Backend**: Vercel Serverless Functions (Node.js)
- **AI**: Google Gemini 2.0 Flash
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Gemini API key (free at [ai.google.dev](https://ai.google.dev))
- Supabase project (free tier works)

### Setup

1. Clone and install:
```bash
npm install
```

2. Create `.env.local`:
```
VITE_GEMINI_API_KEY=your_gemini_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

3. Run locally:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## 📂 Project Structure

```
src/
├── App.tsx              # Main UI component
├── services/
│   └── geminiService.ts # AI analysis logic
└── types.ts             # TypeScript types

api/
├── routes.ts            # Route CRUD endpoints
├── training-data.ts     # Training data endpoint
└── routes/_supabase.ts  # Supabase client
```

## 🎓 How It Works

1. User uploads 3 images of a climbing route
2. Images are resized for optimal AI processing
3. Gemini analyzes route characteristics (holds, angle, difficulty indicators)
4. AI returns estimated grade (e.g., "6a+") and beta description
5. Data is saved to Supabase for historical tracking
6. User can provide verified grades for AI improvement

## 📊 Live Demo

[beta-grade-ai.vercel.app](https://beta-grade-ai.vercel.app)

## 📄 License

Built from [Google AI Studio Template](https://github.com/google-gemini/aistudio-repository-template)
