# 🌍 WeatherSphere — 3D Weather Globe

> Explore real-time weather on a fully interactive 3D globe.

---

## 🚀 Overview

**WeatherSphere** is an immersive 3D weather visualization app powered by **Mapbox GL JS** and the **OpenWeather API**. Users can explore the planet on an interactive 3D globe, hover over countries to see current conditions, search for any location, and view detailed hourly/daily forecasts.

---

## ✨ Features

* 🌍 Interactive 3D Globe (rotate, zoom, tilt via Mapbox GL)
* 🌡️ Real-time weather data via OpenWeather API
* 🗺️ Country highlighting on hover
* 🔍 Location search with Mapbox Geocoding autocomplete
* 📊 Detailed forecast panel (hourly + 5-day)
* 🌌 Space atmosphere with stars and atmospheric haze
* 🎨 Glassmorphism UI with micro-animations
* 📱 Responsive design (desktop + mobile)

---

## 🧠 Tech Stack

### Frontend

* **React 19** — UI framework
* **Mapbox GL JS** — 3D globe rendering with `globe` projection
* **Vite** — Build tooling

### APIs

* **OpenWeather API** — Current weather + 5-day forecast
* **Mapbox Geocoding** — Location search
* **Mapbox Country Boundaries** — Country detection & highlighting

---

## ⚙️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-username/weathersphere.git
cd weathersphere
```

### 2. Setup Frontend

```bash
cd frontend
npm install
```

### 3. Configure API Keys

Copy the environment template and add your keys:

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

```env
# Get your free token at: https://account.mapbox.com/
VITE_MAPBOX_TOKEN=your_mapbox_token_here

# Get your free API key at: https://openweathermap.org/api
VITE_OPENWEATHER_API_KEY=your_openweather_api_key_here
```

### 4. Run Development Server

```bash
npm run dev
```

Open the URL shown in terminal (usually http://localhost:5173).

---

## 📁 Project Structure

```
frontend/src/
├── components/
│   ├── GlobeMap/          # 3D globe (Mapbox GL JS)
│   │   ├── GlobeMap.jsx   # Map initialization & interactions
│   │   ├── GlobeControls.jsx
│   │   └── GlobeMap.css
│   ├── Weather/           # Weather display components
│   │   ├── WeatherPopup.jsx   # Hover tooltip
│   │   ├── WeatherPanel.jsx   # Slide-in forecast panel
│   │   └── Weather.css
│   ├── SearchBar/         # Location search
│   │   ├── SearchBar.jsx
│   │   └── SearchBar.css
│   └── UI/                # Shared UI components
│       ├── LoadingOverlay.jsx
│       ├── ErrorBoundary.jsx
│       └── UI.css
├── services/              # API integration layer
│   ├── weatherService.js  # OpenWeather API (normalized responses)
│   └── geocodeService.js  # Mapbox Geocoding API
├── hooks/                 # Custom React hooks
│   ├── useWeather.js      # Weather fetching + LRU caching
│   └── useDebounce.js     # Generic debounce hook
├── utils/                 # Shared utilities
│   ├── constants.js       # App configuration & constants
│   └── formatters.js      # Temperature, wind, date formatting
├── styles/
│   └── index.css          # Design system (tokens, resets, animations)
├── App.jsx                # Root component (state + composition)
└── main.jsx               # React entry point
```

---

## 🔄 How It Works

1. Mapbox GL JS renders a 3D globe with `projection: 'globe'`
2. Country boundaries from Mapbox's vector tileset enable hover/click detection
3. On hover: country highlights via dynamic layer filters + weather popup
4. On click: slide-in panel fetches detailed forecast from OpenWeather
5. Search: Mapbox Geocoding → globe fly-to animation → weather fetch

---

## 🏗️ Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Mapbox GL JS (no Leaflet) | Native 3D globe projection; Leaflet is 2D only |
| `queryRenderedFeatures` | Replaces manual raycasting/point-in-polygon code |
| Custom hooks | Separates data logic from presentation |
| Services layer | Normalized API responses; easy to swap providers |
| LRU weather cache | Avoids redundant API calls on repeated hovers |
| CSS design tokens | Consistent theming via custom properties |

---

## 🔐 Security

* API keys stored in `.env` (gitignored)
* No secrets exposed in client-side code
* AbortController cancels stale requests
* Error boundaries catch runtime crashes

---

## 🚀 Deployment

* **Frontend** → Vercel / Netlify (set env vars in dashboard)
* Environment variables must be prefixed with `VITE_`

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first.

---

## 📜 License

MIT License

---

## 👨‍💻 Author

Built by **Manjot** 🚀

---

> "Turn data into experience."
