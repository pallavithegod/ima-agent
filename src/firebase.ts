import { initializeApp } from "firebase/app";
import {
  GithubAuthProvider,
  getAuth,
  signInWithPopup,
} from "firebase/auth";

const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

const auth = getAuth(firebaseApp);

export async function signInWithGithub() {
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
