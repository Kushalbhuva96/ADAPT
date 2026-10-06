# ADAPT — 70% Hackathon Target

## What this frontend delivers

The frontend is designed to be the first major milestone: a complete, navigable, interactive product shell with a stable API boundary.

### Demo-ready now

- Every primary navigation item works.
- Assessment has real next/back/finish interactions.
- Practice has a multi-question loop.
- Submit Answer changes the UI and produces adaptive feedback.
- Next Question loads a different question.
- Why Am I Seeing This exposes the adaptation decision.
- ADAPT Lab demonstrates the full adaptation story.
- Learning DNA exposes the learner model.
- Tutor accepts questions and quick actions.
- Voice Tutor exposes interaction states.
- Voice Quiz produces a structured analysis.
- Study Plan items can be completed.

## What is intentionally left for backend

- Real authentication and user sessions
- MongoDB persistence
- Real adaptive-learning calculations
- Real LLM calls
- Real speech-to-text/text-to-speech
- Multi-device sync

## Recommended team split

Frontend member: polish responsive UI, animations, accessibility, and final demo content.

Backend member: implement the API contracts in BACKEND-HANDOFF.md and connect MongoDB/JWT/AI.

Integration member/leader: switch mock mode off, verify all endpoints, test error/offline states, and run the final end-to-end demo.
