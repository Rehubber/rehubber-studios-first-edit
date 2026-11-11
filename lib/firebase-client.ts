'use client'

import { getApp, getApps, initializeApp } from 'firebase/app'
import { getToken, initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

import appletConfig from '@/firebase-applet-config.json'

let appCheckInstance: AppCheck | null = null

export function getFirebaseConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || appletConfig.apiKey || ''
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || ''
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || appletConfig.projectId || ''
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || appletConfig.appId || ''
  const firestoreDatabaseId =
    process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || appletConfig.firestoreDatabaseId || '(default)'

  return { apiKey, authDomain, projectId, appId, firestoreDatabaseId }
}

export function isFirebaseConfigured(): boolean {
  const cfg = getFirebaseConfig()
  return Boolean(cfg.apiKey && cfg.projectId && cfg.appId)
}

export function getFirebaseClientApp() {
  const cfg = getFirebaseConfig()

  if (!cfg.apiKey || !cfg.projectId || !cfg.appId) {
    throw new Error('Firebase Web App config is missing. Add the NEXT_PUBLIC_FIREBASE_* values to the environment.')
  }

  return (
    getApps()[0] ??
    initializeApp({
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain,
      projectId: cfg.projectId,
      appId: cfg.appId,
    })
  )
}

export function getFirebaseClientAuth() {
  return getAuth(getFirebaseClientApp())
}

export function getFirebaseClientFirestore() {
  const app = getFirebaseClientApp()
  const cfg = getFirebaseConfig()
  return cfg.firestoreDatabaseId && cfg.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, cfg.firestoreDatabaseId)
    : getFirestore(app)
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string
  operationType: OperationType
  path: string | null
  authInfo: {
    userId?: string | null
    email?: string | null
    emailVerified?: boolean | null
    isAnonymous?: boolean | null
    tenantId?: string | null
    providerInfo?: {
      providerId?: string | null
      email?: string | null
    }[]
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  let auth
  try {
    auth = getFirebaseClientAuth()
  } catch {
    // Auth might not be initialized
  }
  const currentUser = auth?.currentUser

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo))
  throw new Error(JSON.stringify(errInfo))
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
