"""
Agentic Tools Module for Traffic Dispatcher Agent.
Implements Dijkstra Shortest Path routing over Bangalore road network,
fleet query simulation, live CCTV visual checks, signal overrides, and advisory broadcasts.
"""

import math
import random
import networkx as nx
from typing import Dict, List, Any, Tuple, Optional

# Major Bangalore Traffic Junctions & Coordinates (Lat, Lon)
BANGALORE_NODES = {
    "Madiwala": (12.9255, 77.6186),
    "Bellandur": (12.9054, 77.7007),
    "Koramangala": (12.9352, 77.6245),
    "Silk Board": (12.9172, 77.6228),
    "HSR Layout": (12.9121, 77.6446),
    "Electronic City": (12.8452, 77.6602),
    "Indiranagar": (12.9784, 77.6408),
    "Byatarayanapura": (12.9565, 77.5186),
    "Whitefield": (12.9698, 77.7499),
    "Hebbal": (13.0358, 77.5970),
    "Cubbon Park": (12.9738, 77.5937),
    "Majestic": (12.9767, 77.5713),
}

def haversine_distance(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    """Calculate Haversine distance in kilometers between two lat/lon pairs."""
    lat1, lon1 = coord1
    lat2, lon2 = coord2
    R = 6371.0  # Earth radius in kilometers

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

class BangaloreRoadNetwork:
    """Graph representation of key Bangalore traffic arteries with Dijkstra routing."""
    
    def __init__(self):
        self.graph = nx.Graph()
        self._build_graph()
        
    def _build_graph(self):
        # Add nodes with lat/lon attributes
        for name, coords in BANGALORE_NODES.items():
            self.graph.add_node(name, pos=coords)
            
        # Define connected road corridors with base distances (km)
        corridors = [
            ("Silk Board", "Madiwala", 1.8),
            ("Silk Board", "HSR Layout", 2.5),
            ("Silk Board", "Electronic City", 11.2),
            ("Madiwala", "Koramangala", 2.2),
            ("HSR Layout", "Bellandur", 4.1),
            ("Koramangala", "Indiranagar", 4.8),
            ("Bellandur", "Whitefield", 9.5),
            ("Indiranagar", "Cubbon Park", 4.2),
            ("Cubbon Park", "Majestic", 2.5),
            ("Majestic", "Byatarayanapura", 6.8),
            ("Cubbon Park", "Hebbal", 8.4),
            ("Byatarayanapura", "Hebbal", 9.1),
            ("Bellandur", "Koramangala", 5.2),
        ]
        
        for u, v, dist in corridors:
            self.graph.add_edge(u, v, weight=dist)

    def find_nearest_node(self, coords: Tuple[float, float]) -> str:
        """Find the closest graph junction node to given lat/lon coordinates."""
        closest_node = "Silk Board"
        min_dist = float("inf")
        for node, n_coords in BANGALORE_NODES.items():
            d = haversine_distance(coords, n_coords)
            if d < min_dist:
                min_dist = d
                closest_node = node
        return closest_node

    def calculate_shortest_route(
        self,
        origin_coords: Tuple[float, float],
        dest_coords: Tuple[float, float],
        congestion_factor: float = 1.0
    ) -> Dict[str, Any]:
        """
        Uses Dijkstra's algorithm to compute shortest path and ETA.
        Adjusts ETA based on the live congestion factor (1.0 = normal, 2.0 = heavy delay).
        """
        start_node = self.find_nearest_node(origin_coords)
        end_node = self.find_nearest_node(dest_coords)

        try:
            path = nx.dijkstra_path(self.graph, start_node, end_node, weight="weight")
            base_distance_km = nx.dijkstra_path_length(self.graph, start_node, end_node, weight="weight")
            
            # Add off-graph distance to actual coords
            start_off = haversine_distance(origin_coords, BANGALORE_NODES[start_node])
            end_off = haversine_distance(dest_coords, BANGALORE_NODES[end_node])
            total_distance_km = round(base_distance_km + start_off + end_off, 2)
            
            # Base speed 30 km/h, adjusted by congestion factor
            effective_speed_kmh = max(10.0, 30.0 / congestion_factor)
            eta_mins = round((total_distance_km / effective_speed_kmh) * 60, 1)

            return {
                "status": "SUCCESS",
                "origin_node": start_node,
                "dest_node": end_node,
                "path": path,
                "distance_km": total_distance_km,
                "eta_mins": eta_mins,
                "congestion_factor": congestion_factor,
            }
        except nx.NetworkXNoPath:
            direct_dist = haversine_distance(origin_coords, dest_coords)
            return {
                "status": "FALLBACK_DIRECT",
                "origin_node": start_node,
                "dest_node": end_node,
                "path": [start_node, end_node],
                "distance_km": direct_dist,
                "eta_mins": round((direct_dist / 20.0) * 60, 1),
                "congestion_factor": congestion_factor,
            }

# Initialize global road network singleton
ROAD_NETWORK = BangaloreRoadNetwork()


# Tool Functions Exposed to the Agentic System

def tool_calculate_shortest_route(
    origin_coords: List[float],
    dest_coords: List[float],
    congestion_factor: float = 1.0
) -> Dict[str, Any]:
    """Tool: Calculate shortest route and ETA using Dijkstra's algorithm on road graph."""
    return ROAD_NETWORK.calculate_shortest_route(
        (origin_coords[0], origin_coords[1]),
        (dest_coords[0], dest_coords[1]),
        congestion_factor
    )

def tool_query_available_units(
    police_station: str,
    max_radius_km: float = 5.0
) -> Dict[str, Any]:
    """Tool: Query available patrol bikes, interceptors, and heavy tow trucks near station."""
    station_coords = BANGALORE_NODES.get(police_station, (12.9255, 77.6186))
    
    # Deterministic seed based on station name length for realistic simulation
    seed_val = sum(ord(c) for c in police_station)
    rng = random.Random(seed_val)
    
    unit_types = ["HEAVY_TOW_TRUCK", "PATROL_BIKE", "INTERCEPTOR_VAN"]
    units = []
    
    for i in range(1, 4):
        u_type = unit_types[i - 1]
        offset_lat = (rng.random() - 0.5) * 0.03
        offset_lon = (rng.random() - 0.5) * 0.03
        u_coords = (round(station_coords[0] + offset_lat, 4), round(station_coords[1] + offset_lon, 4))
        dist = haversine_distance(station_coords, u_coords)
        
        if dist <= max_radius_km:
            units.append({
                "unit_id": f"{police_station.upper()[:3]}_{u_type[:3]}_{i:02d}",
                "unit_type": u_type,
                "status": "AVAILABLE" if i <= 2 else "BUSY",
                "coords": list(u_coords),
                "distance_km": dist,
            })
            
    return {
        "police_station": police_station,
        "available_units_count": len([u for u in units if u["status"] == "AVAILABLE"]),
        "units": units
    }

def tool_check_junction_cctv(junction_name: str) -> Dict[str, Any]:
    """Tool: Check live camera feed for lane blockages, stalled vehicles, and visibility."""
    seed_val = sum(ord(c) for c in junction_name)
    rng = random.Random(seed_val)
    
    breakdown_types = ["STALLED_BUS", "ACCIDENT_MULTI_VEHICLE", "ILLEGAL_PARKING_CLUSTER", "CLEAR"]
    b_type = rng.choice(breakdown_types)
    lane_blocked = b_type != "CLEAR"
    
    return {
        "junction_name": junction_name,
        "cctv_status": "ONLINE",
        "lane_blocked": lane_blocked,
        "breakdown_type": b_type,
        "visibility_pct": round(rng.uniform(85.0, 99.0), 1),
        "active_vehicle_density": "HIGH" if lane_blocked else "NORMAL"
    }

def tool_issue_signal_override(junction_name: str, duration_mins: int = 15) -> Dict[str, Any]:
    """Tool: Activate Green Corridor signal priority at junction for emergency clearance."""
    return {
        "status": "SUCCESS",
        "junction_name": junction_name,
        "override_mode": "GREEN_CORRIDOR_PRIORITY",
        "active_duration_mins": duration_mins,
        "message": f"Signal priority override engaged at {junction_name} for {duration_mins} minutes."
    }

def tool_broadcast_traffic_advisory(junction_name: str, alt_route: str) -> Dict[str, Any]:
    """Tool: Broadcast public traffic diversion alert to navigation apps and VMS boards."""
    return {
        "status": "SUCCESS",
        "junction_name": junction_name,
        "advisory_type": "PUBLIC_DIVERSION_NOTICE",
        "recommended_alt_route": alt_route,
        "channels_notified": ["VMS_BOARDS", "NAVIGATION_PARTNERS", "TRAFFIC_FM"]
    }


# Tool Dispatcher Registry Map
ALL_TOOLS = {
    "calculate_shortest_route": tool_calculate_shortest_route,
    "query_available_units": tool_query_available_units,
    "check_junction_cctv": tool_check_junction_cctv,
    "issue_signal_override": tool_issue_signal_override,
    "broadcast_traffic_advisory": tool_broadcast_traffic_advisory,
}

def execute_tool_call(tool_name: str, tool_args: Dict[str, Any]) -> Dict[str, Any]:
    """Safely execute a tool call by name and dictionary arguments."""
    if tool_name not in ALL_TOOLS:
        return {"status": "ERROR", "message": f"Unknown tool: {tool_name}"}
    try:
        fn = ALL_TOOLS[tool_name]
        return fn(**tool_args)
    except Exception as e:
        return {"status": "ERROR", "message": f"Tool execution failed: {str(e)}"}
