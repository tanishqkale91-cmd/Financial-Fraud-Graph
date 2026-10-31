"""Clean HI-Small_50k_enriched.csv and plant demo fraud patterns (synthetic, disclosed)."""
import argparse, hashlib, random
import pandas as pd

def phone_for(acct: str, noisy_rng: random.Random) -> str:
    n = int(hashlib.md5(acct.encode()).hexdigest(), 16) % 10**9
    p = f"9{n:09d}"
    r = noisy_rng.random()
    return f"+91 {p[:5]} {p[5:]}" if r < 0.1 else (f"91{p}" if r < 0.15 else p)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--seed", type=int, default=42)
    a = ap.parse_args()
    rng = random.Random(a.seed)
    df = pd.read_csv(a.input, dtype=str)

    # Phones were corrupted to scientific notation: regenerate per account.
    df["Sender_phone"] = [phone_for(x, rng) for x in df["Account"]]

    cols = list(df.columns)
    rows = []
    def add(ts, frm, to, amt, ring, dev=None, phone=None, name="Planted Mule"):
        rows.append({**{c: "" for c in cols},
            "Timestamp": ts, "From Bank": "900", "Account": frm, "To Bank": "901", "Account.1": to,
            "Amount Received": f"{amt:.2f}", "Receiving Currency": "US Dollar",
            "Amount Paid": f"{amt:.2f}", "Payment Currency": "US Dollar", "Payment Format": "Wire",
            "Is Laundering": "1", "Sender_name": name,
            "Sender_device": dev or f"DEV_P{int(hashlib.md5(frm.encode()).hexdigest(),16)%10**6:06d}",
            "Sender_phone": phone or phone_for(frm, rng),
            "Sender_ip": f"10.9.{rng.randint(0,255)}.{rng.randint(1,254)}",
            "Beneficiary_id": f"BEN_{to}", "Beneficiary_name": name,
            "source_file": "planted_demo", "source_row": str(len(rows)), "planted_ring_id": str(ring)})

    # Ring 1: shared infrastructure (5 accounts, one device, one phone)
    for i, acct in enumerate([f"PLANT1{i:02d}" for i in range(5)]):
        add(f"01-09-2022 00:{10+i:02d}", acct, "PLANTSINK1", 9000 + i * 100, 1,
            dev="DEV_SHARED_01", phone="9876500001", name=f"Ravi Verma{'a' if i==2 else ''}")
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

    out = pd.concat([df, pd.DataFrame(rows)], ignore_index=True)
    out.to_csv(a.output, index=False)
    print(f"rows: {len(out)} (planted {len(rows)})")
    print("self-transfers (flagged by validation):", (out['Account'] == out['Account.1']).sum())
    print("laundering rows:", (out['Is Laundering'] == '1').sum())

if __name__ == "__main__":
    main()
