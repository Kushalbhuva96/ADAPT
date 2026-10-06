# ADAPT Hackathon Edition — Final Fixes

## Included fixes
- Reworked ADAPT wordmark to a clean, bold, white futuristic wordmark with a small violet/blue/green pulse mark inspired by the supplied logo references.
- Added functional Sign up and Sign in UI using the existing mock API layer.
- New accounts are stored locally in demo mode and can be used to sign in again.
- Landing-page Sign in opens the Sign in tab directly.
- Diagnostic Assessment is fixed to exactly 10 questions.
- Added questions 9 and 10 to the mock assessment bank.
- Assessment counter is a fixed `1 / 10`, `2 / 10`, ... `10 / 10` style indicator and does not animate.
- Added a 10-step assessment index and fixed progress indicator.
- Kept the existing backend-ready API abstraction and mock mode.

## Run
```cmd
npm install
npm run dev
```

The project root contains `package.json`, so run the commands from this folder.
