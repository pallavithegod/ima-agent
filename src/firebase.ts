import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  GithubAuthProvider,
  getAuth,
  signInWithPopup,
} from "firebase/auth";

// Lazy initialization: a missing/invalid Firebase config must not crash the
// whole dashboard at load — only the GitHub sign-in button depends on it.
let firebaseApp: FirebaseApp | null = null;

function getFirebaseApp(): FirebaseApp {
  if (firebaseApp) return firebaseApp;
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GitHub sign-in is not configured (missing Firebase settings). Use email/password instead.",
    );
  }
  firebaseApp = initializeApp({
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });
  return firebaseApp;
}

export async function signInWithGithub() {
  const auth = getAuth(getFirebaseApp());
  const provider = new GithubAuthProvider();
  provider.addScope("repo");
  provider.addScope("read:user");
  provider.addScope("user:email");
  const result = await signInWithPopup(auth, provider);
  const credential = GithubAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) throw new Error("GitHub did not return an access token");
  return {
    idToken: await result.user.getIdToken(),
    githubAccessToken: credential.accessToken,
  };
}
