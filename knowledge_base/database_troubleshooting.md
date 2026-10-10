# Database Latency and Outage Troubleshooting

## Symptoms
- **Slowdown**: `response_time_ms` for `database` increases above 500ms. `WARN` logs for "Slow query execution".
- **Outage**: `active_connections` drops to 0. `FATAL` logs showing "Database connection dropped. Outage."

## Diagnostic Steps
1. Correlate with upstream services. `api-gateway`, `auth-service`, and `payment-service` all rely on the `database`.
2. A database slowdown will cascade, increasing response times across all upstream services.
3. An outage will cause massive HTTP 500 spikes at the `api-gateway`.

## Plausible Causes
- Missing indexes causing slow query execution (slowdown).
- Resource exhaustion or hardware failure (outage).

## Escalation
- Escalate to Tier 3 DBA on-call immediately.
