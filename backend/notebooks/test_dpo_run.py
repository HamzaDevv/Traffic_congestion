"""
Local DPO Retraining Test Execution Script.
Tests DPOTrainer on accumulated human officer preference pairs from backend/data/dpo_preference_pairs.jsonl.
"""

import sys
import json
from pathlib import Path

_BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(_BACKEND_DIR))

DPO_PAIRS_PATH = _BACKEND_DIR / "data" / "dpo_preference_pairs.jsonl"
HF_TOKEN = os.environ.get("HF_TOKEN")

def run_dpo_test():
    print("==========================================================", flush=True)
    print("🧪 STARTING DPO REINFORCEMENT LEARNING TRAINING TEST", flush=True)
    print("==========================================================", flush=True)

    if not DPO_PAIRS_PATH.exists():
        print(f"❌ Error: DPO pairs file not found at {DPO_PAIRS_PATH}")
        return

    # 1. Load Preference Pairs
    pairs = []
    with open(DPO_PAIRS_PATH, "r") as f:
        for line in f:
            if line.strip():
                pairs.append(json.loads(line))

    print(f"✅ Loaded {len(pairs)} officer override preference pairs from {DPO_PAIRS_PATH}")

    formatted_dataset = []
    for item in pairs:
        formatted_dataset.append({
            "prompt": item["prompt"],
            "chosen": item["chosen"],
            "rejected": item["rejected"]
        })

    from datasets import Dataset
    train_dataset = Dataset.from_list(formatted_dataset)
    print(f"✅ Dataset prepared with columns: {train_dataset.column_names}")

    # 2. Load PyTorch, Transformers, PEFT, TRL
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import LoraConfig
    from trl import DPOTrainer, DPOConfig

    MODEL_ID = "Qwen/Qwen2.5-0.5B-Instruct"
    print(f"\n📦 Loading Tokenizer and Base Model: {MODEL_ID}...")
    
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, token=HF_TOKEN)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"🎯 Execution Target Device: {device.upper()}")

    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        dtype=torch.float32 if device == "cpu" else torch.float16,
        device_map=device,
        token=HF_TOKEN
    )

    peft_config = LoraConfig(
        r=8,
        lora_alpha=16,
        target_modules=["q_proj", "v_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM"
    )

    dpo_config = DPOConfig(
        output_dir="./dpo_test_output",
        max_steps=2,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=1,
        learning_rate=1e-5,
        logging_steps=1,
        fp16=False,
        bf16=False,
        beta=0.1,
        report_to="none"
    )

    print("\n⚙️ Initializing TRL DPOTrainer...")
    dpo_trainer = DPOTrainer(
        model=model,
        ref_model=None,
        args=dpo_config,
        train_dataset=train_dataset,
        processing_class=tokenizer,
        peft_config=peft_config,
    )

    print("\n=== STARTING DPO REINFORCEMENT LEARNING TRAINER STEP ===")
    dpo_trainer.train()
    print("==========================================================")
    print("🎉 DPO REINFORCEMENT LEARNING TRAINING TEST PASSED PERFECTLY!")
    print("==========================================================")

if __name__ == "__main__":
    run_dpo_test()
