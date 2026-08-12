"""
Advanced Dataset Synthesizer Module for Qwen 2.5 0.5B RL & Tool Training.
Generates 5,000+ real-world generalized SFT & RL trajectories incorporating operational telemetry:
weather, road type, queue backlog, speed drop, ambulance flags, citizen reliability scores,
multi-step tool calls (Dijkstra routing), and SOP macro-action decision outputs.
"""

import os
import sys
import json
import random
from pathlib import Path
from typing import Dict, List, Any

# Ensure backend root is in import path
_BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(_BACKEND_DIR))

from app.data_loader import state, load_and_process, DATA_PATH
from app.tools import (
    BANGALORE_NODES,
    tool_check_junction_cctv,
    tool_query_available_units,
    tool_calculate_shortest_route,
    tool_issue_signal_override,
    tool_broadcast_traffic_advisory,
)

OUTPUT_DIR = _BACKEND_DIR / "data"
SFT_JSONL_PATH = OUTPUT_DIR / "sft_traffic_sop_train.jsonl"
RL_TRAJECTORIES_PATH = OUTPUT_DIR / "rl_env_trajectories.jsonl"

SYSTEM_PROMPT = (
    "You are an AI Traffic Officer Dispatcher for Bengaluru City Traffic Police. "
    "You have access to operational tools: calculate_shortest_route(origin_coords, dest_coords), "
    "query_available_units(police_station, max_radius_km), check_junction_cctv(junction_name), "
    "issue_signal_override(junction_name, duration_mins), broadcast_traffic_advisory(junction_name, alt_route). "
    "Analyze incident telemetry, invoke necessary tools, and choose the optimal SOP macro-action: "
    "VERIFY, DISPATCH, RESOLVE, REJECT, ESCALATE."
)

WEATHER_TYPES = ["CLEAR", "HEAVY_RAIN", "WATERLOGGING", "FOG"]
ROAD_TYPES = ["EXPRESSWAY_FLYOVER", "ARTERIAL_MAIN_ROAD", "HOSPITAL_EMERGENCY_CORRIDOR", "SCHOOL_ZONE", "RESIDENTIAL_CROSS"]
BREAKDOWN_TYPES = ["STALLED_BUS", "ACCIDENT_MULTI_VEHICLE", "ILLEGAL_PARKING_CLUSTER", "HAZMAT_TANKER_STALLED", "CLEAR"]

