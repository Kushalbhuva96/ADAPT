# ADAPT — Hackathon Edition

ADAPT is a premium futuristic adaptive-learning frontend built around one product idea:

> **An AI that learns the learner.**

## What is included

- Landing / brand experience
- Onboarding
- Diagnostic assessment
- Dashboard
- Learning DNA + knowledge map
- ADAPT Lab / Learning Twin demo
- Adaptive Practice with multi-question flow
- Why Am I Seeing This? decision trace
- AI Tutor
- Voice Tutor
- Voice Quiz
- AI Study Plan
- Progress analytics
- Profile / offline continuity
- Centralized API service
- Mock service with backend-shaped contracts

## Run

See `RUN-WINDOWS.md`.

```bash
npm install
npm run dev
```

Default frontend: `http://localhost:5173/`

## Backend handoff

Read `BACKEND-HANDOFF.md` before implementing the Node/Express/MongoDB layer.

The UI intentionally does not put fetch calls inside pages. Pages call `src/services/api/index.js`; mock and production implementations share the same boundary.

## Mock mode

`VITE_USE_MOCK=true` is the default so the frontend works before the backend is finished.

## Important honesty note

This package is a **frontend milestone and backend handoff**, not a finished full-stack product. MongoDB persistence, JWT, real AI, speech services and production sync still belong to the backend/integration milestone.
