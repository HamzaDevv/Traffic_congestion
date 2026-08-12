# 👮 Traffic Officer & Control Center Dispatcher Guidebook

Welcome to the **Smart City Traffic Control Center Operations Guidebook**. This document provides Standard Operating Procedures (SOPs) for traffic control officers, dispatchers, and system supervisors operating the **AI & RL Tool-Augmented Traffic Dispatcher Dashboard**.

---

## 📖 Table of Contents
1. [System Overview](#1-system-overview)
2. [The 5 SOP Macro-Actions](#2-the-5-sop-macro-actions)
3. [Understanding Agentic Tools & Dijkstra Routing](#3-understanding-agentic-tools--dijkstra-routing)
4. [Operating the Human-in-the-Loop (HITL) Override Modal](#4-operating-the-human-in-the-loop-hitl-override-modal)
5. [Continuous AI Alignment (DPO Feedback)](#5-continuous-ai-alignment-dpo-feedback)

---

## 1. System Overview

The system processes citizen-submitted violation reports through a 4-stage AI pipeline:
* **Stage 1 (Gatekeeper)**: Validates report legitimacy.
* **Stage 2 (Impact Quantifier)**: Assigns severity score ($0.0 - 1.0$).
* **Stage 3 (Hotspot Clusterer)**: Groups nearby reports into actionable dispatch zones.
* **Stage 4 (RL SOP Dispatcher Policy)**: Uses `Qwen 2.5 (0.5B)` to analyze telemetry, run **Dijkstra shortest path calculations**, and recommend or execute dispatch actions.

The AI handles **85–90% of routine queries autonomously**, while popping up an **Officer Override Modal** for the remaining 10–15% of ambiguous or critical emergency cases.

---

## 2. The 5 SOP Macro-Actions

| Action Icon | Macro-Action | SOP Condition & Operational Trigger |
| :---: | :--- | :--- |
| 🔍 | **`VERIFY`** | Used when report severity is moderate ($0.25 \le \text{severity} < 0.55$) or citizen reliability is low. Flags ticket as "Under Review" and requests CCTV camera visual confirmation. |
| 🚨 | **`DISPATCH`** | Used when severity $\ge 0.55$. Queries nearby available units, calculates optimal **Dijkstra shortest path**, issues a **Green Corridor** traffic signal override, and assigns a tow truck / patrol bike. |
| ✅ | **`RESOLVE`** | Used when traffic flow returns to baseline or obstruction has been cleared. Formally closes the incident ticket. |
| 🚫 | **`REJECT`** | Used when severity $< 0.25$ or CCTV confirms zero physical obstruction. Dismisses report as a false positive. |
| ⚠️ | **`ESCALATE`** | Used **only** for severe emergencies (severity $\ge 0.88$), active multi-lane blockages, or trapped ambulances. Broadcasts public diversion advisories and forwards ticket to Human Supervisor popup screen. |

---

## 3. Understanding Agentic Tools & Dijkstra Routing

When an incident is evaluated, Qwen executes dynamic **Agentic Tools** before issuing a decision. You can view these live execution traces in the **🛠️ Live Agentic Tool Execution Log** panel on the map:

1. **`check_junction_cctv(junction_name)`**:
   * Inspects live camera feed status, lane blockage boolean, and visibility %.
2. **`query_available_units(police_station, max_radius_km)`**:
   * Scans nearby Patrol Bikes, Interceptors, and Heavy Tow Trucks for availability.
3. **`calculate_shortest_route(origin_coords, dest_coords)`**:
   * Applies **Dijkstra's Shortest Path Algorithm** over the Bangalore road network graph weighted by live congestion to find the fastest unit ETA.
4. **`issue_signal_override(junction_name, duration_mins)`**:
   * Activates **Green Corridor** signal priority for 15 minutes to clear traffic lights for incoming dispatch units.
5. **`broadcast_traffic_advisory(junction_name, alt_route)`**:
   * Sends public navigation alerts to VMS boards, Google Maps/Waze partners, and Traffic FM radio during critical bottlenecks.

---

## 4. Operating the Human-in-the-Loop (HITL) Override Modal

When an incident triggers low confidence ($P < 0.80$) or is flagged for **`ESCALATE`**, the **⚠️ Human-in-the-Loop Officer Override Modal** will pop up on your screen:

```
+-----------------------------------------------------------------------+
| ⚠️ Human-in-the-Loop Officer Override Required                        |
| Incident Ticket #CLUST_42                                             |
|                                                                       |
| Qwen Policy Action: ESCALATE              Softmax Confidence: 78.0%   |
| "Critical bottleneck at Silk Board. Multi-lane obstruction."          |
|                                                                       |
| 🛠️ Executed Tools:                                                    |
| • check_junction_cctv: LANE_BLOCKED (STALLED_BUS)                      |
| • calculate_shortest_route: Dijkstra Path (3.2 km, ETA 11.5 mins)     |
|                                                                       |
| Select Officer Decision:                                              |
| [ VERIFY ] [ DISPATCH ] [ RESOLVE ] [ REJECT ] [ ESCALATE ]           |
|                                                                       |
| Officer Log Notes:                                                    |
| [ Add operational rationale for approval or override...             ] |
|                                                                       |
|                  [ Submit Override ]   [ Approve Qwen Action ]        |
+-----------------------------------------------------------------------+
```

### Steps for Officer:
1. **Review Qwen Reasoning & Executed Tools**: Inspect the CCTV status, Dijkstra route ETA, and confidence score.
2. **Option A — Approve Qwen Action**: Click the green **Approve Qwen Action** button to execute Qwen's recommendation with 1 click.
3. **Option B — Override Action**: Click any alternative action button (`VERIFY`, `DISPATCH`, `RESOLVE`, `REJECT`, `ESCALATE`), type optional officer rationale notes, and click **Submit Override Decision**.

---

## 5. Continuous AI Alignment (DPO Feedback)

Every time an officer submits an **Override Decision**:
* The system automatically creates a **Direct Preference Optimization (DPO) Preference Pair**:
  * **`chosen`**: Officer's corrected action & rationale.
  * **`rejected`**: Model's initial unaligned recommendation.
* The background **Continuous DPO Retraining Pipeline** automatically micro-tunes Qwen 2.5 on these pairs, making the AI dispatcher smarter and more aligned with your team's real operational judgment over time!
