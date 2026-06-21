"""
FastAPI Application — Parking Intelligence Backend
Serves the 3-stage ML cascade results to the React frontend.
"""
import logging
import math
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from app.data_loader import load_and_process, state, _engineer_features, _label_encode, _parse_json_array
from app.schemas import SimulateRequest, SimulateResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load and process all data at startup."""
    load_and_process()
    yield


app = FastAPI(
    title="Parking Intelligence API",
    description="AI-driven parking intelligence: 3-stage cascade (Gatekeeper → Impact Quantifier → Hotspot Clusterer)",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "m1_gatekeeper_loaded": state.m1_loaded,
        "m2_quantifier_loaded": state.m2_loaded,
        "total_reports": len(state.scored_df) if state.scored_df is not None else 0,
        "num_clusters": len(state.clusters),
    }


@app.get("/api/reports")
def get_reports(
    approved_only: bool = Query(True, description="Return only approved violations"),
    hour_min: int = Query(0, ge=0, le=23),
    hour_max: int = Query(23, ge=0, le=23),
    limit: int = Query(2000, ge=1, le=5000),
):
    """Return individual violation markers for the map."""
    import math as _math
    df = state.scored_df
    if df is None:
        return []

    mask = (df["hour"] >= hour_min) & (df["hour"] <= hour_max)
    if approved_only:
        mask &= df["is_approved"] == 1

    filtered = df[mask].head(limit).copy()
    # Replace NaN/inf with None/0 for JSON compliance
    filtered = filtered.where(filtered.notna(), None)
    records = filtered.to_dict(orient="records")
    # Sanitize any remaining float NaN/inf
    def sanitize(v):
        if isinstance(v, float) and (_math.isnan(v) or _math.isinf(v)):
            return None
        return v
    return [{k: sanitize(v) for k, v in row.items()} for row in records]


@app.get("/api/heatmap")
def get_heatmap(
    hour_min: int = Query(0, ge=0, le=23),
    hour_max: int = Query(23, ge=0, le=23),
):
    """Return [[lat, lon, severity], ...] for Leaflet.heat."""
    df = state.scored_df
    if df is None:
        return []

    mask = (df["is_approved"] == 1) & (df["hour"] >= hour_min) & (df["hour"] <= hour_max)
    rows = df[mask][["latitude", "longitude", "severity_score"]].dropna()
    return [[round(float(r[0]), 6), round(float(r[1]), 6), round(float(r[2]), 4)]
            for r in rows.values if all(v == v for v in r)]  # skip NaN rows


@app.get("/api/clusters")
def get_clusters():
    """Return DBSCAN hotspot cluster centroids."""
    return state.clusters


@app.get("/api/stats")
def get_stats():
    """Return KPI aggregates for the dashboard sidebar."""
    return state.stats


@app.get("/api/timeline")
def get_timeline():
    """Return hourly violation counts for the time-lapse slider."""
    return state.timeline


@app.post("/api/simulate", response_model=SimulateResponse)
def simulate(req: SimulateRequest):
    """
    Score a new simulated violation report through the ML cascade:
    Stage 1: Gatekeeper → is_approved
    Stage 2: Impact Quantifier → severity_score
    Stage 3: Find nearest existing cluster
    """
    import pickle, warnings, numpy as np, pandas as pd
    from pathlib import Path

    warnings.filterwarnings("ignore")

    # Build a single-row DataFrame matching raw CSV schema
    row = {
        "latitude": req.latitude,
        "longitude": req.longitude,
        "vehicle_type": req.vehicle_type,
        "junction_name": req.junction_name,
        "police_station": "Unknown",
        "location": "Unknown",
        "center_code": "unknown",
        "violation_type": str(req.violation_types),
        "offence_code": "[]",
        "created_datetime": pd.Timestamp.now(tz="UTC").isoformat(),
        "validation_status": "pending",
    }
    input_df = pd.DataFrame([row])

    # Feature engineering — use state.scored_df as reference for imputation medians
    ref_df = state.raw_df if state.raw_df is not None else input_df
    feat_df = _engineer_features(input_df.copy(), ref_df)

    # Override hour with the slider value from request
    feat_df["hour_of_day"] = req.hour

    cat_cols = ["location", "vehicle_type", "center_code", "police_station",
                "junction_name", "primary_violation", "primary_offence"]
    feat_df = _label_encode(feat_df, feat_df, cat_cols)

    MODEL_FEATURES = [
        "latitude", "longitude", "location", "vehicle_type", "center_code",
        "police_station", "junction_name", "hour_of_day", "day_of_week",
        "is_weekend", "is_peak_hour", "is_night", "month",
        "vehicle_weight_category", "violation_count", "primary_violation",
        "violation_wrong_parking", "violation_no_parking", "violation_main_road",
        "heavy_at_peak", "mainroad_at_junction", "offence_count", "primary_offence"
    ]
    for col in MODEL_FEATURES:
        if col not in feat_df.columns:
            feat_df[col] = 0
    X = feat_df[MODEL_FEATURES]

    from app.data_loader import _CANDIDATE_DIRS, M1_NAMES, M2_NAMES, _find_model

    # Stage 1
    m1_path = _find_model(M1_NAMES, _CANDIDATE_DIRS)
    if m1_path and state.m1_loaded:
        with open(m1_path, "rb") as f:
            m1 = pickle.load(f)
        is_approved = bool(m1.predict(X)[0] == 1)
    else:
        is_approved = True  # graceful fallback

    # Stage 2
    severity = 0.0
    if is_approved:
        m2_path = _find_model(M2_NAMES, _CANDIDATE_DIRS)
        if m2_path and state.m2_loaded:
            with open(m2_path, "rb") as f:
                m2 = pickle.load(f)
            severity = float(np.clip(m2.predict(X)[0], 0.0, 1.0))
        else:
            # Heuristic fallback for simulate
            from app.data_loader import _heuristic_severity
            severity = float(_heuristic_severity(input_df, feat_df)[0])

    # Stage 3 — find nearest cluster
    nearest_id = None
    nearest_dist = None
    if state.clusters and is_approved:
        EARTH_R = 6_371_000.0
        lat_r = math.radians(req.latitude)
        lon_r = math.radians(req.longitude)
        best_dist = float("inf")
        for c in state.clusters:
            c_lat_r = math.radians(c["latitude"])
            c_lon_r = math.radians(c["longitude"])
            dlat = c_lat_r - lat_r
            dlon = c_lon_r - lon_r
            a = math.sin(dlat / 2) ** 2 + math.cos(lat_r) * math.cos(c_lat_r) * math.sin(dlon / 2) ** 2
            dist_m = 2 * EARTH_R * math.asin(math.sqrt(a))
            if dist_m < best_dist:
                best_dist = dist_m
                nearest_id = c["cluster_id"]
                nearest_dist = dist_m

    # Severity label
    if not is_approved:
        label = "Rejected"
    elif severity < 0.3:
        label = "Low Impact"
    elif severity < 0.6:
        label = "Moderate Impact"
    elif severity < 0.8:
        label = "High Impact"
    else:
        label = "Critical"

    message = (
        f"Report {'APPROVED' if is_approved else 'REJECTED by Gatekeeper'}. "
        f"Severity: {label} ({severity:.2f}). "
        + (f"Nearest hotspot {nearest_dist/1000:.1f}km away." if nearest_dist else "No nearby cluster.")
    )

    return SimulateResponse(
        is_approved=is_approved,
        severity_score=round(severity, 4),
        severity_label=label,
        nearest_cluster_id=nearest_id,
        nearest_cluster_dist_m=round(nearest_dist, 1) if nearest_dist else None,
        message=message,
    )
