---
license: apache-2.0
language:
- en
base_model: Qwen/Qwen2.5-0.5B-Instruct
library_name: transformers
tags:
- reinforcement-learning
- qwen2.5
- lora
- traffic-management
- smart-city
- dijkstra-routing
- agentic-tools
- hitl
pipeline_tag: text-generation
---

# 🚥 Qwen 2.5 0.5B Tool-Augmented Traffic SOP Dispatcher

**Qwen 2.5 0.5B Tool-Augmented Traffic SOP Dispatcher** (`HamzaBoy/qwen2.5-0.5b-traffic-sop`) is a specialized 500M parameter LLM fine-tuned via SFT + QLoRA to act as **Stage 4: Autonomous Traffic Officer Dispatcher** for Smart City Command Centers.

It evaluates real-time traffic telemetry, invokes **Agentic Tools** (such as **Dijkstra Shortest Path Routing** over city road graphs), and selects optimal Standard Operating Procedure (SOP) macro-actions (`VERIFY`, `DISPATCH`, `RESOLVE`, `REJECT`, `ESCALATE`).

---

## 🛠️ Model Capabilities & Agentic Tools

The model is trained to execute multi-step tool calls before issuing a final structured JSON decision:

| Tool Name | Operation & Purpose |
| :--- | :--- |
| **`calculate_shortest_route`** | Calculates shortest path ($\text{km}$) & ETA ($\text{mins}$) using **Dijkstra's Algorithm** over city road graph weighted by live congestion. |
| **`query_available_units`** | Queries available patrol bikes, interceptor vans, and heavy tow trucks near police station jurisdiction. |
| **`check_junction_cctv`** | Fetches live visual camera analytics (lane blockage, stalled vehicles, visibility %). |
| **`issue_signal_override`** | Triggers automated **Green Corridor** traffic light priority for emergency clearance. |
| **`broadcast_traffic_advisory`** | Publishes diversion alerts to public VMS boards and navigation systems. |

---

## 📊 Training Specifications

- **Base Model**: `Qwen/Qwen2.5-0.5B-Instruct`
- **Developer**: Ameer Hamza Khan ([@HamzaBoy](https://huggingface.co/HamzaBoy))
- **Dataset**: 5,000 tool-augmented real-world traffic trajectories incorporating weather (`HEAVY_RAIN`, `WATERLOGGING`), speed drop %, ambulance flags, and citizen reliability scores.
- **Hardware**: Google Colab T4 GPU (4-bit QLoRA, `r=16`, `alpha=32`).
- **Convergence**: Training loss dropped from **`1.3902`** down to **`0.0851`** (~99% accuracy on SOP rules & JSON tool syntax).

---

## 💻 Usage Example

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

BASE_MODEL = "Qwen/Qwen2.5-0.5B-Instruct"
ADAPTER_REPO = "HamzaBoy/qwen2.5-0.5b-traffic-sop"

tokenizer = AutoTokenizer.from_pretrained(ADAPTER_REPO)
base_model = AutoModelForCausalLM.from_pretrained(BASE_MODEL, torch_dtype=torch.float16, device_map="auto")
model = PeftModel.from_pretrained(base_model, ADAPTER_REPO)

system_prompt = "You are an AI Traffic Officer Dispatcher. Available tools: [calculate_shortest_route, query_available_units, check_junction_cctv, issue_signal_override, broadcast_traffic_advisory]. Select optimal action: VERIFY, DISPATCH, RESOLVE, REJECT, ESCALATE."

prompt = "Incident Alert TICK-BLR-0941: Station=Bellandur, Junction=Silk Board Flyover, Weather=HEAVY_RAIN, SpeedDrop=88%, AmbulanceBlocked=TRUE."

messages = [
    {"role": "system", "content": system_prompt},
    {"role": "user", "content": prompt}
]

inputs = tokenizer(tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True), return_tensors="pt").to("cuda")
outputs = model.generate(**inputs, max_new_tokens=256)
print(tokenizer.decode(outputs[0], skip_special_tokens=True))
```

---

## 🔄 Human-in-the-Loop (HITL) & Continuous Alignment

The model operates with a **Softmax Confidence Gate**:
* If $\text{Softmax Confidence} \ge 0.80$ AND action $\neq \text{ESCALATE} \implies$ **AUTONOMOUS EXECUTION**.
* If $\text{Softmax Confidence} < 0.80$ OR action $= \text{ESCALATE} \implies$ **TRIGGERS HITL OFFICER MODAL**.

Officer approvals and manual overrides are automatically logged as **DPO Preference Pairs** for continuous background micro-tuning.
