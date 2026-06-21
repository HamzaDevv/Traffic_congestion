from pydantic import BaseModel
from typing import Optional, List


class SimulateRequest(BaseModel):
    latitude: float
    longitude: float
    vehicle_type: str
    junction_name: str
    hour: int
    violation_types: List[str] = ["WRONG PARKING"]


class ReportOut(BaseModel):
    id: str
    latitude: float
    longitude: float
    police_station: str
    vehicle_type: str
    junction_name: str
    hour: int
    severity_score: float
    is_approved: int
    validation_status: str


class ClusterOut(BaseModel):
    cluster_id: int
    latitude: float
    longitude: float
    count: int
    avg_severity: float
    top_station: str
    radius_m: float


class StatsOut(BaseModel):
    total_reports: int
    approved_count: int
    approval_rate: float
    avg_severity: float
    num_clusters: int
    top_stations: List[dict]
    vehicle_breakdown: List[dict]
    hourly_counts: List[dict]


class SimulateResponse(BaseModel):
    is_approved: bool
    severity_score: float
    severity_label: str
    nearest_cluster_id: Optional[int]
    nearest_cluster_dist_m: Optional[float]
    message: str
