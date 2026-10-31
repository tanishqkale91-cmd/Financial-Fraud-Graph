"""
generate_data.py — Creates synthetic transaction data for dev/testing.

Produces two CSV files:
  - transactions.csv    (~30 000 rows, with fraud patterns planted)
  - account_attributes.csv  (account metadata)

Planted patterns (the "Pattern" column is the ground-truth answer key):
  CIRCULAR    : Ring A→B→C→A within a short window
  PASSTHROUGH : Chain A→B→C where B passes ≥95% within 60 s (mule chain)
  SHARED_DEVICE: ≥10 accounts share the same device_id
  NORMAL      : Legitimate random transactions

Run: python generate_data.py
Output files go to the same directory as this script.

NOTE: All data is 100% synthetic.
"""

import random
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

# Seed for reproducibility
RANDOM_SEED = 42
random.seed(RANDOM_SEED)

# ── Output paths ──────────────────────────────────────────────────────────────
OUT_DIR = Path(__file__).parent          # same folder as this script
TXN_FILE = OUT_DIR / "transactions.csv"
ACC_FILE  = OUT_DIR / "account_attributes.csv"

# ── Volume knobs ──────────────────────────────────────────────────────────────
N_NORMAL_ACCOUNTS  = 500
N_NORMAL_TXNS      = 28_000   # bulk of the data

N_CIRCULAR_RINGS   = 40       # planted circular transfer rings
RING_SIZE_RANGE    = (3, 6)   # accounts per ring

N_PASSTHROUGH_CHAINS = 60     # mule chains
CHAIN_LENGTH_RANGE   = (3, 5)

N_SHARED_DEVICE_GROUPS = 15   # groups that share a device
ACCOUNTS_PER_GROUP     = (10, 20)

BASE_TIME = datetime(2024, 1, 1, 0, 0, 0)


# ── Helpers ────────────────────────────────────────────────────────────────────
def new_id() -> str:
    return str(uuid.uuid4())[:8]       # short 8-char ID for readability


def rand_amount(lo=50.0, hi=50_000.0) -> float:
    return round(random.uniform(lo, hi), 2)


def rand_time(base: datetime, window_hours: int = 365 * 24) -> datetime:
    return base + timedelta(seconds=random.randint(0, window_hours * 3600))


def rand_phone() -> str:
    return f"+1{random.randint(2000000000, 9999999999)}"


def rand_device() -> str:
    return f"DEV-{random.randint(1000, 9999)}"


# ── Account factory ────────────────────────────────────────────────────────────
BANKS = ["BankAlpha", "BankBeta", "BankGamma", "BankDelta", "BankOmega"]

def make_account(
    acc_id: str | None = None,
    phone: str | None = None,
    device_id: str | None = None,
) -> dict:
    return {
        "account_id": acc_id or new_id(),
        "name": f"User-{new_id()}",
        "bank": random.choice(BANKS),
        "phone": phone or rand_phone(),
        "device_id": device_id or rand_device(),
    }


# ── Transaction factory ────────────────────────────────────────────────────────
def make_txn(
    sender_id: str,
    receiver_id: str,
    amount: float,
    ts: datetime,
    pattern: str,
    source_row: int,
) -> dict:
    return {
        "txn_id":     new_id(),
        "sender_id":  sender_id,
        "receiver_id": receiver_id,
        "amount":     amount,
        "currency":   "USD",
        "timestamp":  ts.strftime("%Y-%m-%d %H:%M:%S"),
        "pattern":    pattern,
        "source_file": "transactions.csv",
        "source_row":  source_row,
    }


# ==============================================================================
# 1. Normal accounts + transactions
# ==============================================================================
def generate_normal(accounts: list[dict]) -> list[dict]:
    """Random transactions between normal accounts."""
    print(f"  Generating {N_NORMAL_TXNS} normal transactions...")
    txns = []
    for i in range(N_NORMAL_TXNS):
        s, r = random.sample(accounts, 2)
        ts = rand_time(BASE_TIME)
        txns.append(make_txn(
            s["account_id"], r["account_id"],
            rand_amount(), ts, "NORMAL", i + 1
        ))
    return txns


# ==============================================================================
# 2. Circular rings   A→B→C→A  (same amount, close timestamps)
# ==============================================================================
def generate_circular(accounts: list[dict]) -> tuple[list[dict], list[dict]]:
    """Plant circular transfer rings. Returns new accounts + transactions."""
    print(f"  Generating {N_CIRCULAR_RINGS} circular rings...")
    new_accs, txns = [], []
    row = 0
    for _ in range(N_CIRCULAR_RINGS):
        size = random.randint(*RING_SIZE_RANGE)
        ring = [make_account() for _ in range(size)]
        new_accs.extend(ring)

        amount = rand_amount(5_000, 30_000)
        start_ts = rand_time(BASE_TIME, window_hours=300 * 24)

        for i in range(size):
            sender   = ring[i]
            receiver = ring[(i + 1) % size]
            ts = start_ts + timedelta(minutes=random.randint(1, 30))
            # Each hop reduces by a tiny fee to look less obvious
            hop_amount = round(amount * random.uniform(0.97, 1.0), 2)
            txns.append(make_txn(
                sender["account_id"], receiver["account_id"],
                hop_amount, ts, "CIRCULAR", row
            ))
            row += 1

    return new_accs, txns


