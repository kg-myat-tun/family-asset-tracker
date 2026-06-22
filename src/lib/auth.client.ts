"use client";

import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { getClientAuth } from "@/firebase/client";

export async function loginWithEmail(email: string, password: string) {
  try {
    const credential = await signInWithEmailAndPassword(getClientAuth(), email, password);
    const idToken = await credential.user.getIdToken();
    await exchangeTokenForSession(idToken);
  } catch (error) {
    throwAuthError(error, "email");
  }
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  let idToken: string;

  try {
    const credential = await signInWithPopup(getClientAuth(), provider);
    idToken = await credential.user.getIdToken();
  } catch (error) {
    throwAuthError(error, "google");
  }

  await exchangeTokenForSession(idToken);
}

export async function logout() {
  // Clear the server session first, but never let a failure here strand the
  // user on a stale page — always navigate to /login afterwards. The httpOnly
  // session cookie is what actually gates access, and the POST clears it.
  try {
    await signOut(getClientAuth());
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    window.location.href = "/login";
  }
}

async function exchangeTokenForSession(idToken: string) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Failed to create session.");
  }

  window.location.href = "/dashboard";
}

function getAuthErrorMessage(error: unknown, method: "email" | "google") {
  if (!(error instanceof FirebaseError)) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return "Authentication failed. Please try again.";
  }

  switch (error.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in popup. Allow popups and try again.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled.";
    case "auth/cancelled-popup-request":
      return "A Google sign-in popup is already open. Close it or finish signing in first.";
    case "auth/operation-not-allowed":
      return method === "google"
        ? "Google sign-in is not enabled in Firebase Authentication yet."
        : "Email/password sign-in is not enabled in Firebase Authentication yet.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized for Firebase sign-in. Add it under Firebase Authentication > Settings > Authorized domains.";
    case "auth/account-exists-with-different-credential":
      return "This email already exists with a different sign-in method. Try the original provider first.";
    case "auth/invalid-api-key":
      return "Your Firebase web app config is invalid. Check NEXT_PUBLIC_FIREBASE_API_KEY.";
    case "auth/invalid-app-credential":
      return "Firebase rejected the app credentials. Recheck your Firebase web app config values.";
    case "auth/app-not-authorized":
      return "This Firebase app is not authorized to use Authentication with the current config.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";
    default:
      console.error("Firebase auth error:", error.code, error.message);
      return method === "google"
        ? `Google sign-in failed (${error.code}). Check that Google Auth is enabled and this site is listed in Firebase Authorized domains.`
        : `Authentication failed (${error.code}). Please check your Firebase Auth setup.`;
  }
}

function throwAuthError(error: unknown, method: "email" | "google"): never {
  throw new Error(getAuthErrorMessage(error, method));
}
