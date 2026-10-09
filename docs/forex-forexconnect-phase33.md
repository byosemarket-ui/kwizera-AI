# Phase 33 — ForexConnect connection service

## Architecture

```
Browser → Node gateway (:5173)
              ↓  private HTTP
         ForexConnect sidecar (127.0.0.1:5179)
              ↓  official SDK
         FXCM ForexConnect (Hosts.jsp)
```

- Sidecar never binds publicly.
- Node never accepts ForexConnect passwords from the browser.
- Trading remains disabled.

## Server environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `KWIZERA_FOREXCONNECT_ENABLED` | yes | `1` to enable |
| `KWIZERA_FOREXCONNECT_ENVIRONMENT` | yes | `demo` or `real` |
| `KWIZERA_FOREXCONNECT_USERNAME` | yes | Trading Station username |
| `KWIZERA_FOREXCONNECT_PASSWORD` | yes | Trading Station password |
| `KWIZERA_FOREXCONNECT_URL` | no | Default `https://www.fxcorporate.com/Hosts.jsp` |
| `KWIZERA_FOREXCONNECT_SIDECAR_PORT` | no | Default `5179` |

## VPS prerequisites

1. Sign FXCM Software EULA.
2. Install `python3` and a compatible `forexconnect` wheel for the host OS/arch.
3. Set credentials in `/opt/kwizera-ai/.env`.
4. Enable/start `kwizera-forexconnect.service`.
5. Use Admin → ForexConnect → Connect / Discover instruments.

## API

- `GET /api/forex/providers/forexconnect/status`
- `POST /api/forex/providers/forexconnect/connect`
- `POST /api/forex/providers/forexconnect/disconnect`
- `GET /api/forex/providers/forexconnect/instruments`

## Out of scope (later phases)

Historical candles, live streaming into Charts, order placement.
