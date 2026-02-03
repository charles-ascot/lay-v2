# CHIMERA Lay Betting App

Enterprise-grade Horse Racing Lay Betting application built on Betfair Exchange API.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CHIMERA Stack                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────────┐          ┌──────────────────┐           │
│   │    Frontend      │          │     Backend      │           │
│   │   React/Vite     │  ───▶    │    FastAPI       │           │
│   │                  │          │                  │           │
│   │ Cloudflare Pages │          │  Cloud Run       │           │
│   └──────────────────┘          └────────┬─────────┘           │
│                                          │                      │
│                                          ▼                      │
│                                 ┌──────────────────┐           │
│                                 │  Betfair API     │           │
│                                 │  Exchange        │           │
│                                 └──────────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology | Deployment |
|-----------|------------|------------|
| Frontend | React 18 + Vite + Tailwind | Cloudflare Pages |
| Backend | Python FastAPI | Google Cloud Run |
| State | Zustand | - |
| API | Betfair JSON-RPC | - |

## Features

- **Real Betfair Exchange Integration** - No mock data
- **Horse Racing WIN Markets** - Filtered market discovery
- **Lay Betting Interface** - Professional trading UI
- **Rate Limiting** - Betfair compliant (5 req/market/sec)
- **Session Management** - 4-hour token with keepAlive
- **Responsive Design** - Dark theme with glass morphism

## Project Structure

```
chimera-lay-app/
├── .github/
│   └── workflows/
│       ├── deploy-backend.yml    # Cloud Run CI/CD
│       └── deploy-frontend.yml   # Cloudflare CI/CD
├── backend/
│   ├── main.py                   # FastAPI application
│   ├── requirements.txt          # Python dependencies
│   ├── Dockerfile                # Cloud Run container
│   └── .dockerignore
├── frontend/
│   ├── src/
│   │   ├── components/           # React components
│   │   ├── services/             # API client
│   │   ├── store/                # Zustand state
│   │   ├── App.jsx               # Main app
│   │   ├── main.jsx              # Entry point
│   │   └── index.css             # Tailwind + custom CSS
│   ├── public/
│   │   ├── chimera.png           # Background image
│   │   ├── favicon.svg
│   │   └── _redirects            # SPA routing
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── .env.example
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+
- Google Cloud CLI (gcloud)
- Betfair Account with API access

### Local Development

1. **Clone and setup backend:**

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set environment variable
export BETFAIR_APP_KEY="JCZbQsjmX87BDsWa"

# Run backend
uvicorn main:app --reload --port 8080
```

2. **Setup frontend:**

```bash
cd frontend
npm install

# Copy environment file
cp .env.example .env.local
# Edit .env.local to set VITE_API_URL=http://localhost:8080

# Add chimera.png to public/ folder

# Run frontend
npm run dev
```

3. **Open browser:** http://localhost:5173

## Deployment

### Google Cloud Run (Backend)

1. **Create Artifact Registry:**

```bash
gcloud artifacts repositories create chimera \
  --repository-format=docker \
  --location=europe-west1 \
  --project=chimera-v4
```

2. **Build and deploy:**

```bash
cd backend

# Build image
gcloud builds submit --tag europe-west1-docker.pkg.dev/chimera-v4/chimera/chimera-lay-backend

# Deploy to Cloud Run
gcloud run deploy chimera-lay-backend \
  --image europe-west1-docker.pkg.dev/chimera-v4/chimera/chimera-lay-backend \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars "BETFAIR_APP_KEY=JCZbQsjmX87BDsWa"
```

3. **Note the service URL** (e.g., https://chimera-lay-backend-xxx-ew.a.run.app)

### Cloudflare Pages (Frontend)

1. **Connect GitHub repository to Cloudflare Pages**

2. **Configure build settings:**
   - Build command: `npm run build`
   - Build output: `dist`
   - Root directory: `frontend`

3. **Set environment variables:**
   - `VITE_API_URL` = Your Cloud Run URL

### GitHub Actions (CI/CD)

Add these secrets to your GitHub repository:

| Secret | Description |
|--------|-------------|
| `GCP_SA_KEY` | Google Cloud service account JSON |
| `BETFAIR_APP_KEY` | Betfair application key |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `BACKEND_URL` | Cloud Run service URL |

## API Endpoints

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Login to Betfair |
| `/api/auth/keepalive` | POST | Extend session |
| `/api/auth/logout` | POST | Terminate session |

### Markets

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/markets/catalogue` | POST | Get race markets |
| `/api/markets/book` | POST | Get prices |

### Orders

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/orders/place` | POST | Place lay bet |
| `/api/orders/cancel` | POST | Cancel order |
| `/api/orders/current` | GET | List orders |

## Betfair API Notes

### Delayed Key Limitations

- Price refresh: 1-60 second intervals
- Price depth: Top 3 levels only
- Volume data: `totalMatched` omitted
- Production: Requires Live Key (£299)

### Bet Sizing Rules

- Minimum stake: £1
- Stakes < £1: Require potential payout ≥ £10
- Example: £0.50 stake at 25.0 odds = £12.50 payout ✓

### Rate Limits

- Max 5 requests per market per second
- Max 100 login attempts per minute
- Session expires after 4 hours

## Environment Variables

### Backend

```env
BETFAIR_APP_KEY=JCZbQsjmX87BDsWa
```

### Frontend

```env
VITE_API_URL=https://chimera-lay-backend-xxx-ew.a.run.app
```

## Security Considerations

- Never commit API keys to repository
- Use GitHub Secrets for CI/CD
- Session tokens stored in sessionStorage (cleared on tab close)
- CORS configured for specific origins only
- Rate limiting prevents API abuse

## License

Proprietary - CHIMERA Project

## Support

Contact: charles@ascotwealth.co.za
