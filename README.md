# Talent-Swap
School Project

## Firebase setup
TalentSwap is configured to use Firebase as its cloud database backend (Firestore).

### Environment variables
Create a `.env` file in the project root (already added in this repository for local configuration) with the following values:

```env
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
REACT_APP_FIREBASE_MEASUREMENT_ID=...
```

A safe template is available in `.env.example`.

### Firebase module
Firebase is initialized in `src/config/firebase.js` and exports:
- `app` (Firebase app)
- `db` (Firestore database instance)
- `analytics` (Firebase analytics in browser environments)

Import it where needed:

```js
import { db } from "./src/config/firebase";
```
