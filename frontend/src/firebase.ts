import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  type User,
  type Auth,
} from 'firebase/auth'

/**
 * Real Firebase Configuration for NAKSHATRA-X
 * Connected to Firebase project: project-541a9315-c74e-40da-b51
 */
export const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    'AIzaSyDLceBt1ON6r4kKknY64z_roeJOxz5JkcY',
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    'project-541a9315-c74e-40da-b51.firebaseapp.com',
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    'project-541a9315-c74e-40da-b51',
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    'project-541a9315-c74e-40da-b51.firebasestorage.app',
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    '651909430955',
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    '1:651909430955:web:e654e2703cc63e28a241ee',
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ||
    'G-ZYK89BXWZP',
}

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId
  )
}

// Initialize Firebase App safely (singleton across SSR and client renders)
export const app: FirebaseApp = (() => {
  if (getApps().length > 0) {
    return getApp()
  }
  return initializeApp(firebaseConfig)
})()

// Export Auth instance
export const auth: Auth = getAuth(app)

// Export Configured Google Auth Provider
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({
  prompt: 'select_account',
})

// Real Firebase Google Authentication Methods
export async function signInWithGooglePopup(): Promise<{ user: User; idToken: string }> {
  const result = await signInWithPopup(auth, googleProvider)
  const idToken = await result.user.getIdToken()
  return { user: result.user, idToken }
}

export async function signInWithGoogleRedirect(): Promise<void> {
  await signInWithRedirect(auth, googleProvider)
}

export async function checkRedirectResult(): Promise<{ user: User; idToken: string } | null> {
  try {
    const result = await getRedirectResult(auth)
    if (result && result.user) {
      const idToken = await result.user.getIdToken()
      return { user: result.user, idToken }
    }
  } catch (error) {
    console.error('Error handling redirect result:', error)
    throw error
  }
  return null
}

export async function signOutUser(): Promise<void> {
  await signOut(auth)
}

export { onAuthStateChanged }
export type { User }
