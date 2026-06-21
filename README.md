# Traffic Congestion — Parking Intelligence Prototype

> AI-driven parking violation intelligence dashboard for Bengaluru.  
> **From raw complaints → validated reports → impact scores → hotspot clusters → targeted dispatch.**

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

### Backend → Render

1. Push to GitHub (models are NOT committed — too large for git)
2. On Render: create a Web Service, Docker runtime
3. Add a Persistent Disk at `/app/models` and upload both pkl files
4. Set env var `MODEL_DIR=/app/models`

### Frontend → Vercel

1. Import the `frontend/` folder as a Vercel project
2. Set env var `VITE_API_URL=https://your-backend.onrender.com`
3. Deploy

## 🤖 3-Stage AI Pipeline

| Stage | Model | Task | Output |
|-------|-------|------|--------|
| 1 | Gatekeeper (Random Forest) | Binary classification | `is_approved` |
| 2 | Impact Quantifier (Random Forest) | Regression | `severity_score` 0–1 |
| 3 | Hotspot Clusterer (DBSCAN) | Spatial clustering | Dispatch zones |
