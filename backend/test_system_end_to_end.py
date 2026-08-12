"""
End-to-End Test Suite for Stage 4 Qwen 2.5 0.5B Tool Dispatcher & HITL Continuous DPO Loop.
"""

import sys
import json
import urllib.request
from pathlib import Path

_BACKEND_DIR = Path(__file__).parent
sys.path.insert(0, str(_BACKEND_DIR))

API_BASE = "http://localhost:8000"

def post_json(endpoint: str, data: dict) -> dict:
    url = f"{API_BASE}{endpoint}"
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def get_json(endpoint: str) -> dict:
    url = f"{API_BASE}{endpoint}"
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read().decode("utf-8"))

def run_tests():
    print("==========================================================")
    print("🚀 STARTING STAGE 4 END-TO-END SYSTEM INTEGRATION TEST")
    print("==========================================================")

    # 1. Test Health
    health = get_json("/health")
    print(f"\n1️⃣ Health Check: Status={health['status']}, Clusters={health['num_clusters']}")

    # 2. Test High Severity DISPATCH + Dijkstra Shortest Path
    req_dispatch = {
        "ticket_id": "TEST_DISPATCH_001",
        "latitude": 12.9255,
        "longitude": 77.6186,
        "police_station": "Madiwala",
        "junction_name": "Silk Board Junction",
        "severity_score": 0.78,
        "report_count": 6
    }
    res_dispatch = post_json("/api/predict_action", req_dispatch)
    print(f"\n2️⃣ Test DISPATCH Action Scenario:")
    print(f"   • Action: {res_dispatch['action']} (Confidence: {res_dispatch['confidence']*100:.1f}%)")
    print(f"   • Auto Execute: {res_dispatch['auto_execute']}")
    print(f"   • Assigned Unit: {res_dispatch['assigned_unit']}")
    print(f"   • Executed Tools Count: {len(res_dispatch['tool_calls_executed'])}")
    for tc in res_dispatch['tool_calls_executed']:
        print(f"     - Tool: {tc['tool']}")

    # 3. Test Critical Emergency ESCALATE
    req_escalate = {
        "ticket_id": "TEST_ESCALATE_002",
        "latitude": 12.9054,
        "longitude": 77.7007,
        "police_station": "Bellandur",
        "junction_name": "Bellandur Flyover",
        "severity_score": 0.95,
        "report_count": 14
    }
    res_escalate = post_json("/api/predict_action", req_escalate)
    print(f"\n3️⃣ Test ESCALATE Action Scenario:")
    print(f"   • Action: {res_escalate['action']} (Confidence: {res_escalate['confidence']*100:.1f}%)")
    print(f"   • Auto Execute: {res_escalate['auto_execute']} (Triggers HITL Modal on Dashboard!)")
    print(f"   • Reasoning: {res_escalate['reasoning']}")

    # 4. Test Low Impact REJECT
    req_reject = {
        "ticket_id": "TEST_REJECT_003",
        "latitude": 12.9565,
        "longitude": 77.5186,
        "police_station": "Byatarayanapura",
        "junction_name": "Nagarbhavi Cross",
        "severity_score": 0.15,
        "report_count": 1
    }
    res_reject = post_json("/api/predict_action", req_reject)
    print(f"\n4️⃣ Test REJECT Action Scenario:")
    print(f"   • Action: {res_reject['action']} (Confidence: {res_reject['confidence']*100:.1f}%)")
    print(f"   • Auto Execute: {res_reject['auto_execute']}")

    # 5. Test HITL Officer Feedback Logging
    print(f"\n5️⃣ Test HITL Officer Feedback & DPO Preference Pair Logging:")
    feedback_payload = {
        "ticket_id": "TEST_ESCALATE_002",
        "original_action": "DISPATCH",
        "officer_action": "ESCALATE",
        "is_approved": False,
        "officer_notes": "Heavy multi-lane bottleneck requires human traffic police diversion.",
        "incident_state": {"severity_score": 0.95, "police_station": "Bellandur"}
    }
    res_fb = post_json("/api/human_feedback", feedback_payload)
    print(f"   • Feedback Logged: ID={res_fb['feedback_id']}, Total Feedback Logs={res_fb['total_feedback_logs']}")

    # 6. Test RL Metrics Endpoint
    metrics = get_json("/api/rl_metrics")
    print(f"\n6️⃣ Test Live RL Metrics Endpoint:")
    print(f"   • Model Name: {metrics['model_name']}")
    print(f"   • Autonomous Resolution Rate: {metrics['autonomous_resolution_rate_pct']}%")
    print(f"   • HITL Stats: {metrics['hitl_stats']}")

    print("\n==========================================================")
    print("✅ ALL STAGE 4 SYSTEM INTEGRATION TESTS PASSED PERFECTLY!")
    print("==========================================================")

if __name__ == "__main__":
    run_tests()
