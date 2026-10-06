# ADAPT Hackathon Edition — Windows Run Guide

## 1. Requirements

Use Node.js **20.19+** (Node 22 LTS is also fine).

Check:

```powershell
node -v
npm -v
```

## 2. Open the correct folder

In Antigravity or VS Code, open the folder that directly contains:

- package.json
- index.html
- src
- public
- vite.config.js

Do not open only the `src` folder.

## 3. Install dependencies

```powershell
npm install
```

## 4. Start Vite

```powershell
npm run dev
```

Keep this terminal open.

Vite should show:

```text
Local: http://localhost:5173/
```

Open the exact Local URL shown by Vite.

## 5. If Chrome says ERR_CONNECTION_REFUSED

That means Vite is not currently running. Do not open `http://localhost` by itself.

Run `npm run dev` again and check the terminal output.

## 6. Mock mode

The project starts with:

`VITE_USE_MOCK=true`

This is intentional. The complete frontend demo works without a backend.

## 7. Backend mode

After the backend member implements the API:

Create `.env`:

```text
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:5000/api
```

Restart Vite after changing `.env`.
