import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

let adminDb: Firestore | null = null

export function getAdminFirestore(): Firestore | null {
  if (adminDb) return adminDb

  try {
    const existingApps = getApps()
    let app: App
    if (existingApps.length > 0) {
      app = existingApps[0]
    } else {
      const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim()?.replace(/\\n/g, '\n')

      let credential
      if (serviceAccountJson) {
        credential = cert(JSON.parse(serviceAccountJson))
      } else if (projectId && clientEmail && privateKey) {
        credential = cert({ projectId, clientEmail, privateKey })
      }

      app = initializeApp({
        ...(credential ? { credential } : {}),
        projectId: projectId || undefined,
      })
    }

    adminDb = getFirestore(app)
    return adminDb
  } catch (error) {
    console.warn('[firebase-admin] Could not initialize Firestore admin:', error)
    return null
  }
}
