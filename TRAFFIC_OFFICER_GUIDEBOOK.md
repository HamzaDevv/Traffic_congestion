# 👮 Traffic Officer & Control Center Dispatcher Guidebook

Welcome to the **Smart City Traffic Control Center Operations Guidebook**. This manual provides operational context, Standard Operating Procedures (SOPs), and user instructions for traffic control officers, dispatchers, and system supervisors operating the **Full-Stack AI Parking Intelligence & Autonomous RL Traffic Dispatcher Platform**.

---

## 📖 Table of Contents
1. [Full System Overview & End-to-End Architecture](#1-full-system-overview--end-to-end-architecture)
2. [Stage 1: Complaint Ingestion & Gatekeeper Validation](#2-stage-1-complaint-ingestion--gatekeeper-validation)
3. [Stage 2: Disruption Severity Scoring & Impact Ranking](#3-stage-2-disruption-severity-scoring--impact-ranking)
4. [Stage 3: Spatial Hotspot Clusters & Patrol Zone Dispatch](#4-stage-3-spatial-hotspot-clusters--patrol-zone-dispatch)
5. [Stage 4: RL SOP Policy & The 5 Macro-Actions](#5-stage-4-rl-sop-policy--the-5-macro-actions)
6. [Agentic Tools, Live CCTV & Dijkstra Route Calculation](#6-agentic-tools-live-cctv--dijkstra-route-calculation)
7. [Operating the Command Dashboard & Live Simulation](#7-operating-the-command-dashboard--live-simulation)
8. [Human-in-the-Loop (HITL) Override & Continuous DPO Alignment](#8-human-in-the-loop-hitl-override--continuous-dpo-alignment)

---

## 1. Full System Overview & End-to-End Architecture

Bengaluru Traffic Police receives thousands of citizen-submitted parking violation reports daily via mobile apps and web portals. Historically, raw complaints were unvalidated, unscored, and spatially disorganized, making targeted officer enforcement difficult.

To solve this, the platform processes raw complaints through a **4-Stage AI/ML Cascade** connected to an interactive **Control Center Command Dashboard**:

```
                                [Citizen Ingestion (CSV / API)]
                                               │
                                               ▼
                                  [Feature Engineering Engine]
                                (23 Spatial & Temporal Signals)
                                               │
                                               ▼
                                ┌──────────────────────────────┐
                                │Stage 1: Gatekeeper (RF M1)   │
                                │Filters Spam & Invalid Reports│
                                └──────────────┬───────────────┘
                                               │
                                      is_approved = 1 (82%)
                                               │
                                               ▼
                                ┌──────────────────────────────┐
                                │Stage 2: Impact Quantifier    │
                                │(RF M2) Severity Score 0.0-1.0│
                                └──────────────┬───────────────┘
                                               │
                                    severity_score (0.0 - 1.0)
                                               │
                                               ▼
                                ┌──────────────────────────────┐
                                │Stage 3: Hotspot Clusterer    │
                                │(DBSCAN 80m Haversine)        │
                                └──────────────┬───────────────┘
                                               │
                                   Approved Hotspot Clusters
                                               │
                                               ▼
                                ┌──────────────────────────────┐
                                │Stage 4: RL Policy & Tools    │
                                │(Qwen 2.5 0.5B + 5 Tools)     │
                                └──────────────┬───────────────┘
                                               │
                    ┌──────────────────────────┴──────────────────────────┐
                    │                                                     │
            Softmax P ≥ 0.80                                      Softmax P < 0.80
            (Auto-Execution)                                    OR action = ESCALATE
                    │                                                     │
                    ▼                                                     ▼
     [AUTONOMOUS DISPATCH EXECUTION]                           [HITL OFFICER OVERRIDE MODAL]
 (VERIFY / DISPATCH / RESOLVE / REJECT)                       (1-Click Approve or Manual Override)
                                                                          │
                                                                          ▼
                                                              [Continuous DPO Alignment]
```

---

## 2. Stage 1: Complaint Ingestion & Gatekeeper Validation

Before a report reaches dispatchers, it undergoes validation by the **Gatekeeper (Random Forest Classifier M1)**:
* **Function**: Evaluates report authenticity and filters out spam, duplicate submissions, illegible photos, and invalid complaint entries.
* **Validation Labels**:
  - `approved` / `is_approved = 1`: Legitimate report passed to Stage 2 severity scoring.
  - `rejected` / `is_approved = 0`: Dismissed as invalid or unverified.
  - `created1`: Initial unverified submission state awaiting automated model classification.
* **Operational Value**: Automatically filters out ~18% of invalid complaints, keeping control room screens clean and focused.

---

## 3. Stage 2: Disruption Severity Scoring & Impact Ranking

Approved reports pass to the **Impact Quantifier (Random Forest Regressor M2)** or multi-factor heuristic model to receive a continuous disruption severity score $S \in [0.0, 1.0]$:

* **Key Factors Influencing Severity Scores**:
  1. **Vehicle Weight Category**:
     - *Light (Weight Class 1)*: Scooters, Motorcycles, Mopeds ($0.0 - 0.35$ baseline).
     - *Medium (Weight Class 3)*: Cars, Vans, Passenger Autos, Goods Autos, Maxi-Cabs, LGVs ($0.35 - 0.65$ baseline).
     - *Heavy (Weight Class 5)*: Buses, Heavy Trucks, Concrete Mixers, Tankers, Lorries ($0.65 - 1.0$ baseline).
  2. **Violation Category & Location Impact**:
     - *Double Parking / Main Road Obstruction*: High severity multiplier.
     - *Bus Stop / Hospital Zone / School Corridor / Junction Crossing*: Critical severity penalty.
  3. **Temporal Peak Multipliers**: Complaints during peak traffic windows (8:00–11:00 AM, 5:00–7:00 PM) receive a $1.25\times$ severity boost.
  4. **Junction Proximity**: Violations near major BTP traffic junctions receive priority weighting.

---

## 4. Stage 3: Spatial Hotspot Clusters & Patrol Zone Dispatch

Dispatching police officers to single isolated complaints is inefficient. Stage 3 applies **DBSCAN Spatial Clustering** (Haversine metric, 80m radius, minimum 3 reports):
* **Cluster Centroids**: Calculates the precise geographic center of aggregated violations.
* **Dispatch Radii & Volume**: Displays the cluster radius ($m$) and active complaint count.
* **Police Station Jurisdiction Ranking**: Ranks police stations (e.g., Upparpet, Shivajinagar, Malleshwaram, City Market) by active cluster density to optimize patrol unit allocation.

---

## 5. Stage 4: RL SOP Policy & The 5 Macro-Actions

Stage 4 uses a fine-tuned `Qwen 2.5 (0.5B)` Reinforcement Learning Policy to evaluate incident telemetry, run agentic tools, and execute one of 5 Standard Operating Procedure (SOP) Macro-Actions:

| Icon | Macro-Action | SOP Operational Condition & Action Trigger |
| :---: | :--- | :--- |
| 🔍 | **`VERIFY`** | Moderate severity ($0.25 \le S < 0.55$) or lower citizen reliability. Flags ticket for review and requests CCTV camera visual confirmation. |
| 🚨 | **`DISPATCH`** | High severity ($S \ge 0.55$). Queries nearby available units, computes **Dijkstra shortest path**, issues a **Green Corridor** signal override, and dispatches a heavy tow truck or patrol bike. |
| ✅ | **`RESOLVE`** | Traffic obstruction cleared or traffic flow restored to baseline. Formally closes the incident ticket. |
| 🚫 | **`REJECT`** | Low severity ($S < 0.25$) or CCTV confirms zero physical obstruction. Dismisses report as a false positive. |
| ⚠️ | **`ESCALATE`** | Critical emergency ($S \ge 0.88$), multi-lane bottleneck, or trapped ambulance. Triggers the HITL Officer Override Modal and broadcasts public traffic advisories. |

---

## 6. Agentic Tools, Live CCTV & Dijkstra Route Calculation

During Stage 4 evaluation, the AI model dynamically executes up to 5 real-time **Agentic Tools**. Dispatchers can monitor these live tool traces in the **🛠️ Live Agentic Tool Execution Log** panel on the map:

1. **`check_junction_cctv(junction_name)`**:
   - Queries live camera feed analytics, verifying lane blockage status, breakdown type, and visibility %.
2. **`query_available_units(police_station)`**:
   - Scans nearby Patrol Bikes, Interceptor Vans, and Heavy Tow Trucks for operational availability.
3. **`calculate_shortest_route(origin_coords, dest_coords)`**:
   - Applies **Dijkstra's Shortest Path Algorithm** over a NetworkX road graph of Bangalore junctions weighted by live congestion to find the fastest unit ETA (~24% faster than straight-line paths).
4. **`issue_signal_override(junction_name, duration_mins)`**:
   - Activates **Green Corridor** traffic signal priority for 15 minutes to clear traffic lights for incoming dispatch units.
5. **`broadcast_traffic_advisory(junction_name, alt_route)`**:
   - Sends public navigation alerts to VMS display boards, map apps (Google Maps/Waze), and Traffic FM radio during severe bottlenecks.

---

## 7. Operating the Command Dashboard & Live Simulation

Control Center Officers interact with the platform via the React + Leaflet Dashboard:
* **Interactive Map View**: Displays individual violation markers, continuous disruption heatmaps, and DBSCAN hotspot cluster circles.
* **Hourly Timeline Slider**: Slide through hours of the day ($00:00 - 23:00$) to observe temporal congestion shifts and peak hour clusters.
* **Layer Toggles**: Toggle individual map layers (Heatmap, Hotspots, Violations, Centroids).
* **Live Simulation Panel**: Officers can manually enter latitude, longitude, vehicle type, location type, and violation tags to run a simulated report through the full 4-stage AI cascade in real time.

---

## 8. Human-in-the-Loop (HITL) Override & Continuous DPO Alignment

When an incident prediction triggers low confidence ($P < 0.80$) or is flagged for **`ESCALATE`**, the **⚠️ HITL Officer Override Modal** pops up on the dispatcher's screen:

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

### Step-by-Step Officer Instructions:
1. **Review Telemetry & Tool Traces**: Check the CCTV visual status, Dijkstra route ETA, and Qwen reasoning.
2. **Option A — 1-Click Approval**: Click **Approve Qwen Action** to execute Qwen's recommendation immediately.
3. **Option B — Manual Override**: Click any alternative action button (`VERIFY`, `DISPATCH`, `RESOLVE`, `REJECT`, `ESCALATE`), type optional officer rationale notes, and click **Submit Override Decision**.
4. **Continuous DPO Alignment**: Every officer override automatically creates a Direct Preference Optimization (DPO) preference pair (`chosen` vs `rejected`). The background pipeline automatically micro-tunes Qwen 2.5 on these pairs, aligning the AI dispatcher with your team's real operational preferences over time!
