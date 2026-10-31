"""
generate_enriched_csv.py — Pure Python implementation of prepare_csv.py.
Cleans HI-Small_50k_enriched.csv and plants demo fraud patterns.
"""
import csv
import hashlib
import random
import os
from pathlib import Path


def phone_for(acct: str, noisy_rng: random.Random) -> str:
    n = int(hashlib.md5(acct.encode()).hexdigest(), 16) % 10**9
    p = f"9{n:09d}"
    r = noisy_rng.random()
    return f"+91 {p[:5]} {p[5:]}" if r < 0.1 else (f"91{p}" if r < 0.15 else p)


def main():
    root = Path(__file__).resolve().parents[2]
    input_path = root / "data" / "raw" / "HI-Small_50k_enriched.csv"
    output_path = root / "data" / "processed" / "transactions_enriched.csv"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    rng = random.Random(42)

    with open(input_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    for r in rows:
        r["Sender_phone"] = phone_for(r["Account"], rng)

    planted = []

    def add(ts, frm, to, amt, ring, dev=None, phone=None, name="Planted Mule"):
        row = {c: "" for c in fieldnames}
        row.update({
            "Timestamp": ts,
            "From Bank": "900",
            "Account": frm,
            "To Bank": "901",
            "Account.1": to,
            "Amount Received": f"{amt:.2f}",
            "Receiving Currency": "US Dollar",
            "Amount Paid": f"{amt:.2f}",
            "Payment Currency": "US Dollar",
            "Payment Format": "Wire",
            "Is Laundering": "1",
            "Sender_name": name,
            "Sender_device": dev or f"DEV_P{int(hashlib.md5(frm.encode()).hexdigest(), 16) % 10**6:06d}",
            "Sender_phone": phone or phone_for(frm, rng),
            "Sender_ip": f"10.9.{rng.randint(0, 255)}.{rng.randint(1, 254)}",
            "Beneficiary_id": f"BEN_{to}",
            "Beneficiary_name": name,
            "source_file": "planted_demo",
            "source_row": str(len(planted)),
            "planted_ring_id": str(ring),
        })
        planted.append(row)

    # Ring 1: shared infra (5 accounts, one device, one phone)
    for i in range(5):
        acct = f"PLANT1{i:02d}"
        v_name = "Ravi Vermaa" if i == 2 else "Ravi Verma"
        add(
            f"01-09-2022 00:{10+i:02d}",
            acct,
            "PLANTSINK1",
            9000 + i * 100,
            1,
            dev="DEV_SHARED_01",
            phone="9876500001",
            name=v_name,
        )

    # Ring 2: rapid pass-through
    add("01-09-2022 00:05", "PLANTSRC2", "PLANTMID2", 250000, 2)
    add("01-09-2022 00:11", "PLANTMID2", "PLANTOUT2", 241000, 2)

    # Ring 3: circular transfer
    cyc = ["PLANTCYC1", "PLANTCYC2", "PLANTCYC3", "PLANTCYC4"]
    for i in range(4):
        add(f"01-09-2022 00:{15+i*3:02d}", cyc[i], cyc[(i+1) % 4], 60000 - i * 1500, 3)

    # Ring 4: fan-in
    for i in range(12):
        add(f"01-09-2022 00:{20+i:02d}", f"PLANTFAN{i:02d}", "PLANTCOLL4", 4000 + i * 50, 4)

    all_rows = rows + planted

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_rows)

    self_txns = sum(1 for r in all_rows if r.get("Account") == r.get("Account.1"))
    laundering = sum(1 for r in all_rows if r.get("Is Laundering") == "1")

    print(f"Total rows: {len(all_rows)} (raw: {len(rows)}, planted: {len(planted)})")
    print(f"Self-transfers: {self_txns}")
    print(f"Laundering rows: {laundering}")


if __name__ == "__main__":
    main()

