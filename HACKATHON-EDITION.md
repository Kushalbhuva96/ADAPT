# ADAPT Hackathon Edition

## Product focus
ADAPT's hackathon story is: **it adapts the learning experience to the learner, rather than asking every learner to follow the same path.** Prioritize visible, explainable adaptation over a large number of disconnected AI features.

## Existing page plan
- **Dashboard:** Add a primary “Watch ADAPT adapt” entry to the ADAPT Lab. Keep current health, priority, momentum and mission cards.
- **ADAPT Lab (`/lab`):** New interactive, scripted demo journey. Step through concept success, application success, a challenge miss, and a targeted recovery. Display learner signals, mastery, accuracy, difficulty and the reason for each recommended change. This is a front-end demonstration using sample scenario data, not a live AI inference engine.
- **Learning DNA:** Keep the knowledge map and behavior indicators; link to the Learning Twin demo to make the profile feel actionable.
- **Adaptive Practice:** Make real answer submission update mastery and provide targeted explanation. Current sample experience is a prototype; wire to API before claiming persistent adaptation.
- **AI Tutor / Voice Tutor:** Reuse the same identified concept gap and selected explanation style, so the experience feels consistent across modes.
- **Study Plan:** Turn the latest gap into a short recovery sequence (refresher → guided example → practice → recall).
- **Progress:** Show improvement against the learner's own baseline and topic mastery, not a public student ranking.

## Priority roadmap
1. **P0 — Demo reliability:** ensure install/build/startup works; remove JSX parse errors; verify every route.
2. **P1 — Signature moment:** ADAPT Lab simulator with transparent “why this decision?” explanation.
3. **P2 — Learning loop:** connect practice answers → mistake analysis → targeted tutor explanation → retry → progress update.
4. **P3 — Visual polish:** Learning Twin signals, topic knowledge map, subtle transitions, responsive layout and accessible controls.
5. **P4 — Optional extensions:** spaced review/forgetting reminders and image-based question input, only after the core loop is stable.

## Hackathon honesty
The ADAPT Lab is a scripted front-end demo. It must be clearly presented as illustrative until decisions are driven by actual learner data and validated backend/model logic. Do not claim emotion detection or guaranteed retention prediction without tested evidence.

## Suggested 3-minute demonstration
1. State the problem: standard learning paths do not respond to individual gaps.
2. Open ADAPT Lab and start the sample journey.
3. Show success raising challenge, then a miss switching to a visual refresher and easier retry.
4. Explain why the decision changed, then open Learning DNA and Practice.
5. Close with: “ADAPT changes the learning path based on the learner's signals.”

## Running
From the project root: `npm install`, then `npm run dev`. Use the local URL printed by Vite. The demo page is available at `/lab`.
