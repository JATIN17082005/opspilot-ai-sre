# Slow Application Responses

## Symptoms
- `response_time_ms` for `payment-service` and `api-gateway` spikes to over 800ms.
- `WARN` logs stating "High latency detected" in these services.

## Diagnostic Steps
1. Determine which service first experienced the latency spike.
2. The `api-gateway` routes checkout requests to the `payment-service`.
3. If `payment-service` latency spikes, `api-gateway` latency will naturally rise due to waiting on the synchronous call.
4. Check if the `database` is also slow. If not, the issue is isolated to the `payment-service` compute resources or external payment provider.

## Plausible Causes
- Third-party payment gateway delay.
- Exhausted thread pool in `payment-service`.

## Safe Checks
- Restart `payment-service` instances one by one.
