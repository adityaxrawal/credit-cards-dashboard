# 💳 Credit Card Dashboard

A modern, real-time credit card management dashboard built with Next.js 15, featuring automatic email parsing, transaction tracking, and CRED-inspired UI design.

## ✨ Features

- ✅ **Automatic Email Parsing** - Parse credit card transactions from Gmail automatically
- ✅ **Real-time Notifications** - Server-Sent Events for instant transaction updates
- ✅ **Google OAuth Integration** - Secure authentication with Gmail API access
- ✅ **Transaction Management** - Track current transactions and statement history
- ✅ **Spending Analytics** - Visual charts and spending breakdowns
- ✅ **Card Management** - Multiple credit card support with perks tracking
- ✅ **Spending Limits** - Set and monitor spending limits with alerts
- ✅ **Statement Processing** - Automatic statement parsing and categorization
- ✅ **Mobile Responsive** - Optimized for all device sizes
- ✅ **Dark Mode Support** - Beautiful glassmorphism UI with dark theme
- ✅ **Background Jobs** - Async email processing with Upstash QStash
- ✅ **Real-time Updates** - Live transaction feeds and notifications

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Utility-first CSS framework
- **Framer Motion** - Smooth animations and transitions
- **Recharts** - Interactive data visualization
- **Lucide React** - Beautiful icon library

### Backend
- **Supabase** - PostgreSQL database with real-time subscriptions
- **Upstash Redis** - Caching and session management
- **Upstash QStash** - Background job processing
- **Gmail API** - Email parsing and integration

### Authentication & Security
- **Supabase Auth** - Google OAuth integration
- **Row Level Security (RLS)** - Database-level security
- **Encrypted Token Storage** - Secure Gmail token management

## 📋 Prerequisites

Before you begin, ensure you have the following:

- **Node.js 18+** and npm/pnpm/yarn
- **Supabase Account** - [Sign up here](https://supabase.com)
- **Google Cloud Project** - [Create one here](https://console.cloud.google.com)
- **Upstash Account** - [Sign up here](https://upstash.com)

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/credit-card-dashboard.git
cd credit-card-dashboard
```

### 2. Install Dependencies

```bash
npm install
# or
pnpm install
# or
yarn install
```

### 3. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to **Settings > API** and copy your project URL and anon key
3. Go to **Settings > Database** and run the SQL migrations from `supabase/migrations/`
4. Enable **Row Level Security** on all tables
5. Set up **Google OAuth** in **Authentication > Providers**

### 4. Configure Google OAuth & Gmail API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the **Gmail API** and **Google+ API**
4. Create **OAuth 2.0 Client ID** credentials:
   - Application type: Web application
   - Authorized origins: `http://localhost:3000` (development)
   - Authorized redirect URIs: `http://localhost:3000/auth/callback`
5. Copy the Client ID and Client Secret

### 5. Set Up Upstash Redis & QStash

1. Create a Redis database at [Upstash Console](https://console.upstash.com)
2. Copy the **REST URL** and **REST Token**
3. Create a QStash queue and copy the **QStash Token**

### 6. Configure Environment Variables

Run the setup script to configure your environment:

```bash
./scripts/setup-env.sh
```

Or manually create `.env.local`:

```env
# Application
NEXT_PUBLIC_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google OAuth & Gmail API
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Upstash
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
QSTASH_TOKEN=your_qstash_token

# Security
ENCRYPTION_KEY=your_32_character_encryption_key
ADMIN_API_KEY=your_admin_api_key
```

### 7. Run Database Migrations

```bash
# If using Supabase CLI
supabase db push

# Or run the SQL files manually in Supabase Dashboard
```

### 8. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 📚 Usage Guide

### Initial Setup

1. **Sign in with Google** - Click "Sign in with Google" to authenticate
2. **Grant Gmail Access** - Allow the app to read your Gmail for transaction parsing
3. **Add Credit Cards** - Navigate to the dashboard and add your credit cards
4. **Set Spending Limits** - Configure spending limits for better financial tracking

### Features Overview

#### Dashboard
- View all your credit cards in one place
- See recent transactions and spending analytics
- Monitor spending limits and alerts

#### Transaction Management
- Automatic parsing of credit card emails
- Manual transaction entry and editing
- Transaction categorization and search

#### Analytics
- Spending breakdown by category
- Monthly spending trends
- Card-wise spending comparison

#### Real-time Updates
- Live transaction notifications
- Real-time spending limit alerts
- Instant email processing updates

## 🚀 Deployment

### Deploy to Vercel

1. **Connect Repository**
   ```bash
   vercel --prod
   ```

2. **Configure Environment Variables**
   - Go to Vercel Dashboard > Project Settings > Environment Variables
   - Add all variables from `.env.production`

3. **Update OAuth Settings**
   - Add your Vercel domain to Google OAuth authorized origins
   - Update `NEXT_PUBLIC_URL` to your production domain

4. **Deploy**
   ```bash
   vercel --prod
   ```

### Build Commands

```bash
# Development
npm run dev

# Production build
npm run build
npm run start

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Bundle analysis
npm run analyze
```

## 📖 API Documentation

For detailed API documentation, see [API.md](./API.md).

### Key Endpoints

- `GET /api/health` - Health check endpoint
- `GET /api/metrics` - System metrics (admin only)
- `POST /api/auth/callback` - OAuth callback handler
- `GET /api/transactions` - Get user transactions
- `POST /api/transactions` - Create new transaction
- `GET /api/cards` - Get user credit cards
- `POST /api/cards` - Add new credit card

## 🔧 Troubleshooting

### Common Issues

#### Gmail API Quota Exceeded
```bash
Error: Gmail API quota exceeded
```
**Solution**: Check your Google Cloud Console quota limits and request an increase if needed.

#### Supabase Connection Issues
```bash
Error: Failed to connect to Supabase
```
**Solution**: Verify your Supabase URL and keys in `.env.local`.

#### Redis Connection Failed
```bash
Error: Redis connection failed
```
**Solution**: Check your Upstash Redis credentials and ensure the database is active.

#### Build Errors
```bash
Error: Type check failed
```
**Solution**: Run `npm run type-check` to identify TypeScript errors.

### Health Check

Visit `/api/health` to check system status:

```bash
curl http://localhost:3000/api/health
```

### Logs

Check application logs:

```bash
# Development
npm run dev

# Production (Vercel)
vercel logs
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Add JSDoc comments for functions and components
- Write tests for new features
- Ensure responsive design
- Follow the existing code style

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org) - The React framework
- [Supabase](https://supabase.com) - Backend as a Service
- [Upstash](https://upstash.com) - Serverless Redis and QStash
- [Tailwind CSS](https://tailwindcss.com) - CSS framework
- [Framer Motion](https://www.framer.com/motion/) - Animation library
- [Recharts](https://recharts.org) - Chart library

## 📞 Support

If you have any questions or need help, please:

1. Check the [troubleshooting section](#-troubleshooting)
2. Search [existing issues](https://github.com/yourusername/credit-card-dashboard/issues)
3. Create a [new issue](https://github.com/yourusername/credit-card-dashboard/issues/new)

---

Made with ❤️ by [Your Name](https://github.com/yourusername)
