from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


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


# --- RL & HITL Schemas ---

class PredictActionRequest(BaseModel):
    ticket_id: str = Field(..., example="TICK-BLR-001")
    latitude: float = Field(..., example=12.9255)
    longitude: float = Field(..., example=77.6186)
    police_station: str = Field("Madiwala", example="Madiwala")
    junction_name: str = Field("Silk Board", example="Silk Board")
    severity_score: float = Field(0.75, example=0.75)
    report_count: int = Field(5, example=5)
    vehicle_types: List[str] = Field(default_factory=lambda: ["CAR", "BUS"])


class PredictActionResponse(BaseModel):
    ticket_id: str
    reasoning: str
    severity_score: float
    action: str  # VERIFY, DISPATCH, RESOLVE, REJECT, ESCALATE
    assigned_unit: Optional[str] = None
    confidence: float
    auto_execute: bool
    tool_calls_executed: List[Dict[str, Any]] = Field(default_factory=list)


class HumanFeedbackRequest(BaseModel):
    ticket_id: str
    original_action: str
    officer_action: str
    is_approved: bool
    officer_notes: Optional[str] = None
    incident_state: Dict[str, Any]


class HumanFeedbackResponse(BaseModel):
    status: str
    feedback_id: str
    logged_at: str
    total_feedback_logs: int
