"""
Human-in-the-Loop (HITL) Feedback Logger & DPO Pair Generator.
Records traffic officer approval/override choices to JSONL logs and
automatically formats DPO Preference Pairs for periodic Qwen continuous learning.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

_BACKEND_DIR = Path(__file__).parent.parent
DATA_DIR = _BACKEND_DIR / "data"
FEEDBACK_LOG_PATH = DATA_DIR / "hitl_feedback_logs.jsonl"
DPO_PAIRS_PATH = DATA_DIR / "dpo_preference_pairs.jsonl"

def log_human_feedback(
    ticket_id: str,
    original_action: str,
    officer_action: str,
    is_approved: bool,
    officer_notes: Optional[str],
    incident_state: Dict[str, Any]
) -> Dict[str, Any]:
    """Record officer feedback log and generate DPO preference pair if overridden."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    feedback_id = f"FB_{uuid.uuid4().hex[:8]}"
    timestamp = datetime.utcnow().isoformat() + "Z"
    
    record = {
        "feedback_id": feedback_id,
        "timestamp": timestamp,
        "ticket_id": ticket_id,
        "original_action": original_action,
        "officer_action": officer_action,
        "is_approved": is_approved,
        "officer_notes": officer_notes or "No notes provided.",
        "incident_state": incident_state
    }
    
    # Append to raw feedback log
    with open(FEEDBACK_LOG_PATH, "a") as f:
        f.write(json.dumps(record) + "\n")
        
    # If officer overridden, convert into DPO Preference Pair
    if not is_approved or original_action != officer_action:
        dpo_pair = _convert_to_dpo_pair(record)
        with open(DPO_PAIRS_PATH, "a") as f:
            f.write(json.dumps(dpo_pair) + "\n")
            
    total_logs = get_total_feedback_count()
    
    return {
        "status": "SUCCESS",
        "feedback_id": feedback_id,
        "logged_at": timestamp,
        "total_feedback_logs": total_logs
    }

def _convert_to_dpo_pair(record: Dict[str, Any]) -> Dict[str, Any]:
    """Convert officer override into DPO Chosen vs Rejected pair."""
    st = record["incident_state"]
    station = st.get("police_station", "Madiwala")
    junction = st.get("junction_name", "Silk Board")
    sev = st.get("severity_score", 0.75)
    
    prompt = (
        f"Incident Alert: Station={station}, Junction={junction}, "
        f"Severity={sev}, Officer Decision Required."
    )
    
    chosen_response = json.dumps({
        "reasoning": f"Officer override: {record.get('officer_notes', 'Adjusted to fit live operational context.')}",
        "severity_score": float(sev),
        "action": record["officer_action"],
        "confidence": 1.0
    })
    
    rejected_response = json.dumps({
        "reasoning": "Model initial prediction prior to officer override.",
        "severity_score": float(sev),
        "action": record["original_action"],
        "confidence": 0.75
    })
    
    return {
        "prompt": prompt,
        "chosen": chosen_response,
        "rejected": rejected_response,
        "feedback_id": record["feedback_id"],
        "timestamp": record["timestamp"]
    }

def get_total_feedback_count() -> int:
    """Return count of logged feedback entries."""
    if not FEEDBACK_LOG_PATH.exists():
        return 0
    count = 0
    with open(FEEDBACK_LOG_PATH, "r") as f:
        for line in f:
            if line.strip():
                count += 1
    return count

def get_feedback_stats() -> Dict[str, Any]:
    """Return summary analytics on human officer overrides."""
    if not FEEDBACK_LOG_PATH.exists():
        return {
            "total_logs": 0,
            "approved_rate": 100.0,
            "overridden_count": 0,
            "dpo_pairs_count": 0
        }
        
    total = 0
    approved = 0
    with open(FEEDBACK_LOG_PATH, "r") as f:
        for line in f:
            if line.strip():
                total += 1
                rec = json.loads(line)
                if rec.get("is_approved", True):
                    approved += 1
                    
    dpo_count = 0
    if DPO_PAIRS_PATH.exists():
        with open(DPO_PAIRS_PATH, "r") as f:
            for line in f:
                if line.strip():
                    dpo_count += 1
                    
    return {
        "total_logs": total,
        "approved_rate": round((approved / max(1, total)) * 100, 1),
        "overridden_count": total - approved,
        "dpo_pairs_count": dpo_count
    }
