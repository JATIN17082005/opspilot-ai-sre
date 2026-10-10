# Service Dependency Documentation

## Overview
This document outlines the dependencies for the OpsPilot demo environment.

## Architecture
- **api-gateway**: The entry point for all client requests. It calls `payment-service`, `auth-service`, and `database` directly depending on the route.
- **payment-service**: Handles checkout flows. It synchronously calls the `database` to verify stock and commit transactions.
- **auth-service**: Validates user tokens. It calls the `database` to check session validity.
- **database**: The core persistence layer. It has no downstream dependencies.

## Failure Propagation
- If `database` fails, all other services will fail or slow down.
- If `payment-service` fails, `api-gateway` checkout routes will fail, but `auth-service` remains unaffected.
