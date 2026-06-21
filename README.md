# Traffic Congestion — Parking Intelligence Prototype

> AI-driven parking violation intelligence dashboard for Bengaluru.  
> **From raw complaints → validated reports → impact scores → hotspot clusters → targeted dispatch.**

---

## 🌟 Live Demo (For Stakeholders)
You don't need to run any code to view the application! The dashboard and AI models are fully deployed in the cloud.
👉 **[View the Live Operations Dashboard](https://traffic-congestion-mauve.vercel.app/)**

---

## 🏗 Architecture

```
Full_stack_website/
├── backend/     FastAPI + Pandas + sklearn (pkl models)
└── frontend/    React + Vite + Tailwind + React-Leaflet
```

## 🚀 Local Development

### Backend

```bash
cd backend
pip install -r requirements.txt

# Place model pkl files in backend/models/:
#   prod_retrain_model_m1.pkl  (gatekeeper ~145MB)
#   prod_retrain_model_m2.pkl  (quantifier ~344MB)

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard: http://localhost:5173

## 🌐 Deployment

### Backend → Hugging Face Spaces
Because the ML models are large (~500MB combined), the backend is deployed on a free Hugging Face Docker Space (16GB RAM).
1. Models are tracked via Git LFS.
2. Space is connected to this GitHub repo and auto-builds from `backend/Dockerfile` (exposed on port 7860).
3. **Live API**: `https://hamzaboy-traffic-parking-intelligence.hf.space`

### Frontend → Vercel
1. The `frontend/` folder is deployed directly to Vercel.
2. It fetches data from the Hugging Face Space. If the backend is asleep, the frontend has a built-in static JSON fallback so it never breaks during a pitch.

## 🤖 3-Stage AI Pipeline

| Stage | Model | Task | Output |
|-------|-------|------|--------|
| 1 | Gatekeeper (Random Forest) | Binary classification | `is_approved` |
| 2 | Impact Quantifier (Random Forest) | Regression | `severity_score` 0–1 |
| 3 | Hotspot Clusterer (DBSCAN) | Spatial clustering | Dispatch zones |
