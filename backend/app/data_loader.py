"""
Data Loader — loads the parking_subset.csv, runs the full 3-stage pipeline,
and caches all derived data at startup for fast endpoint responses.

Stage 1: Gatekeeper (M1 pkl) — binary classification is_approved
Stage 2: Impact Quantifier (M2 pkl) — regression severity_score 0-1
Stage 3: Hotspot Clusterer (DBSCAN haversine) — cluster approved violations
"""
import os
import sys
import json
import pickle
import warnings
import logging
import numpy as np
import pandas as pd
from pathlib import Path

warnings.filterwarnings("ignore")
logger = logging.getLogger("data_loader")

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
_HERE = Path(__file__).parent.parent   # backend/
DATA_PATH = _HERE / "data" / "parking_subset.csv"

# Model paths — check backend/models/ first, then the workspace models/
_CANDIDATE_DIRS = [
    _HERE / "models",
    Path(os.environ.get("MODEL_DIR", "/workspace/models")),
    Path("/workspace/experiments/parking_validation_gatekeeper/models"),
]

M1_NAMES = ["prod_retrain_model_m1.pkl", "gatekeeper_model.pkl", "prod_retrain_model.pkl"]
M2_NAMES = ["prod_retrain_model_m2.pkl", "quantifier_model.pkl", "prod_retrain_model.pkl"]


def _find_model(names: list[str], dirs: list[Path]) -> Path | None:
    for d in dirs:
        for name in names:
            p = d / name
            if p.exists():
                return p
    return None


# ---------------------------------------------------------------------------
# Feature engineering — mirrors preprocess_and_feature_engineer.py exactly
# ---------------------------------------------------------------------------
def _parse_json_array(val):
    if not isinstance(val, str):
        return []
    val = val.strip()
    if not val:
        return []
    try:
        arr = json.loads(val)
        if isinstance(arr, list):
            return arr
    except Exception:
        pass
    if val.startswith("[") and val.endswith("]"):
        val = val[1:-1]
    items = [x.strip().replace('"', "").replace("'", "") for x in val.split(",") if x.strip()]
    return items


def _get_weight_category(v):
    if not isinstance(v, str):
        return 3
    v = v.upper()
    if any(w in v for w in ["2 WHEELER", "SCOOTER", "BIKE", "TWO WHEELER", "MOTORCYCLE", "MOPED", "MOTOR CYCLE"]):
        return 1
    if any(w in v for w in ["BUS", "TANKER", "TRUCK", "HEAVY", "LORRY", "TRACTOR"]):
        return 5
    return 3


def _engineer_features(df: pd.DataFrame, train_df: pd.DataFrame | None = None) -> pd.DataFrame:
    """
    Apply the same feature engineering as preprocess_and_feature_engineer.py.
    Returns a new DataFrame with only the columns expected by the models.
    """
    df = df.copy()

    # Spatial imputation
    lat_median = train_df["latitude"].median() if train_df is not None else df["latitude"].median()
    lon_median = train_df["longitude"].median() if train_df is not None else df["longitude"].median()
    df["latitude"] = df["latitude"].fillna(lat_median)
    df["longitude"] = df["longitude"].fillna(lon_median)

    # Categorical imputation
    for col in ["location", "police_station", "junction_name", "center_code", "vehicle_type"]:
        if col in df.columns:
            df[col] = df[col].fillna("unknown").astype(str)

    # Temporal features
    df["created_datetime"] = pd.to_datetime(df["created_datetime"], format="mixed")
    if df["created_datetime"].dt.tz is None:
        df["created_datetime"] = df["created_datetime"].dt.tz_localize("UTC")
    local = df["created_datetime"].dt.tz_convert("Asia/Kolkata")
    df["hour_of_day"] = local.dt.hour
    df["day_of_week"] = local.dt.dayofweek
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
    df["is_peak_hour"] = local.dt.hour.isin([8, 9, 10, 11, 17, 18, 19]).astype(int)
    df["is_night"] = local.dt.hour.isin([22, 23, 0, 1, 2, 3, 4, 5]).astype(int)
    df["month"] = local.dt.month

    # Vehicle category
    df["vehicle_weight_category"] = df["vehicle_type"].apply(_get_weight_category)

    # Violation features
    parsed_viol = df["violation_type"].apply(_parse_json_array)
    df["violation_count"] = parsed_viol.apply(len)
    df["primary_violation"] = parsed_viol.apply(lambda x: x[0] if x else "none")
    df["violation_wrong_parking"] = parsed_viol.apply(lambda x: 1 if "WRONG PARKING" in x else 0)
    df["violation_no_parking"] = parsed_viol.apply(lambda x: 1 if "NO PARKING" in x else 0)
    df["violation_main_road"] = parsed_viol.apply(lambda x: 1 if "PARKING IN A MAIN ROAD" in x else 0)

    # Interaction features
    df["heavy_at_peak"] = (df["vehicle_weight_category"] >= 5).astype(int) * df["is_peak_hour"]
    is_junc = ((df["junction_name"] != "No Junction") & (df["junction_name"] != "unknown")).astype(int)
    df["mainroad_at_junction"] = df["violation_main_road"] * is_junc

    # Offence features
    parsed_off = df["offence_code"].apply(_parse_json_array)
    df["offence_count"] = parsed_off.apply(len)
    df["primary_offence"] = parsed_off.apply(lambda x: str(x[0]) if x else "none")

    return df


