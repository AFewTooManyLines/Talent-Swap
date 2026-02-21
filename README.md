# Talent Swap

A multi-page front-end for a skill-swapping platform with Firebase Authentication + Firestore integration.

## Features
- Animated marketing landing page (`index.html`) with prominent sign-up CTA.
- Working sign-up and sign-in flows using Firebase Auth.
- User profile data stored in Firestore with fields:
  - `displayName`
  - `email`
  - `talents` (array)
  - `signUpDate` and `signUpDateReadable`
- Community profile listing page (`profiles.html`) with search/filter.
- Individual user profile page (`profile.html?uid=<userId>`).

## Running locally
Use any static web server from the project root:

```bash
python3 -m http.server 4173
```

<<<<<<< HEAD
Then open <http://localhost:4173/Pages/index.html> on your browser

## Deployed model
Visit the deployed [website](https://talent-swap.vercel.app/) instead of running the project locally.
=======
Then open <http://localhost:4173>.

## Firebase project
The app is configured for the existing Talent Swap Firebase project in `src/app.js`.
>>>>>>> parent of 5326293 (fixed account creation)
