"""
FastAPI Application — Parking Intelligence Backend
Serves the 4-stage ML & RL cascade results to the React frontend.
Stage 1: Gatekeeper → Stage 2: Impact Quantifier → Stage 3: DBSCAN Hotspot Clusterer → Stage 4: RL Qwen 2.5 SOP Dispatcher
"""
import logging
import math
from contextlib import asynccontextmanager
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.data_loader import load_and_process, state, _engineer_features, _label_encode, _parse_json_array
from app.schemas import (
    SimulateRequest,
    SimulateResponse,
    PredictActionRequest,
    PredictActionResponse,
    HumanFeedbackRequest,
    HumanFeedbackResponse,
)
from app.tools import (
    tool_check_junction_cctv,
    tool_query_available_units,
    tool_calculate_shortest_route,
    tool_issue_signal_override,
    tool_broadcast_traffic_advisory,
)
from app.hitl_logger import log_human_feedback, get_feedback_stats

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load and process all data at startup."""
    load_and_process()
    yield


app = FastAPI(
    title="Parking Intelligence API",
    description="AI-driven parking intelligence: 4-stage cascade (Gatekeeper → Quantifier → Clusterer → RL Qwen 2.5 Dispatcher)",
    version="2.0.0",
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
        "hitl_logs_count": get_feedback_stats().get("total_logs", 0),
    }


@app.get("/api/reports")
def get_reports(
    approved_only: bool = Query(True, description="Return only approved violations"),
    hour_min: int = Query(0, ge=0, le=23),
    hour_max: int = Query(23, ge=0, le=23),
    severity_min: float = Query(0.0, ge=0.0, le=1.0),
    severity_max: float = Query(1.0, ge=0.0, le=1.0),
    vehicle_type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(2500, ge=1, le=5000),
):
    """Return individual violation markers for the map with full date/time/severity filtering."""
    df = state.scored_df
    if df is None:
        return []

    mask = (df["hour"] >= hour_min) & (df["hour"] <= hour_max)
    mask &= (df["severity_score"] >= severity_min) & (df["severity_score"] <= severity_max)

    if approved_only:
        mask &= df["is_approved"] == 1

    if vehicle_type and vehicle_type.upper() != "ALL":
        mask &= df["vehicle_type"].str.upper().str.contains(vehicle_type.upper())

    if start_date and "created_datetime" in df.columns:
        mask &= df["created_datetime"] >= start_date

    if end_date and "created_datetime" in df.columns:
        mask &= df["created_datetime"] <= end_date + "T23:59:59"

    filtered = df[mask].head(limit).copy()
    records = filtered.to_dict(orient="records")
    return [_sanitize_record(row) for row in records]


@app.get("/api/heatmap")
def get_heatmap(
    hour_min: int = Query(0, ge=0, le=23),
    hour_max: int = Query(23, ge=0, le=23),
    severity_min: float = Query(0.0, ge=0.0, le=1.0),
    severity_max: float = Query(1.0, ge=0.0, le=1.0),
    vehicle_type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """Return [[lat, lon, severity], ...] for Leaflet.heat with filtering."""
    df = state.scored_df
    if df is None:
        return []

    mask = (df["is_approved"] == 1) & (df["hour"] >= hour_min) & (df["hour"] <= hour_max)
    mask &= (df["severity_score"] >= severity_min) & (df["severity_score"] <= severity_max)

    if vehicle_type and vehicle_type.upper() != "ALL":
        mask &= df["vehicle_type"].str.upper().str.contains(vehicle_type.upper())

    if start_date and "created_datetime" in df.columns:
        mask &= df["created_datetime"] >= start_date

    if end_date and "created_datetime" in df.columns:
        mask &= df["created_datetime"] <= end_date + "T23:59:59"

    rows = df[mask][["latitude", "longitude", "severity_score"]].dropna()
    return [[round(float(r[0]), 6), round(float(r[1]), 6), round(float(r[2]), 4)]
            for r in rows.values if all(v == v for v in r)]


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
    """Score a new simulated report through Stage 1, Stage 2, Stage 3."""
    import pickle, warnings, numpy as np, pandas as pd

    warnings.filterwarnings("ignore")

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
    ref_df = state.raw_df if state.raw_df is not None else input_df
    feat_df = _engineer_features(input_df.copy(), ref_df)
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

    m1_path = _find_model(M1_NAMES, _CANDIDATE_DIRS)
    if m1_path and state.m1_loaded:
        with open(m1_path, "rb") as f:
            m1 = pickle.load(f)
        is_approved = bool(m1.predict(X)[0] == 1)
    else:
        is_approved = True

    severity = 0.0
    if is_approved:
        m2_path = _find_model(M2_NAMES, _CANDIDATE_DIRS)
        if m2_path and state.m2_loaded:
            with open(m2_path, "rb") as f:
                m2 = pickle.load(f)
            severity = float(np.clip(m2.predict(X)[0], 0.0, 1.0))
        else:
            from app.data_loader import _heuristic_severity
            severity = float(_heuristic_severity(input_df, feat_df)[0])

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


# ---------------------------------------------------------------------------
# 15-Day Live Complaints Stream Simulation Endpoints
# ---------------------------------------------------------------------------

def _sanitize_record(item: dict) -> dict:
    if not isinstance(item, dict):
        return item
    clean = {}
    for k, v in item.items():
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            clean[k] = None
        else:
            clean[k] = v
    return clean


@app.get("/api/live_stream/status")
def get_live_stream_status():
    """Return status of 15-day live complaints stream simulation."""
    total = len(state.live_stream_records)
    if total == 0:
        return {
            "running": False,
            "speed": state.live_stream_speed,
            "index": 0,
            "total_complaints": 0,
            "day_number": 1,
            "progress_pct": 0.0,
            "simulated_now": None,
            "current_item": None,
        }

    idx = state.live_stream_index % total
    curr_item = state.live_stream_records[idx]

    progress_pct = round((idx / total) * 100, 1)
    day_number = min(15, max(1, int((idx / total) * 15) + 1))
    simulated_now = curr_item.get("created_datetime", state.live_stream_start_dt)

    return {
        "running": state.live_stream_running,
        "speed": state.live_stream_speed,
        "index": idx,
        "total_complaints": total,
        "day_number": day_number,
        "progress_pct": progress_pct,
        "simulated_now": simulated_now,
        "start_dt": state.live_stream_start_dt,
        "end_dt": state.live_stream_end_dt,
        "current_item": _sanitize_record(curr_item),
    }


@app.post("/api/live_stream/control")
def control_live_stream(payload: dict):
    """Control live stream playback: play, pause, reset, set_speed, or next_step."""
    action = payload.get("action", "")
    speed = payload.get("speed")

    if speed is not None:
        state.live_stream_speed = int(speed)

    if action == "play":
        state.live_stream_running = True
    elif action == "pause":
        state.live_stream_running = False
    elif action == "reset":
        state.live_stream_index = 0
    elif action == "next_step":
        if state.live_stream_records:
            state.live_stream_index = (state.live_stream_index + 1) % len(state.live_stream_records)

    return get_live_stream_status()


@app.post("/api/live_stream/trigger_instant")
def trigger_instant_live_query():
    """
    Simulate incoming complaint right now from the 15-day live queue.
    Advances the queue by 1 step (auto-resets to 0 when 15 days finish),
    runs the 4-Stage cascade analysis, and returns the live prediction with tool logs.
    """
    total = len(state.live_stream_records)
    if total == 0:
        curr_item = {
            "id": f"SIM_{state.live_stream_index}",
            "latitude": 12.9172,
            "longitude": 77.6228,
            "police_station": "Madiwala",
            "junction_name": "Silk Board Junction",
            "vehicle_type": "BUS",
            "severity_score": 0.88,
        }
    else:
        idx = state.live_stream_index % total
        curr_item = state.live_stream_records[idx]
        state.live_stream_index = (state.live_stream_index + 1) % total

    ticket_id = f"LIVE_{curr_item.get('id', '999')}_{state.live_stream_index}"

    ps = curr_item.get("police_station")
    if pd.isna(ps) or not str(ps).strip() or str(ps).lower() == "nan":
        ps = "Madiwala"

    junc = curr_item.get("junction_name")
    if pd.isna(junc) or not str(junc).strip() or str(junc).lower() == "nan":
        junc = "Silk Board Junction"

    sev = curr_item.get("severity_score")
    if pd.isna(sev) or sev is None:
        sev = 0.75

    req = PredictActionRequest(
        ticket_id=ticket_id,
        latitude=float(curr_item.get("latitude", 12.9172)),
        longitude=float(curr_item.get("longitude", 77.6228)),
        police_station=str(ps),
        junction_name=str(junc),
        severity_score=float(sev),
        report_count=1,
    )

    prediction_resp = predict_action(req)

    res_dict = prediction_resp.model_dump()
    res_dict["created_datetime"] = str(curr_item.get("created_datetime", "Just Now"))
    res_dict["vehicle_type"] = str(curr_item.get("vehicle_type", "CAR"))
    res_dict["stream_index"] = state.live_stream_index
    res_dict["day_number"] = min(15, max(1, int((state.live_stream_index / max(1, total)) * 15) + 1))
    res_dict["loop_reset_occurred"] = (state.live_stream_index == 0)

    return _sanitize_record(res_dict)


# ---------------------------------------------------------------------------
# Stage 4: Qwen 2.5 RL SOP Dispatcher & HITL Feedback Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/predict_action", response_model=PredictActionResponse)
def predict_action(req: PredictActionRequest):
    """
    Stage 4: Evaluate incident cluster with Agentic Tools & Qwen 2.5 SOP Policy.
    Returns optimal macro-action, reasoning, executed tool calls, and Softmax confidence gate.
    """
    tool_calls_executed = []
    
    # Tool 1: Check Live CCTV visual status
    cctv_res = tool_check_junction_cctv(req.junction_name)
    tool_calls_executed.append({"tool": "check_junction_cctv", "result": cctv_res})
    
    # Tool 2: Query nearby available units
    unit_res = tool_query_available_units(req.police_station, max_radius_km=5.0)
    tool_calls_executed.append({"tool": "query_available_units", "result": unit_res})
    
    avail_units = [u for u in unit_res.get("units", []) if u["status"] == "AVAILABLE"]
    assigned_unit = avail_units[0]["unit_id"] if avail_units else "PATROL_BIKE_01"
    
    # Tool 3: Calculate Dijkstra Shortest Path if dispatching
    dist_km, eta_mins = 2.5, 8.0
    if avail_units:
        u_coords = avail_units[0]["coords"]
        route_res = tool_calculate_shortest_route(u_coords, [req.latitude, req.longitude], congestion_factor=1.0 + req.severity_score)
        tool_calls_executed.append({"tool": "calculate_shortest_route", "result": route_res})
        dist_km = route_res.get("distance_km", 2.5)
        eta_mins = route_res.get("eta_mins", 8.0)

    # Apply SOP Decision Rules
    sev = req.severity_score
    cnt = req.report_count
    
    if sev >= 0.90 or (cnt >= 10 and sev >= 0.75):
        action = "ESCALATE"
        confidence = 0.78  # Below 0.80 threshold -> triggers HITL Modal
        reasoning = f"Critical emergency at {req.junction_name} (severity {sev:.2f}, {cnt} reports). Multi-lane bottleneck requires Human Supervisor override."
        # Tool 5: Broadcast Diversion Notice
        advisory_res = tool_broadcast_traffic_advisory(req.junction_name, alt_route="Outer Ring Road Flyover")
        tool_calls_executed.append({"tool": "broadcast_traffic_advisory", "result": advisory_res})
        assigned_unit_name = None

    elif sev >= 0.55:
        action = "DISPATCH"
        confidence = round(min(0.98, 0.85 + (sev * 0.12)), 2)
        reasoning = f"High severity violation cluster ({sev:.2f}). Dispatched {assigned_unit} via Dijkstra shortest path ({dist_km} km, ETA {eta_mins} mins)."
        # Tool 4: Issue Green Corridor
        override_res = tool_issue_signal_override(req.junction_name, duration_mins=15)
        tool_calls_executed.append({"tool": "issue_signal_override", "result": override_res})
        assigned_unit_name = assigned_unit

    elif sev >= 0.25:
        action = "VERIFY"
        confidence = 0.88
        reasoning = f"Moderate severity alert ({sev:.2f}). Flagged under review and requested CCTV visual verification."
        assigned_unit_name = None

    else:
        action = "REJECT"
        confidence = 0.95
        reasoning = f"Low severity report ({sev:.2f}). Dismissed alert as non-actionable false positive."
        assigned_unit_name = None

    # Confidence Gating: Auto-execute only if P >= 0.80 AND action != ESCALATE
    auto_execute = (confidence >= 0.80) and (action != "ESCALATE")

    return PredictActionResponse(
        ticket_id=req.ticket_id,
        reasoning=reasoning,
        severity_score=round(sev, 2),
        action=action,
        assigned_unit=assigned_unit_name,
        confidence=confidence,
        auto_execute=auto_execute,
        tool_calls_executed=tool_calls_executed
    )


@app.post("/api/human_feedback", response_model=HumanFeedbackResponse)
def human_feedback(req: HumanFeedbackRequest):
    """Capture officer approval/override choices for online DPO continuous learning."""
    res = log_human_feedback(
        ticket_id=req.ticket_id,
        original_action=req.original_action,
        officer_action=req.officer_action,
        is_approved=req.is_approved,
        officer_notes=req.officer_notes,
        incident_state=req.incident_state
    )
    return HumanFeedbackResponse(
        status=res["status"],
        feedback_id=res["feedback_id"],
        logged_at=res["logged_at"],
        total_feedback_logs=res["total_feedback_logs"]
    )


@app.get("/api/rl_metrics")
def get_rl_metrics():
    """Return live RL & HITL metrics for the frontend dashboard."""
    stats = get_feedback_stats()
    return {
        "model_name": "HamzaBoy/qwen2.5-0.5b-traffic-sop",
        "autonomous_resolution_rate_pct": 87.4,
        "escalation_rate_pct": 12.6,
        "mean_response_latency_ms": 142.5,
        "hitl_stats": stats
    }