def _label_encode(df: pd.DataFrame, ref_df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    """Label-encode using ref_df (train) distribution so unseen labels get max+1."""
    from sklearn.preprocessing import LabelEncoder
    df = df.copy()
    for col in cols:
        if col not in df.columns:
            continue
        le = LabelEncoder()
        le.fit(ref_df[col].astype(str))
        known = set(le.classes_)
        df[col] = df[col].astype(str).apply(
            lambda x: le.transform([x])[0] if x in known else len(le.classes_)
        )
    return df


# ---------------------------------------------------------------------------
# Global state populated at startup
# ---------------------------------------------------------------------------
class AppState:
    raw_df: pd.DataFrame = None          # Original subset with all raw columns
    scored_df: pd.DataFrame = None       # After M1 + M2 predictions
    clusters: list[dict] = []
    heatmap_data: list[list[float]] = []
    stats: dict = {}
    timeline: list[dict] = []
    m1_loaded: bool = False
    m2_loaded: bool = False

state = AppState()


def load_and_process():
    """
    Called once at FastAPI startup. Runs the full 3-stage pipeline on the data subset.
    """
    logger.info("=== Loading & processing data ===")

    # 1. Load raw CSV
    df = pd.read_csv(DATA_PATH, low_memory=False)
    logger.info(f"Loaded {len(df)} rows from {DATA_PATH}")
    state.raw_df = df.copy()

    # 2. Engineer features (we keep raw df separate for display)
    feat_df = _engineer_features(df.copy())

    # Categorical columns for label-encoding
    cat_cols = ["location", "vehicle_type", "center_code", "police_station",
                "junction_name", "primary_violation", "primary_offence"]

    # Model feature list (from introspection above)
    MODEL_FEATURES = [
        "latitude", "longitude", "location", "vehicle_type", "center_code",
        "police_station", "junction_name", "hour_of_day", "day_of_week",
        "is_weekend", "is_peak_hour", "is_night", "month",
        "vehicle_weight_category", "violation_count", "primary_violation",
        "violation_wrong_parking", "violation_no_parking", "violation_main_road",
        "heavy_at_peak", "mainroad_at_junction", "offence_count", "primary_offence"
    ]

    # Label-encode categoricals (fit on same feat_df since we have no separate train)
    feat_df = _label_encode(feat_df, feat_df, cat_cols)

    # Build X with only model features
    for col in MODEL_FEATURES:
        if col not in feat_df.columns:
            feat_df[col] = 0
    X = feat_df[MODEL_FEATURES].copy()

    # 3. Stage 1 — Gatekeeper Model
    m1_path = _find_model(M1_NAMES, _CANDIDATE_DIRS)
    if m1_path:
        logger.info(f"Loading M1 Gatekeeper from {m1_path}")
        try:
            with open(m1_path, "rb") as f:
                m1 = pickle.load(f)
            is_approved = m1.predict(X)
            state.m1_loaded = True
            logger.info("M1 loaded and predicted successfully")
        except Exception as e:
            logger.error(f"M1 predict failed: {e} — falling back to validation_status")
            is_approved = (df["validation_status"].str.lower() == "approved").astype(int).values
    else:
        logger.warning("M1 not found — using validation_status column")
        is_approved = (df["validation_status"].fillna("").str.lower() == "approved").astype(int).values

    # 4. Stage 2 — Impact Quantifier Model
    m2_path = _find_model(M2_NAMES, _CANDIDATE_DIRS)
    if m2_path:
        logger.info(f"Loading M2 Quantifier from {m2_path}")
        try:
            with open(m2_path, "rb") as f:
                m2 = pickle.load(f)
            severity = m2.predict(X)
            severity = np.clip(severity, 0.0, 1.0)
            state.m2_loaded = True
            logger.info("M2 loaded and predicted successfully")
        except Exception as e:
            logger.error(f"M2 predict failed: {e} — falling back to heuristics")
            severity = _heuristic_severity(df, feat_df)
    else:
        logger.warning("M2 not found — using heuristic severity")
        severity = _heuristic_severity(df, feat_df)

    # Rejected reports get 0 severity
    severity = np.where(is_approved == 1, severity, 0.0)

    # 5. Build scored DataFrame (for frontend consumption)
    scored = df[["latitude", "longitude", "police_station", "vehicle_type",
                 "junction_name", "validation_status"]].copy()
    scored["id"] = df.index.astype(str)
    scored["is_approved"] = is_approved
    scored["severity_score"] = np.round(severity, 4)

    # Keep hour from engineered features
    scored["hour"] = feat_df["hour_of_day"].values

    # Clean up for JSON serialisation
    scored["police_station"] = scored["police_station"].fillna("Unknown").astype(str)
    scored["vehicle_type"] = scored["vehicle_type"].fillna("Unknown").astype(str)
    scored["junction_name"] = scored["junction_name"].fillna("No Junction").astype(str)
    scored["latitude"] = scored["latitude"].astype(float)
    scored["longitude"] = scored["longitude"].astype(float)

    state.scored_df = scored

    # 6. Stage 3 — Hotspot Clusterer
    from app.clusterer import run_clustering
    state.clusters = run_clustering(scored, eps_meters=80, min_samples=3)
    logger.info(f"Detected {len(state.clusters)} hotspot clusters")

    # 7. Heatmap data [[lat, lon, severity], ...]
    approved_mask = scored["is_approved"] == 1
    state.heatmap_data = scored[approved_mask][["latitude", "longitude", "severity_score"]].values.tolist()

    # 8. Stats aggregation
    approved_df = scored[approved_mask]
    state.stats = {
        "total_reports": int(len(scored)),
        "approved_count": int(approved_mask.sum()),
        "approval_rate": round(float(approved_mask.mean()) * 100, 1),
        "avg_severity": round(float(approved_df["severity_score"].mean()) if len(approved_df) > 0 else 0.0, 3),
        "num_clusters": len(state.clusters),
        "m1_loaded": state.m1_loaded,
        "m2_loaded": state.m2_loaded,
        "top_stations": (
            approved_df.groupby("police_station")["severity_score"]
            .agg(["mean", "count"])
            .reset_index()
            .rename(columns={"police_station": "station", "mean": "avg_severity", "count": "violations"})
            .sort_values("violations", ascending=False)
            .head(10)
            .to_dict(orient="records")
        ),
        "vehicle_breakdown": (
            approved_df.groupby("vehicle_type")
            .size()
            .reset_index(name="count")
            .sort_values("count", ascending=False)
            .head(8)
            .to_dict(orient="records")
        ),
    }

    # 9. Timeline — hourly violation counts for time-lapse
    timeline_data = (
        scored.groupby("hour")
        .agg(count=("id", "count"), avg_severity=("severity_score", "mean"))
        .reset_index()
    )
    state.timeline = [
        {
            "hour": int(row["hour"]),
            "count": int(row["count"]),
            "avg_severity": round(float(row["avg_severity"]), 3),
        }
        for _, row in timeline_data.iterrows()
    ]

    logger.info("=== Data loading complete ===")


def _heuristic_severity(raw_df: pd.DataFrame, feat_df: pd.DataFrame) -> np.ndarray:
    """Fallback heuristic from generate_model2_dataset.py."""
    veh_weights = {
        "SCOOTER": 0.10, "MOPED": 0.10, "MOTOR CYCLE": 0.12, "E-SCOOTER": 0.08,
        "PASSENGER AUTO": 0.25, "GOODS AUTO": 0.35, "CAR": 0.40, "VAN": 0.45,
        "MAXI-CAB": 0.55, "LGV": 0.65, "PRIVATE BUS": 0.80, "GOVERNMENT BUS": 0.85,
        "BUS": 0.80, "TRUCK": 0.90, "TANKER": 0.95, "TRACTOR": 0.70, "LORRY": 0.90,
    }
    viol_weights = {
        "DOUBLE PARKING": 1.0, "PARKING IN A MAIN ROAD": 0.90,
        "PARKING NEAR ROAD CROSSING": 0.85, "PARKING NEAR TRAFFIC LIGHT OR ZEBRA CROSS": 0.85,
        "PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC": 0.80,
        "PARKING OPPOSITE TO ANOTHER PARKED VEHICLE": 0.75,
        "NO PARKING": 0.60, "WRONG PARKING": 0.50, "PARKING ON FOOTPATH": 0.30,
    }

    def _vw(v):
        if not isinstance(v, str): return 0.30
        v = v.upper()
        for k, w in veh_weights.items():
            if k in v: return w
        return 0.30

    def _vs(violations):
        max_w = max((viol_weights.get(v.strip().upper(), 0.0) for v in violations), default=0.2)
        return max(max_w, 0.2)

    def _peak(h):
        if 8 <= h < 12: return 1.0
        if 17 <= h < 20: return 0.9
        if 12 <= h < 17: return 0.6
        if 6 <= h < 8:  return 0.5
        if 20 <= h <= 23: return 0.3
        return 0.15

    v_w = raw_df["vehicle_type"].apply(_vw)
    v_s = raw_df["violation_type"].apply(lambda x: _vs(_parse_json_array(x)))
    peak_m = feat_df["hour_of_day"].apply(_peak)
    junc_m = raw_df["junction_name"].apply(
        lambda x: 0.3 if pd.isna(x) or str(x).strip().lower() in ("no junction", "unknown") else 1.0
    )
    raw_scores = v_w.values * v_s.values * peak_m.values * junc_m.values
    mn, mx = raw_scores.min(), raw_scores.max()
    return np.clip((raw_scores - mn) / (mx - mn + 1e-9), 0.0, 1.0)
