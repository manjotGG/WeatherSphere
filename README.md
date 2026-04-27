# 🌍 WeatherSphere — 3D Weather Globe

> Explore real-time weather on a fully interactive 3D globe, powered by a production-grade backend with distributed rate limiting and load balancing.

---

## ✨ Features

* 🌍 Interactive 3D Globe (rotate, zoom, tilt via Mapbox GL JS)
* 🌡️ Real-time weather data via OpenWeather API
* 🗺️ Country highlighting on hover
* 🔍 Location search with Mapbox Geocoding autocomplete
* 📊 Detailed forecast panel (hourly + 5-day)
* 🌌 Space atmosphere with stars and atmospheric haze
* 🎨 Glassmorphism UI with micro-animations
* 📱 Responsive design (desktop + mobile)
* 🛡️ Production-grade backend with rate limiting & load balancing

---

## 🏗️ Architecture

```
                    ┌─────────────┐
  Client ──────────▶│   Nginx LB  │ (port 80)
                    │  + WAF rules│
                    └──────┬──────┘
                     ┌─────┴─────┐
                     ▼           ▼
              ┌──────────┐ ┌──────────┐
              │ Node #1  │ │ Node #2  │   (Express, port 3001/3002)
              │ API + RL │ │ API + RL │
              └────┬─────┘ └────┬─────┘
                   └──────┬─────┘
                          ▼
                    ┌──────────┐
                    │  Redis   │   (rate limits, cache, circuit state)
                    └──────────┘
```

---

## 🧠 Tech Stack

| Layer | Technologies |
|-------|------------|
| **Frontend** | React 19, Mapbox GL JS, Vite |
| **Backend** | Express 5, ioredis, pino, prom-client |
| **Load Balancer** | Nginx (least-connections, active health checks) |
| **State Store** | Redis 7 (rate limits, cache, circuit breaker) |
| **Containerization** | Docker, Docker Compose |
| **Monitoring** | Prometheus metrics, structured JSON logging |

---

## ⚙️ Quick Start

### Option A: Docker Compose (Recommended)

```bash
# 1. Clone
git clone https://github.com/your-username/weathersphere.git
cd weathersphere

# 2. Configure API keys
cp backend/.env.example backend/.env
# Edit backend/.env — add OPENWEATHER_API_KEY and MAPBOX_TOKEN

cp frontend/.env.example frontend/.env
# Edit frontend/.env — add VITE_MAPBOX_TOKEN

# 3. Build frontend
cd frontend && npm install && npm run build && cd ..

# 4. Start everything (Nginx + 2 backends + Redis)
docker compose up -d

# 5. Open http://localhost
```

### Option B: Development Mode (No Docker)

```bash
# Terminal 1: Start Redis (required for distributed rate limiting)
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Terminal 2: Start backend
cd backend
cp .env.example .env  # Add your API keys
npm install
npm run dev

# Terminal 3: Frontend
cd frontend
cp .env.example .env  # Add VITE_MAPBOX_TOKEN
npm install
npm run dev

# Open http://localhost:5173
```

---

## 📁 Project Structure

```
WeatherSphere/
├── frontend/                        # React + Vite + Mapbox GL JS
│   └── src/
│       ├── components/              # GlobeMap, Weather, SearchBar, UI
│       ├── services/                # Backend API clients (proxied)
│       ├── hooks/                   # useWeather, useDebounce
│       ├── utils/                   # Constants, formatters
│       └── styles/                  # Design system (CSS tokens)
│
├── backend/                         # Express API server
│   └── src/
│       ├── server.js                # Entry point
│       ├── config/                  # Environment-based configuration
│       ├── middleware/
│       │   ├── rateLimiter.js       # Sliding window + token bucket
│       │   ├── circuitBreaker.js    # Upstream API protection
│       │   ├── securityHeaders.js   # Helmet + CORS
│       │   ├── requestValidator.js  # Input validation
│       │   └── requestLogger.js     # Structured logging
│       ├── routes/                  # /api/weather, /api/geocode, /health
│       ├── services/                # API proxies, Redis client
│       ├── lib/                     # Rate limit algorithms, cache
│       └── utils/                   # Logger, Prometheus metrics
│
├── infra/
│   ├── nginx/                       # Load balancer config
│   │   ├── nginx.conf               # Reverse proxy + WAF rules
│   │   └── upstream.conf            # Backend pool definition
│   └── redis/
│       └── redis.conf               # Memory limits, persistence
│
└── docker-compose.yml               # Full orchestration
```

---

## 🛡️ Security & Rate Limiting

### Multi-Layered Rate Limiting

| Layer | Algorithm | Scope | Limit |
|-------|-----------|-------|-------|
| **Nginx** | Leaky bucket | Per IP | 30 req/s burst 20 |
| **Express Global** | Sliding window | Per IP | 100 req/min |
| **Weather API** | Sliding window + token bucket | Per IP + endpoint | 30 req/min, burst 10 |
| **Geocode API** | Sliding window + token bucket | Per IP + endpoint | 20 req/min, burst 10 |

### Security Features

* **API keys server-side only** — never exposed in client bundle
* **Helmet** security headers (CSP, HSTS, X-Frame-Options)
* **CORS** restricted to allowed frontend origins
* **Input validation** — lat/lon ranges, query sanitization
* **Circuit breaker** — prevents cascading failures when upstream APIs are down
* **Request timeouts** — 10s overall, 8s upstream
* **WAF rules** — Nginx blocks suspicious user agents and attack paths

---

## 📊 Monitoring

### Prometheus Metrics

```bash
curl http://localhost:3001/metrics
```

Key metrics:
* `ws_http_requests_total` — Request count by method/route/status
* `ws_http_request_duration_ms` — Latency histogram
* `ws_rate_limited_total` — 429 response count
* `ws_circuit_breaker_state` — 0=closed, 1=open, 2=half-open
* `ws_redis_connected` — Redis connectivity

### Health Checks

```bash
curl http://localhost:3001/health        # Basic liveness
curl http://localhost:3001/health/ready  # Dependency checks (Redis)
curl http://localhost:3001/health/live   # Kubernetes liveness probe
```

---

## 🔧 Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `OPENWEATHER_API_KEY` | **Required.** OpenWeather API key | — |
| `MAPBOX_TOKEN` | **Required.** Mapbox access token | — |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `CORS_ORIGINS` | Allowed frontend origins (comma-sep) | `http://localhost:5173` |
| `LOG_LEVEL` | Logging verbosity | `debug` / `info` (prod) |

### Frontend (`frontend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_MAPBOX_TOKEN` | **Required.** For map tile rendering | — |
| `VITE_API_BASE` | Backend API URL | `http://localhost:3001` |

---

## 🚀 Deployment

### Zero-Downtime Deploy (Docker Compose)

```bash
# Rolling restart — one backend at a time
docker compose up -d --no-deps --build backend_1
# Wait for health check to pass...
docker compose up -d --no-deps --build backend_2
```

### Scaling

Add more backend instances:
1. Duplicate a `backend_N` service block in `docker-compose.yml`
2. Add the new host to `infra/nginx/upstream.conf`
3. `docker compose up -d`

---

## 📜 License

MIT License

---

## 👨‍💻 Author

Built by **Manjot** 🚀
