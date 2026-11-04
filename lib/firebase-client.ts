'use client'

import { getApp, getApps, initializeApp } from 'firebase/app'
import { getToken, initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

let appCheckInstance: AppCheck | null = null

export function getFirebaseClientApp() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID

  if (!apiKey || !authDomain || !projectId || !appId) {
    throw new Error('Firebase Web App config is missing. Add the NEXT_PUBLIC_FIREBASE_* values to the environment.')
  }

  return (
    getApps()[0] ??
    initializeApp({
      apiKey,
      authDomain,
      projectId,
      appId,
    })
  )
}

export function getFirebaseClientAuth() {
  return getAuth(getFirebaseClientApp())
}

export function getFirebaseClientFirestore() {
  return getFirestore(getFirebaseClientApp())
}

export async function getFirebaseAppCheckToken(): Promise<string> {
  const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY
  if (!siteKey) {
    return ''
  }

  if (!appCheckInstance) {
    appCheckInstance = initializeAppCheck(getFirebaseClientApp(), {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    })
  }

  const tokenResult = await getToken(appCheckInstance)
  return tokenResult.token ?? ''
}
