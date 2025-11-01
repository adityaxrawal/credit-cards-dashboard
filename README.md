# Credit Card Dashboard

A comprehensive personal credit card management dashboard for tracking 10+ credit cards, monitoring transactions, managing spending limits, and automated email-based transaction extraction.

## 🎯 Features

- **Multi-Card Management**: Track unlimited credit cards with individual bill dates and due dates
- **Automated Transaction Extraction**: Gmail integration with Pub/Sub for real-time transaction capture
- **Budget Tracking**: Set monthly spending limits with intelligent alerts
- **Analytics & Insights**: Comprehensive spending analytics, trends, and KPIs
- **Bill Reminders**: Automated reminders for upcoming bills and due dates
- **Reward Points Tracking**: Monitor and optimize credit card reward points
- **Statement Upload & OCR**: Upload PDF statements for automatic transaction extraction
- **Recurring Transaction Detection**: Identify and manage subscription payments

## 🏗️ Architecture

### Tech Stack

**Frontend**:

- Next.js 14+ (App Router)
- React 18+ with TypeScript
- Tailwind CSS + shadcn/ui
- React Query for data fetching
- Zustand for state management

**Backend**:

- Node.js 20+ with Express.js
- TypeScript
- Google Cloud Run (Microservices)
- Docker containers

**Database & Cache**:

- Supabase (PostgreSQL) - Free Tier
- Upstash Redis - Free Tier

**Authentication**:

- Google OAuth 2.0
- JWT with refresh tokens
- Redis-backed sessions

**Infrastructure**:

- Frontend: Vercel (Free Tier)
- Backend: Google Cloud Run (Free Tier)
- Email: Gmail API + Pub/Sub
- CI/CD: GitHub Actions

## 📁 Project Structure

```
credit-card-dashboard/
├── frontend/               # Next.js frontend application
├── backend/
│   ├── services/
│   │   ├── api-gateway/   # Main API service
│   │   ├── gmail-service/ # Email processing service
│   │   ├── extraction-service/ # Transaction extraction
│   │   ├── alert-service/ # Alert notifications
│   │   └── analytics-service/ # Analytics computation
│   └── shared/            # Shared utilities and types
├── database/              # Database migrations and seeds
├── docs/                  # Documentation
├── scripts/               # Setup and deployment scripts
└── .github/workflows/     # CI/CD pipelines
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Git
- Google Cloud account (free tier)
- Supabase account (free tier)
- Upstash account (free tier)
- Vercel account (free tier)

### Initial Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd credit-card-dashboard
   ```

2. **Install dependencies**

   ```bash
   # Frontend
   cd frontend && npm install

   # Backend - API Gateway
   cd ../backend/services/api-gateway && npm install

   # Backend - Shared
   cd ../../shared && npm install

   # Database
   cd ../../../database && npm install
   ```

3. **Setup infrastructure**

   Run the setup script to configure GCP, Supabase, and other services:

   ```bash
   chmod +x scripts/setup-infrastructure.sh
   ./scripts/setup-infrastructure.sh
   ```

4. **Configure environment variables**

   The project uses `.env` files for each module (frontend, backend, database). These files are already in place with your credentials configured.

   📖 **Detailed setup instructions**: See [Environment Setup Guide](./docs/ENVIRONMENT_SETUP.md)

5. **Run database migrations**

   ```bash
   cd database
   npm run migrate:up
   ```

6. **Start development servers**

   Terminal 1 - Backend:

   ```bash
   cd backend/services/api-gateway
   npm run dev
   ```

   Terminal 2 - Frontend:

   ```bash
   cd frontend
   npm run dev
   ```

7. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - API Health Check: http://localhost:3001/health

## 📖 Documentation

- [Architecture Documentation](./docs/architecture.md) - Complete system architecture and design
- [Development Phases](./docs/DEVELOPMENT_PHASES.md) - Week-by-week implementation guide
- [Environment Setup Guide](./docs/ENVIRONMENT_SETUP.md) - ✨ **NEW** - Complete environment configuration guide
- [API Documentation](./docs/API.md) - API endpoints and specifications (Coming in Phase 1)
- [Deployment Guide](./docs/DEPLOYMENT.md) - Production deployment instructions (Coming soon)

## 🧪 Testing

### Frontend Tests

```bash
cd frontend
npm test              # Run tests in watch mode
npm run test:ci       # Run tests in CI mode with coverage
```

### Backend Tests

```bash
cd backend/services/api-gateway
npm test              # Run tests in watch mode
npm run test:ci       # Run tests in CI mode with coverage
```

## 🚢 Deployment

### Frontend (Vercel)

```bash
cd frontend
vercel --prod
```

### Backend (Google Cloud Run)

```bash
cd backend/services/api-gateway
gcloud builds submit --tag gcr.io/[PROJECT-ID]/api-gateway
gcloud run deploy api-gateway --image gcr.io/[PROJECT-ID]/api-gateway
```

For detailed deployment instructions, see [Deployment Guide](./docs/DEPLOYMENT.md).

## 🔐 Security

- All API endpoints require JWT authentication
- Row-level security (RLS) enabled on all database tables
- Encrypted Gmail tokens
- CORS configured for frontend domain only
- Helmet.js for security headers
- Input validation with Zod
- Rate limiting on API endpoints

## 🤝 Contributing

This is a personal project, but feedback and suggestions are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 Development Phases

- [x] **Phase 0**: Pre-Development Setup (Week 0)
- [ ] **Phase 1**: Foundation & Core Features (Weeks 1-4)
- [ ] **Phase 2**: Email Integration & Automation (Weeks 5-8)
- [ ] **Phase 3**: Advanced Analytics & Intelligence (Weeks 9-12)
- [ ] **Phase 4**: Enhanced Features & Polish (Weeks 13-14)
- [ ] **Phase 5**: Testing & Launch Preparation (Weeks 15-16)
- [ ] **Phase 6**: Post-Launch & Optimization (Ongoing)

See [DEVELOPMENT_PHASES.md](./docs/DEVELOPMENT_PHASES.md) for detailed phase breakdown.

## 📊 Success Metrics

| Metric                        | Target      | Status |
| ----------------------------- | ----------- | ------ |
| Transaction Auto-Capture Rate | > 95%       | 🔜     |
| Email Processing Accuracy     | > 90%       | 🔜     |
| Alert Delivery Time           | < 5 minutes | 🔜     |
| Dashboard Load Time           | < 2 seconds | 🔜     |
| System Uptime                 | > 99.5%     | 🔜     |

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

Your Name

## 🙏 Acknowledgments

- Supabase for database hosting
- Upstash for Redis caching
- Vercel for frontend hosting
- Google Cloud for backend services

---

**Status**: Phase 0 Complete ✅  
**Next**: Phase 1 - Foundation & Core Features

For questions or support, please open an issue.
