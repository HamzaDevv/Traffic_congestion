"""
Gymnasium Simulation Environment for Traffic Officer RL Policy Evaluation.
Models ticket lifespans, tool invocation dynamics, SOP compliance, and reward matrix evaluation.
"""

import json
import random
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional
import numpy as np

try:
    import gymnasium as gym
    from gymnasium import spaces
except ImportError:
    # Fallback minimal Gym interface if gymnasium is not installed
    class gym:
        class Env:
            pass
    spaces = None

_BACKEND_DIR = Path(__file__).parent.parent
RL_TRAJECTORIES_PATH = _BACKEND_DIR / "data" / "rl_env_trajectories.jsonl"

MACRO_ACTIONS = ["VERIFY", "DISPATCH", "RESOLVE", "REJECT", "ESCALATE"]
ACTION_TO_INDEX = {act: i for i, act in enumerate(MACRO_ACTIONS)}
INDEX_TO_ACTION = {i: act for i, act in enumerate(MACRO_ACTIONS)}

class TrafficDispatcherEnv(gym.Env):
    """
    Simulates a Traffic Control Center dispatcher evaluating incoming ticket clusters.
    
    Observation Vector (dim 6):
    [severity_score, report_count, lat_norm, lon_norm, is_peak_hour, cctv_blocked_flag]
    
    Discrete Action Space (dim 5):
    0: VERIFY
    1: DISPATCH
    2: RESOLVE
    3: REJECT
    4: ESCALATE
    """
    
    metadata = {"render_modes": ["human"]}
    
    def __init__(self, trajectories_path: Optional[Path] = None):
        super().__init__()
        
        self.trajectories_path = trajectories_path or RL_TRAJECTORIES_PATH
        self.scenarios = self._load_scenarios()
        self.current_idx = 0
        
        # Define Spaces (dim 6 observation, dim 5 discrete action)
        if spaces:
            self.observation_space = spaces.Box(
                low=np.array([0.0, 0.0, -90.0, -180.0, 0.0, 0.0], dtype=np.float32),
                high=np.array([1.0, 100.0, 90.0, 180.0, 1.0, 1.0], dtype=np.float32),
                dtype=np.float32
            )
            self.action_space = spaces.Discrete(len(MACRO_ACTIONS))
            
        # Metrics Tracking
        self.reset_metrics()
        
    def _load_scenarios(self) -> List[Dict[str, Any]]:
        """Load pre-generated RL trajectory states or create synthetic defaults."""
        scenarios = []
        if self.trajectories_path.exists():
            with open(self.trajectories_path, "r") as f:
                for line in f:
                    if line.strip():
                        scenarios.append(json.loads(line))
        
        if not scenarios:
            # Synthetic fallback scenarios
            for i in range(50):
                scenarios.append({
                    "ticket_id": f"SYNTH_{i:03d}",
                    "state": {
                        "latitude": 12.9255 + random.uniform(-0.05, 0.05),
                        "longitude": 77.6186 + random.uniform(-0.05, 0.05),
                        "police_station": "Madiwala",
                        "junction_name": "Silk Board",
                        "severity_score": round(random.uniform(0.1, 0.95), 2),
                        "report_count": random.randint(1, 15)
                    },
                    "target_action": random.choice(MACRO_ACTIONS)
                })
        return scenarios

    def reset_metrics(self):
        """Reset operational metrics."""
        self.total_tickets = 0
        self.auto_resolved = 0
        self.escalations = 0
        self.total_reward = 0.0
        self.dispatches = 0

    def reset(self, seed: Optional[int] = None, options: Optional[Dict[str, Any]] = None) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Reset environment to next scenario state."""
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)
            
        self.current_idx = random.randint(0, len(self.scenarios) - 1)
        scenario = self.scenarios[self.current_idx]
        st = scenario["state"]
        
        sev = float(st.get("severity_score", 0.5))
        cnt = float(st.get("report_count", 3))
        lat = float(st.get("latitude", 12.9255))
        lon = float(st.get("longitude", 77.6186))
        is_peak = 1.0 if (8 <= random.randint(7, 20) <= 10 or 17 <= random.randint(7, 20) <= 20) else 0.0
        cctv_blocked = 1.0 if sev > 0.6 and random.random() > 0.5 else 0.0
        
        self.current_obs = np.array([sev, cnt, lat, lon, is_peak, cctv_blocked], dtype=np.float32)
        self.current_scenario = scenario
        
        info = {
            "ticket_id": scenario["ticket_id"],
            "target_action": scenario["target_action"],
            "station": st.get("police_station", "Unknown"),
            "junction": st.get("junction_name", "Unknown")
        }
        return self.current_obs, info

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        """
        Execute macro-action index (0..4) and compute SOP reward.
        Returns (obs, reward, terminated, truncated, info).
        """
        predicted_action = INDEX_TO_ACTION.get(action, "VERIFY")
        st = self.current_scenario["state"]
        sev = float(st.get("severity_score", 0.5))
        cnt = int(st.get("report_count", 3))
        target_action = self.current_scenario.get("target_action", "DISPATCH")
        
        reward = 0.0
        self.total_tickets += 1
        
        # 1. Exact Match Reward
        if predicted_action == target_action:
            reward += 10.0
        else:
            reward -= 5.0

        # 2. Macro-Action SOP Matrix Logic
        if predicted_action == "DISPATCH":
            self.dispatches += 1
            if sev >= 0.55:
                reward += 5.0  # Justified dispatch
            else:
                reward -= 20.0 # False dispatch penalty

        elif predicted_action == "ESCALATE":
            self.escalations += 1
            if sev >= 0.90 or cnt >= 10:
                reward += 5.0  # Warranted escalation (recognizing emergency limit)
            else:
                reward -= 15.0 # Unwarranted escalation penalty (bothering human officer)

        elif predicted_action == "REJECT":
            if sev < 0.30:
                reward += 5.0  # Justified rejection of low-severity/fake report
            else:
                reward -= 20.0 # False negative on real traffic issue

        elif predicted_action == "RESOLVE":
            self.auto_resolved += 1
            if sev < 0.20:
                reward += 10.0 # Successfully cleared ticket
            else:
                reward -= 10.0 # Premature closure of active issue

        elif predicted_action == "VERIFY":
            if 0.30 <= sev < 0.60:
                reward += 3.0  # Good verification step

        self.total_reward += reward
        terminated = True
        truncated = False
        
        info = {
            "predicted_action": predicted_action,
            "target_action": target_action,
            "reward": reward,
            "severity": sev,
            "metrics": self.get_metrics()
        }
        
        return self.current_obs, reward, terminated, truncated, info

    def get_metrics(self) -> Dict[str, Any]:
        """Return current performance metrics."""
        return {
            "total_tickets": self.total_tickets,
            "auto_resolved_pct": round((self.auto_resolved / max(1, self.total_tickets)) * 100, 1),
            "escalation_pct": round((self.escalations / max(1, self.total_tickets)) * 100, 1),
            "dispatch_pct": round((self.dispatches / max(1, self.total_tickets)) * 100, 1),
            "total_reward": round(self.total_reward, 2),
            "mean_reward_per_ticket": round(self.total_reward / max(1, self.total_tickets), 2)
        }

if __name__ == "__main__":
    env = TrafficDispatcherEnv()
    obs, info = env.reset()
    print(f"Env initialized. Reset observation: {obs}")
    print(f"Initial Scenario Info: {info}")
    
    # Run 5 random step cycles
    for step_num in range(1, 6):
        act = env.action_space.sample() if spaces else random.randint(0, 4)
        obs, reward, term, trunc, step_info = env.step(act)
        print(f"Step {step_num}: Action={INDEX_TO_ACTION[act]}, Reward={reward:.1f}, Target={step_info['target_action']}")
    print(f"Metrics after 5 steps: {env.get_metrics()}")
