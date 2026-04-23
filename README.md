# 🌍 WeatherSphere — 3D Weather Globe

> Explore real-time weather on a fully interactive 3D Earth.

---

## 🚀 Overview

**WeatherSphere** is an immersive 3D weather visualization app that lets users explore the planet, zoom into regions, and view real-time weather data with smooth interactions and dynamic effects.

It combines the experience of a 3D globe with live weather intelligence — making weather exploration intuitive and engaging.

---

## ✨ Features

* 🌍 Interactive 3D Earth (rotate, zoom, explore)
* 🌡️ Real-time weather data
* 🗺️ Country-level weather insights
* 🏙️ State-level zoom support
* 🔍 Smart search with auto-rotation
* 🌧️ Dynamic weather effects (rain, clouds, lighting)
* ⚡ Smooth animations & transitions

---

## 🧠 Tech Stack

### Frontend

* React.js
* Three.js
* React Three Fiber
* GSAP
* Tailwind CSS

### Backend

* Node.js (Express) / FastAPI

### APIs

* OpenWeatherMap (weather data)
* Mapbox / Google Geocoding (location search)
* GeoJSON (map data)

---

## ⚙️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-username/weathersphere.git
cd weathersphere
```

---

### 2. Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

---

### 3. Setup Backend

```bash
cd backend
npm install
```

Create `.env` file:

```env
WEATHER_API_KEY=your_api_key_here
```

Run server:

```bash
node server.js
```

---

## 🔄 How It Works

1. User interacts with the 3D globe
2. Hover or search a location
3. Backend fetches weather data
4. Data is processed and returned
5. UI updates with weather + animations

---

## 🧱 Architecture

```
Frontend (React + Three.js)
        ↓
Backend API (Node.js / FastAPI)
        ↓
External APIs (Weather + Geo + GeoJSON)
```


---

## 🔐 Security

* API keys stored in `.env`
* No secrets exposed on frontend
* Backend input validation
* Rate limiting (planned)

---

## 🚀 Deployment

* Frontend → Vercel / Netlify
* Backend → Render / Railway / AWS

---

## 🧠 Challenges

* Mapping GeoJSON onto 3D sphere
* Performance optimization
* Smooth animation handling
* API rate limits

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