def generate_generalized_dataset(total_samples: int = 5000) -> None:
    """Generate 5,000+ tool-augmented real-world SFT and RL trajectories."""
    print(f"Ingesting dataset & generating {total_samples} generalized real-world trajectories...")
    
    # Run data loader to load real workspace reports & clusters
    try:
        load_and_process()
        scored_df = state.scored_df
        clusters = state.clusters
    except Exception as e:
        print(f"Data loader warning: {e}. Generating synthetic base clusters...")
        clusters = []

    stations_list = list(BANGALORE_NODES.keys())
    sft_records = []
    rl_records = []
    
    rng = random.Random(42)  # Reproducible random seed

    for sample_idx in range(total_samples):
        # Pick station & junction coords
        station = rng.choice(stations_list)
        junction = f"{station} Junction" if "Board" not in station else station
        s_coords = BANGALORE_NODES[station]
        
        # Add random lat/lon jitter for realistic city spread
        lat = round(s_coords[0] + rng.uniform(-0.03, 0.03), 4)
        lon = round(s_coords[1] + rng.uniform(-0.03, 0.03), 4)

        # Telemetry variables
        weather = rng.choice(WEATHER_TYPES)
        road_type = rng.choice(ROAD_TYPES)
        report_count = rng.randint(1, 18)
        citizen_reliability = round(rng.uniform(0.15, 0.98), 2)
        ambulance_blocked = (road_type == "HOSPITAL_EMERGENCY_CORRIDOR" or rng.random() < 0.12)
        queue_backlog_m = rng.randint(50, 950)
        speed_drop_pct = rng.randint(5, 92)
        
        # Base severity calculation incorporating telemetry
        base_sev = rng.uniform(0.1, 0.95)
        if ambulance_blocked:
            base_sev = max(base_sev, 0.92)
        if weather in ("HEAVY_RAIN", "WATERLOGGING") and speed_drop_pct > 60:
            base_sev = min(0.98, base_sev + 0.15)
        if citizen_reliability < 0.25 and report_count == 1:
            base_sev = min(base_sev, 0.22)
            
        avg_sev = round(float(base_sev), 2)

        # SOP Action Rules
        if avg_sev >= 0.88 or ambulance_blocked or (report_count >= 10 and speed_drop_pct > 80):
            target_action = "ESCALATE"
            rule_reason = f"CRITICAL EMERGENCY (Severity {avg_sev}, Speed Drop {speed_drop_pct}%, Ambulance Blocked: {ambulance_blocked}). Escalated to Human Supervisor for immediate rerouting."
        elif avg_sev >= 0.52:
            target_action = "DISPATCH"
            rule_reason = f"High impact obstruction (Severity {avg_sev}, Queue {queue_backlog_m}m). Dispatched heavy tow/patrol unit."
        elif avg_sev >= 0.28 or citizen_reliability < 0.40:
            target_action = "VERIFY"
            rule_reason = f"Moderate severity alert (Severity {avg_sev}, Reliability {citizen_reliability}). Requested CCTV visual confirmation."
        else:
            target_action = "REJECT"
            rule_reason = f"Low impact submission (Severity {avg_sev}, Reliability {citizen_reliability}). Dismissed alert as non-actionable false positive."

        # Simulate Tool Execution Traces
        cctv_res = tool_check_junction_cctv(junction)
        if target_action == "REJECT":
            cctv_res["lane_blocked"] = False
            cctv_res["breakdown_type"] = "CLEAR"

        unit_res = tool_query_available_units(station, max_radius_km=5.0)
        avail_units = [u for u in unit_res.get("units", []) if u["status"] == "AVAILABLE"]
        assigned_unit = avail_units[0] if avail_units else None

        tool_calls_trace = [
            {
                "tool_call": f'<tool_call>{{"name": "check_junction_cctv", "arguments": {{"junction_name": "{junction}"}}}}</tool_call>',
                "tool_response": json.dumps(cctv_res)
            }
        ]

        if target_action in ("DISPATCH", "ESCALATE", "VERIFY"):
            tool_calls_trace.append({
                "tool_call": f'<tool_call>{{"name": "query_available_units", "arguments": {{"police_station": "{station}", "max_radius_km": 5.0}}}}</tool_call>',
                "tool_response": json.dumps(unit_res)
            })

        dist_km, eta = 2.4, 6.8
        if target_action == "DISPATCH" and assigned_unit:
            route_res = tool_calculate_shortest_route(assigned_unit["coords"], [lat, lon], congestion_factor=1.0 + avg_sev)
            dist_km = route_res.get("distance_km", 2.4)
            eta = route_res.get("eta_mins", 6.8)
            tool_calls_trace.append({
                "tool_call": f'<tool_call>{{"name": "calculate_shortest_route", "arguments": {{"origin_coords": {assigned_unit["coords"]}, "dest_coords": [{lat}, {lon}]}}}}</tool_call>',
                "tool_response": json.dumps({"status": "SUCCESS", "distance_km": dist_km, "eta_mins": eta})
            })
            
            # Green corridor override
            tool_calls_trace.append({
                "tool_call": f'<tool_call>{{"name": "issue_signal_override", "arguments": {{"junction_name": "{junction}", "duration_mins": 15}}}}</tool_call>',
                "tool_response": json.dumps({"status": "SUCCESS", "override_mode": "GREEN_CORRIDOR_PRIORITY"})
            })

        if target_action == "ESCALATE":
            tool_calls_trace.append({
                "tool_call": f'<tool_call>{{"name": "broadcast_traffic_advisory", "arguments": {{"junction_name": "{junction}", "alt_route": "Outer Ring Road Flyover"}}}}</tool_call>',
                "tool_response": json.dumps({"status": "SUCCESS", "channels_notified": ["VMS_BOARDS", "NAVIGATION_PARTNERS", "TRAFFIC_FM"]})
            })

        unit_id = assigned_unit["unit_id"] if (assigned_unit and target_action == "DISPATCH") else None
        
        final_response_json = json.dumps({
            "reasoning": f"{rule_reason}" + (f" Dispatched {unit_id} ({dist_km} km away, ETA {eta} mins)." if unit_id else ""),
            "severity_score": avg_sev,
            "action": target_action,
            "assigned_unit": unit_id,
            "confidence": round(0.85 + (0.10 if target_action != "ESCALATE" else -0.12), 2)
        })

        # Assemble Prompt Telemetry Text
        user_prompt = (
            f"Incident Alert TICK-BLR-{sample_idx:04d}: Station={station}, Junction={junction}, "
            f"Coords=[{lat:.4f}, {lon:.4f}], Weather={weather}, RoadType={road_type}, "
            f"SpeedDrop={speed_drop_pct}%, QueueBacklog={queue_backlog_m}m, "
            f"AmbulanceBlocked={str(ambulance_blocked).upper()}, CitizenReliability={citizen_reliability}, "
            f"ActiveReports={report_count}."
        )

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ]

        for step in tool_calls_trace:
            messages.append({"role": "assistant", "content": step["tool_call"]})
            messages.append({"role": "tool", "content": step["tool_response"]})

        messages.append({"role": "assistant", "content": final_response_json})

        sft_records.append({"messages": messages})
        
        rl_records.append({
            "ticket_id": f"TICK-BLR-{sample_idx:04d}",
            "state": {
                "latitude": lat,
                "longitude": lon,
                "police_station": station,
                "junction_name": junction,
                "severity_score": avg_sev,
                "weather": weather,
                "road_type": road_type,
                "speed_drop_pct": speed_drop_pct,
                "ambulance_blocked": ambulance_blocked,
                "report_count": report_count
            },
            "target_action": target_action,
            "reward_baseline": 10.0 if target_action in ("DISPATCH", "RESOLVE") else 5.0
        })

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Write SFT JSONL
    with open(SFT_JSONL_PATH, "w") as f:
        for rec in sft_records:
            f.write(json.dumps(rec) + "\n")

    # Write RL Trajectories JSONL
    with open(RL_TRAJECTORIES_PATH, "w") as f:
        for rec in rl_records:
            f.write(json.dumps(rec) + "\n")

    print(f"✅ Successfully generated {len(sft_records)} real-world SFT trajectories at {SFT_JSONL_PATH}")
    print(f"✅ Successfully generated {len(rl_records)} real-world RL trajectories at {RL_TRAJECTORIES_PATH}")

if __name__ == "__main__":
    generate_generalized_dataset(5000)
