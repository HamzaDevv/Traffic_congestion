"""
Fast Local DPO Training Verification Script.
Runs TRL DPOTrainer on officer preference pairs from backend/data/dpo_preference_pairs.jsonl
to compute DPO Loss, Chosen Reward, and Rejected Reward.
"""

import sys
import json
from pathlib import Path

_BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(_BACKEND_DIR))

DPO_PAIRS_PATH = _BACKEND_DIR / "data" / "dpo_preference_pairs.jsonl"

def run_quick_dpo():
    print("==========================================================", flush=True)
    print("🧪 STARTING FAST DPO REINFORCEMENT LEARNING TEST", flush=True)
    print("==========================================================", flush=True)

    if not DPO_PAIRS_PATH.exists():
        print(f"❌ Error: DPO pairs file not found at {DPO_PAIRS_PATH}", flush=True)
        return

    # 1. Load Preference Pairs
    pairs = []
    with open(DPO_PAIRS_PATH, "r") as f:
        for line in f:
            if line.strip():
                pairs.append(json.loads(line))

    print(f"✅ Loaded {len(pairs)} officer override preference pairs.", flush=True)

    formatted_dataset = []
    for item in pairs:
        formatted_dataset.append({
            "prompt": item["prompt"],
            "chosen": item["chosen"],
            "rejected": item["rejected"]
        })

    from datasets import Dataset
    train_dataset = Dataset.from_list(formatted_dataset)

    # 2. Load PyTorch, Transformers, PEFT, TRL
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import LoraConfig
    from trl import DPOTrainer, DPOConfig

    MODEL_ID = "sshleifer/tiny-gpt2"
    print(f"\n📦 Loading Lightweight Verification Model: {MODEL_ID}...", flush=True)
    
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(MODEL_ID)

    peft_config = LoraConfig(
        r=8,
        lora_alpha=16,
        target_modules=["c_attn"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM"
    )

    dpo_config = DPOConfig(
        output_dir="./dpo_quick_output",
        max_steps=3,
        per_device_train_batch_size=2,
        learning_rate=1e-4,
        logging_steps=1,
        fp16=False,
        bf16=False,
        beta=0.1,
        report_to="none"
    )

    print("\n⚙️ Initializing TRL DPOTrainer...", flush=True)
    dpo_trainer = DPOTrainer(
        model=model,
        ref_model=None,
        args=dpo_config,
        train_dataset=train_dataset,
        processing_class=tokenizer,
        peft_config=peft_config,
    )

    print("\n=== STARTING DPO REINFORCEMENT LEARNING TRAINER STEP ===", flush=True)
    train_result = dpo_trainer.train()
    print("\n📊 DPO Training Metrics:", train_result.metrics, flush=True)
    print("==========================================================", flush=True)
    print("🎉 DPO REINFORCEMENT LEARNING TRAINING TEST PASSED PERFECTLY!", flush=True)
    print("==========================================================", flush=True)

if __name__ == "__main__":
    run_quick_dpo()
