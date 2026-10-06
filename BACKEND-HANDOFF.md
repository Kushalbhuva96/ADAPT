# ADAPT Hackathon Edition — Backend Handoff

## Honest status

This frontend is **backend-integration ready**, not a completed backend.

It runs fully in mock mode so the team can demo every major interaction without MongoDB or AI keys. The UI calls a centralized `api` service; production endpoints are already mapped in `src/services/api/index.js`.

The backend member's job is to implement the contracts below and switch:

`VITE_USE_MOCK=false`

The UI should not need to be rewritten.

## Current frontend scope

- Landing + original ADAPT visual identity
- Onboarding with working step-by-step buttons
- Diagnostic Assessment with next/back/finish flow
- Dashboard with working navigation and recommendation flow
- Learning DNA + Knowledge Map + Learning Twin entry
- ADAPT Lab live scripted adaptation demo
- Adaptive Practice with multiple questions, submit, feedback, next, previous and reset
- "Why am I seeing this?" decision trace
- AI Tutor quick actions + message input
- Voice Tutor states + simulated voice API flow
- Voice Quiz analysis flow
- AI Study Plan with completion interactions
- Progress and Profile screens
- Centralized API client + mock service
- Production endpoint mapping

## API contracts to implement

Authentication
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

Dashboard
- GET /api/dashboard/:userId

Subjects
- GET /api/subjects
- GET /api/subjects/:subjectId/topics

Assessment
- POST /api/assessment/start
- POST /api/assessment/:assessmentId/answer
- POST /api/assessment/:assessmentId/complete
- GET /api/assessment/:assessmentId/result

Learning Profile
- GET /api/profile/:userId

Practice
- GET /api/practice/next/:userId
- POST /api/practice/answer

Recommendations
- GET /api/recommendations/:userId

Study Plan
- GET /api/study-plan/:userId
- POST /api/study-plan/:userId/start
- POST /api/study-plan/:userId/item/:itemId/complete

AI Tutor
- POST /api/tutor/message

Voice
- POST /api/voice/session
- POST /api/voice/message
- POST /api/voice/quiz/evaluate
- GET /api/voice/session/:sessionId

Progress
- GET /api/progress/:userId

Offline
- GET /api/sync/:userId
- POST /api/sync/:userId

## Most important backend behavior

### Practice answer
The response should return:

- attempt
- feedback.status
- feedback.correctOptionId
- feedback.explanation
- feedback.whatAdaptLearned
- feedback.mastery { previous, current, change }
- adaptation.nextDifficulty
- adaptation.nextStrategy
- adaptation.reason

The frontend already renders these fields.

### Next practice question
Return the question object plus:

```json
{
  "adaptiveContext": {
    "accuracy": 42,
    "topicMastery": 42,
    "reason": "Your recent accuracy indicates this concept needs reinforcement.",
    "strategy": "foundation_first"
  }
}
```

### AI Tutor
Return a teaching message using the existing message model. Do not require the frontend to know the LLM provider.

### Voice
Keep voice/STT/TTS behind the API. The frontend already has UI states for IDLE, LISTENING, THINKING and SPEAKING.

## Definition of done for backend integration

1. MongoDB models match the existing frontend data contracts.
2. JWT authentication works.
3. Practice answers persist.
4. Practice selection actually changes from learner history.
5. Learning Profile updates after attempts.
6. Dashboard reads persisted data.
7. Study Plan completion persists.
8. Progress updates after attempts.
9. Tutor endpoint works with an AI provider or safe mock fallback.
10. Voice endpoints work or return a controlled mock response.
11. Offline sync endpoints accept queued actions and return sync status.
12. No API secrets are placed in the frontend.

## Hackathon priority

If time is limited, finish in this order:

1. Auth
2. Practice next + answer
3. Learning Profile update
4. Dashboard
5. Progress
6. Tutor
7. Study Plan
8. Voice
9. Offline sync
