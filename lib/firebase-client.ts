'use client'

import { getApp, getApps, initializeApp } from 'firebase/app'
import { getToken, initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check'
import { getAuth } from 'firebase/auth'
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore'

import appletConfig from '@/firebase-applet-config.json'

let appCheckInstance: AppCheck | null = null

function cleanConfigValue(value?: string): string {
  if (!value) return ''
  return value.trim().replace(/^['"]+|['"]+$/g, '')
}

export function getFirebaseConfig() {
  const envApiKey = cleanConfigValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY)
  const envAuthDomain = cleanConfigValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN)
  const envProjectId = cleanConfigValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
  const envAppId = cleanConfigValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID)
  const envDbId = cleanConfigValue(process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID)

  if (envApiKey && envProjectId && envAppId) {
    return {
      apiKey: envApiKey,
      authDomain: envAuthDomain || `${envProjectId}.firebaseapp.com`,
      projectId: envProjectId,
      appId: envAppId,
      firestoreDatabaseId: envDbId || '(default)',
    }
  }

  return {
    apiKey: cleanConfigValue(appletConfig.apiKey),
    authDomain: cleanConfigValue(appletConfig.authDomain),
    projectId: cleanConfigValue(appletConfig.projectId),
    appId: cleanConfigValue(appletConfig.appId),
    firestoreDatabaseId: cleanConfigValue(appletConfig.firestoreDatabaseId) || '(default)',
  }
}

export function isFirebaseConfigured(): boolean {
  const cfg = getFirebaseConfig()
  return Boolean(cfg.apiKey && cfg.projectId && cfg.appId)
}

export function ensureFirebaseAppCheck(app = getApps()[0]) {
  if (typeof window === 'undefined' || !app) return null
  const siteKey = cleanConfigValue(process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY)
  if (!siteKey) return null

  if (!appCheckInstance) {
    try {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      })
    } catch {
      return null
    }
  }

  return appCheckInstance
}

export function getFirebaseClientApp() {
  const cfg = getFirebaseConfig()

  if (!cfg.apiKey || !cfg.projectId || !cfg.appId) {
    throw new Error('Firebase Web App config is missing. Add the NEXT_PUBLIC_FIREBASE_* values to the environment.')
  }

  const app =
    getApps()[0] ??
    initializeApp({
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain,
      projectId: cfg.projectId,
      appId: cfg.appId,
    })

  ensureFirebaseAppCheck(app)
  return app
}

export function getFirebaseClientAuth() {
  return getAuth(getFirebaseClientApp())
}

let firestoreInstance: ReturnType<typeof getFirestore> | null = null

export function getFirebaseClientFirestore() {
  if (firestoreInstance) return firestoreInstance
  const app = getFirebaseClientApp()
  const cfg = getFirebaseConfig()
  const dbId = cfg.firestoreDatabaseId && cfg.firestoreDatabaseId !== '(default)' ? cfg.firestoreDatabaseId : undefined

  try {
    firestoreInstance = dbId
      ? initializeFirestore(app, { localCache: memoryLocalCache() }, dbId)
      : initializeFirestore(app, { localCache: memoryLocalCache() })
  } catch {
    firestoreInstance = dbId ? getFirestore(app, dbId) : getFirestore(app)
  }

  return firestoreInstance
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
  const instance = ensureFirebaseAppCheck(getFirebaseClientApp())
  if (!instance) {
    return ''
  }

  const tokenResult = await getToken(instance)
  return tokenResult.token ?? ''
}
