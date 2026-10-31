# Detectors

Every detector returns, per finding: rule_id, rule_version, score (0 to 1), reason (plain English
built from the template below), evidence (JSON), and the transaction ids involved.
Defaults live in rule_config.params and can be changed without code edits.

## 1. shared_infra (rule_id: shared_infra, version 1)
Definition: one device or phone linked to several distinct accounts.
Params: min_accounts=3
Logic: group accounts by device entity (and by phone); flag groups with >= min_accounts.
Score: min(1.0, 0.4 + 0.15 * (n_accounts - min_accounts + 1)).
Evidence: {"shared_type":"device|phone","shared_id","accounts":[ids],"account_count","txn_count_among_accounts"}
Reason template: "{n} accounts share the same {shared_type} ({shared_id}); shared hardware or contact details across accounts is a common sign of coordinated mule activity."

## 2. rapid_movement (rule_id: rapid_movement, version 1)
Definition: money received and sent onward quickly (pass-through).
Params: window_minutes=60, min_inflow=50000, pass_through_ratio=0.85
Logic: per account, for each inbound txn, sum outbound txns within window_minutes after it;
flag when outbound/inbound >= pass_through_ratio and inflow >= min_inflow.
Score: min(1.0, ratio * 0.6 + 0.4 * speed_factor) where speed_factor = 1 - (minutes_to_forward / window_minutes).
Evidence: {"account_id","inflow_total","outflow_total","ratio","minutes_to_forward","in_txns":[ids],"out_txns":[ids]}
Reason template: "Account {account} received {inflow} and forwarded {ratio_pct}% of it within {minutes} minutes, which is consistent with layering."

## 3. cycles (rule_id: cycles, version 1)
Definition: funds returning to the origin through a loop of accounts.
Params: min_len=3, max_len=6, window_hours=72, amount_tolerance=0.2
Logic: build a directed graph of SENT edges (NetworkX) within a time window; find simple cycles of
length min_len to max_len; keep cycles where hop amounts are within amount_tolerance of each other
and timestamps move forward in order.
Score: min(1.0, 0.5 + 0.1 * (6 - length) + 0.2 * amount_similarity).
Evidence: {"cycle":[account ids in order],"length","hops":[{"txn_id","from","to","amount","ts"}],"total_span_hours"}
Reason template: "Funds moved through a loop of {length} accounts ({path}) and returned to the start within {hours} hours, which suggests round-tripping."

## 4. fan_in_out (rule_id: fan_in_out, version 1)
Definition: many senders into one account (fan-in) or one account into many receivers (fan-out)
in a short time.
Params: min_counterparties=8, window_hours=24
Logic: count distinct counterparties per account inside a rolling window; compare to that
account's own historical average (z-score).
Score: min(1.0, 0.3 + 0.1 * z), where z = (count - mean) / std (use 3 if std is 0).
Evidence: {"account_id","direction":"in|out","counterparty_count","window_hours","baseline_mean","z_score","counterparties":[ids]}
Reason template: "Account {account} had {n} distinct {senders|receivers} in {window} hours, versus a usual average of {mean}; sudden fan-in or fan-out often marks collection or dispersal accounts."

## Combined scoring (services/detection/scoring.py)
final_score = sum(weight_i * rule_score_i) normalised to 0..1, then blended with the ML score
(see B4): final = 0.7 * rules + 0.3 * ml. Default weights: shared_infra 1.0, rapid_movement 1.0,
cycles 1.2, fan_in_out 0.8. Store the breakdown in the alert's score_breakdown.

## Testing
Plant these patterns in tests/ with a tiny DataFrame for each detector and assert:
1) the planted pattern is found, 2) the reason text contains the key numbers, 3) a normal
account is NOT flagged.
