"""
Hotspot Clusterer — lightweight port of scripts/hotspot_clusterer.py
Uses DBSCAN with haversine metric on high-severity, approved violations.
"""
import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN


EARTH_RADIUS_M = 6_371_000.0


def run_clustering(df: pd.DataFrame, eps_meters: int = 80, min_samples: int = 3) -> list[dict]:
    """
    Run DBSCAN on approved, high-severity violations.
    Returns a list of cluster dicts for the API.
    """
    # Filter to approved, non-zero severity rows with valid coords
    cluster_input = df[
        (df["is_approved"] == 1) &
        (df["severity_score"] > 0.15) &
        df["latitude"].notna() &
        df["longitude"].notna()
    ].copy()

    if len(cluster_input) < min_samples:
        return []

    # DBSCAN with haversine (expects radians)
    coords_rad = np.radians(cluster_input[["latitude", "longitude"]].values)
    eps_rad = eps_meters / EARTH_RADIUS_M

    model = DBSCAN(eps=eps_rad, min_samples=min_samples, algorithm="ball_tree", metric="haversine")
    labels = model.fit_predict(coords_rad)
    cluster_input = cluster_input.copy()
    cluster_input["_cluster_id"] = labels

    clusters = []
    for label in sorted(set(labels)):
        if label == -1:
            continue
        mask = cluster_input["_cluster_id"] == label
        grp = cluster_input[mask]
        centroid_lat = float(grp["latitude"].mean())
        centroid_lon = float(grp["longitude"].mean())
        avg_sev = float(grp["severity_score"].mean())
        count = int(len(grp))

        # Approximate radius: max haversine distance from centroid to any point in cluster
        diffs = np.radians(grp[["latitude", "longitude"]].values) - np.radians([centroid_lat, centroid_lon])
        a = np.sin(diffs[:, 0] / 2) ** 2 + np.cos(np.radians(centroid_lat)) * np.cos(np.radians(grp["latitude"].values)) * np.sin(diffs[:, 1] / 2) ** 2
        distances_m = 2 * EARTH_RADIUS_M * np.arcsin(np.sqrt(np.clip(a, 0, 1)))
        radius_m = float(np.percentile(distances_m, 90)) if len(distances_m) > 0 else eps_meters

        top_station = "Unknown"
        if "police_station" in grp.columns:
            top_station = str(grp["police_station"].value_counts().idxmax())

        clusters.append({
            "cluster_id": int(label),
            "latitude": centroid_lat,
            "longitude": centroid_lon,
            "count": count,
            "avg_severity": round(avg_sev, 3),
            "top_station": top_station,
            "radius_m": round(max(radius_m, eps_meters), 1),
        })

    # Sort by severity × count (most dangerous first)
    clusters.sort(key=lambda c: c["avg_severity"] * c["count"], reverse=True)
    return clusters
