# Voyage frontend

React + Vite homepage matching the Voyage travel draft.

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Start Catalogue on port 8081 for live packages and Travel Assistant on port 8085 for AI (with its Gemini key configured). Vite proxies requests to these services. No backend changes are required.

`npm run build` produces `dist/`. Production hosting must proxy `/catalogue-api` to Catalogue `/api` and `/assistant-api` to Assistant `/api`, or set the build-time variables in `.env.example` and configure backend CORS for the deployed origin. `npm run preview` previews the build; live APIs require the same routing configuration.

## Current behaviour

- Fetches packages, departures and remaining capacity. Destination search is case-insensitive; the other search filters run locally against departure data. Date means exact departure date. Budget means maximum per-person departure price in the catalogue's unspecified currency. Interests are passed to AI only.
- Cards show the cheapest matching AVAILABLE departure starting today or later. Duration is nights/date difference, displayed as days to follow the draft; confirm the desired business convention with the backend team.
- If the catalogue is empty or unreachable, three clearly labelled sample trips appear. Samples have no bookable dates or availability. A live catalogue with no matches shows an empty state, never sample results.
- Illustrative Unsplash photos are stored in `public/images`; fonts use Google Fonts with a sans-serif fallback. Package imagery and featured ranking do not currently come from the backend. The first three live packages appear in the featured section. Photo sources are recorded in `public/images/SOURCES.md`.
- The AI Assistant is a full-page concierge chat with a greeting, suggestion chips, a typing indicator and a retry on failure. The assistant returns a short summary plus structured `recommendations` (catalogue package IDs with a one-sentence reason) that become the cards; if a reply comes back as plain text only, cards are built by matching the catalogue packages named in it. There is still no departure data or chat memory on the backend; "Select This Trip" opens the package details dialog. Package details remain an accessible native dialog.
- Profile and My Bookings explain that personal account features are coming soon. This homepage does not expose the backend's unfiltered booking list or implement checkout.
- Catalogue partial failures display missing prices or unconfirmed availability; unknown availability is excluded when filtering by traveller count.

Frontend data and service calls are isolated in `src/data.js` and `src/api.js` for future backend integration.

## Verification

Run `npx playwright install chromium` once, then `npx playwright test`. Browser tests cover offline samples, live departure filtering, remaining capacity, AI request/response integration, accessible dialogs and layout overflow at 375, 768 and 1440 pixels. They use mocked APIs and do not require Java services or a Gemini key.
