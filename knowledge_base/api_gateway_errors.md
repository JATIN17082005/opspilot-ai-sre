# API Gateway HTTP 500 Error Rates

## Symptoms
- The `api-gateway` service exhibits an elevated `error_rate` metric (approaching 1.0).
- Frequent `ERROR` logs indicating "HTTP 500 Internal Server Error" or "Connection refused to database".

## Diagnostic Steps
1. Verify if the issue is isolated to the `api-gateway` or if downstream services are also alerting.
2. Check `api-gateway` dependencies: `payment-service`, `auth-service`, and `database`.
3. If `database` active connections are 0, this indicates a database outage cascading to the API layer.

## Plausible Causes
- Database outage (connection refused).
- Downstream `payment-service` timeout.

## Escalation
- If database is unresponsive, escalate to the DBA team.