# ==============================================================================
# 3. Pass-through (mule) chains   A→B→C  B passes ≥95% within 60 s
# ==============================================================================
def generate_passthrough(accounts: list[dict]) -> tuple[list[dict], list[dict]]:
    """Plant layered pass-through / mule chains."""
    print(f"  Generating {N_PASSTHROUGH_CHAINS} pass-through chains...")
    new_accs, txns = [], []
    row = 0
    for _ in range(N_PASSTHROUGH_CHAINS):
        length = random.randint(*CHAIN_LENGTH_RANGE)
        chain  = [make_account() for _ in range(length)]
        new_accs.extend(chain)

        amount = rand_amount(10_000, 80_000)
        start_ts = rand_time(BASE_TIME, window_hours=300 * 24)

        for i in range(length - 1):
            # Each middle node keeps at most 5%
            pass_pct = random.uniform(0.95, 0.99)
            ts = start_ts + timedelta(seconds=random.randint(5, 55))
            txns.append(make_txn(
                chain[i]["account_id"], chain[i + 1]["account_id"],
                round(amount, 2), ts, "PASSTHROUGH", row
            ))
            amount = round(amount * pass_pct, 2)
            start_ts = ts
            row += 1

    return new_accs, txns


# ==============================================================================
# 4. Shared-device clusters
# ==============================================================================
def generate_shared_device(accounts: list[dict]) -> tuple[list[dict], list[dict]]:
    """
    Create groups where many accounts share one device_id.
    These accounts also transact with each other to appear in the graph.
    """
    print(f"  Generating {N_SHARED_DEVICE_GROUPS} shared-device groups...")
    new_accs, txns = [], []
    row = 0
    for _ in range(N_SHARED_DEVICE_GROUPS):
        shared_dev = rand_device()
        shared_phone = rand_phone()
        n_accs = random.randint(*ACCOUNTS_PER_GROUP)
        group = [make_account(device_id=shared_dev, phone=shared_phone) for _ in range(n_accs)]
        new_accs.extend(group)

        # These accounts transact with random normal accounts
        for acc in group:
            target = random.choice(accounts)
            ts = rand_time(BASE_TIME)
            txns.append(make_txn(
                acc["account_id"], target["account_id"],
                rand_amount(100, 5_000), ts, "SHARED_DEVICE", row
            ))
            row += 1

    return new_accs, txns


# ==============================================================================
# Main
# ==============================================================================
def main():
    print("=" * 50)
    print("Financial Fraud Graph — Data Generator")
    print("=" * 50)

    # 1. Base normal accounts
    print("\n[1/5] Creating normal accounts...")
    normal_accounts = [make_account() for _ in range(N_NORMAL_ACCOUNTS)]

    # 2. Planted patterns
    print("\n[2/5] Planting fraud patterns...")
    circ_accs,   circ_txns   = generate_circular(normal_accounts)
    pass_accs,   pass_txns   = generate_passthrough(normal_accounts)
    dev_accs,    dev_txns    = generate_shared_device(normal_accounts)

    # 3. Normal transactions (bulk)
    print("\n[3/5] Generating normal transactions...")
    normal_txns = generate_normal(normal_accounts)

    # 4. Combine
    print("\n[4/5] Combining and shuffling...")
    all_accounts = normal_accounts + circ_accs + pass_accs + dev_accs
    all_txns     = normal_txns + circ_txns + pass_txns + dev_txns

    # Shuffle transactions so patterns aren't all at the bottom
    random.shuffle(all_txns)

    # 5. Save CSVs
    print("\n[5/5] Writing CSV files...")
    acc_df = pd.DataFrame(all_accounts).drop_duplicates(subset=["account_id"])
    txn_df = pd.DataFrame(all_txns)

    acc_df.to_csv(ACC_FILE, index=False)
    txn_df.to_csv(TXN_FILE, index=False)

    # ── Summary ────────────────────────────────────────────────────────────────
    print("\n" + "=" * 50)
    print("DONE!")
    print(f"  accounts      : {len(acc_df):>7,}  ->  {ACC_FILE.name}")
    print(f"  transactions  : {len(txn_df):>7,}  ->  {TXN_FILE.name}")
    print()
    print("Pattern breakdown (transactions):")
    print(txn_df["pattern"].value_counts().to_string())
    print("=" * 50)


if __name__ == "__main__":
    main()
