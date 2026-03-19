# Bankr Router v0.8.1 Release Notes

**Version:** 0.8.1  
**Date:** 2026-03-19  
**Commit:** 607240f  
**Tag:** v0.8.1

## Summary
Hotfix for v0.8.0: structured request logging severity and abort classification.

## Fixes in v0.8.1

### Successful 200 logs now emit at info level
- Previously: 2xx responses logged to stderr (OpenClaw ERROR entries)
- Now: 2xx → `console.log` (info level)
- Retryable failures → `console.warn`
- Final failures → `console.error`

### Abort sources explicitly classified
- `upstream_fetch_aborted`
- `client_disconnected`
- `stream_cancelled`
- `request_timeout`
- `openclaw_cancellation`

### Clean client disconnects no longer treated as router failures
- Client disconnects after response started → `warn`, not `error`
- Only mark request failed if upstream never completed successfully

---

## v0.8.0 Features (full)
- Streaming support (`stream: true` passthrough)
- Config cache (5s TTL with mtime invalidation)
- Structured request logging
- Test coverage expansion

## Files Changed (v0.8.1)
- `src/logging.ts`
- `src/server.ts`
- `dist/logging.js`
- `dist/server.js`

## Testing
All tests pass (9/9).