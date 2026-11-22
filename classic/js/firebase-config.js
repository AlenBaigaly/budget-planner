/**
 * Firebase Auth & Cloud Firestore Realtime Synchronization
 * With Offline-First Fallback and Local Storage Persistence
 */

let firebaseApp = null;
let firebaseAuth = null;
let firestoreDb = null;
let currentUser = null;
let authStateListeners = [];
let syncListeners = [];

const FIREBASE_CONFIG_KEY = 'gemini_budget_firebase_config';
const FIREBASE_DISABLED_KEY = 'gemini_budget_firebase_disabled';

// Firebase web configuration is public by design. Sensitive financial data is
// protected by Firestore rules and the signed-in user's UID, not this config.
const DEFAULT_FIREBASE_CONFIG = Object.freeze({
  apiKey: 'AIzaSyAQGWITpQsePiNVMODccu6wwvmu_X6cisc',
  authDomain: 'budget-planner-62195.firebaseapp.com',
  projectId: 'budget-planner-62195',
  storageBucket: 'budget-planner-62195.firebasestorage.app',
  messagingSenderId: '278016945377',
  appId: '1:278016945377:web:9bdb8ce5aa918690c21ba0',
  measurementId: 'G-Y06WD1NEG1'
});

/**
 * Accepts both strict JSON and the `const firebaseConfig = { ... };` snippet
 * copied from the Firebase console. No code is evaluated: the console snippet
 * only needs unquoted property names and trailing commas normalised to JSON.
 */
export function parseFirebaseConfigInput(raw) {
  const input = String(raw || '').trim();
  if (!input) throw new Error('Конфигурация пуста');

  // Firebase Console copies imports + this config + initialization code.
  // Pull the config object out even when the entire generated example is pasted.
  const snippet = input.match(/\b(?:const|let|var)\s+firebaseConfig\s*=\s*(\{[\s\S]*?\})\s*;/i);
  const objectText = snippet ? snippet[1] : input;

  try {
    return JSON.parse(objectText);
  } catch {
    const normalized = objectText
      .replace(/([,{]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
      .replace(/,\s*}/g, '}');
    const config = JSON.parse(normalized);
    if (!config.apiKey || !config.projectId) {
      throw new Error('В конфиге отсутствует apiKey или projectId');
    }
    return config;
  }
}

/**
 * Retrieves stored user Firebase config
 */
export function getSavedFirebaseConfig() {
  try {
    if (localStorage.getItem(FIREBASE_DISABLED_KEY) === 'true') return null;
    const raw = localStorage.getItem(FIREBASE_CONFIG_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_FIREBASE_CONFIG;
  } catch (e) {
    return null;
  }
}

/**
 * Saves user Firebase config to local storage
 */
export function saveFirebaseConfig(cfg) {
  try {
    localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(cfg));
    localStorage.removeItem(FIREBASE_DISABLED_KEY);
  } catch (e) {
    console.error('Failed to save Firebase config', e);
  }
}

/**
 * Clears Firebase config
 */
export function clearFirebaseConfig() {
  localStorage.removeItem(FIREBASE_CONFIG_KEY);
  localStorage.setItem(FIREBASE_DISABLED_KEY, 'true');
}

/**
 * Initialize Firebase dynamically if config is provided
 */
export async function initFirebase(config = null) {
  const cfg = config || getSavedFirebaseConfig();
  if (!cfg || !cfg.apiKey || !cfg.projectId) {
    console.log('Firebase not configured. Running in Local Offline Mode.');
    return { initialized: false, mode: 'local' };
  }

  try {
    // Dynamic import of Firebase SDK from official gstatic CDN
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
    const { getFirestore, doc, setDoc, getDoc, onSnapshot, enableIndexedDbPersistence } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');

    firebaseApp = initializeApp(cfg);
    firebaseAuth = getAuth(firebaseApp);
    firestoreDb = getFirestore(firebaseApp);

    // Enable offline persistence in Firestore if possible
    try {
      await enableIndexedDbPersistence(firestoreDb);
    } catch (err) {
      // Multiple tabs open or not supported, ignore gracefully
    }

    onAuthStateChanged(firebaseAuth, (user) => {
      currentUser = user;
      authStateListeners.forEach((fn) => fn(user));
      if (user) {
        setupFirestoreRealtimeSync(user.uid);
      }
    });

    return { initialized: true, mode: 'firebase', app: firebaseApp, auth: firebaseAuth, db: firestoreDb };
  } catch (err) {
    console.warn('Could not initialize Firebase SDK:', err);
    return { initialized: false, mode: 'local', error: err.message };
  }
}

/**
 * Sign in with Google Popup
 */
export async function loginWithGoogle() {
  if (!firebaseAuth) {
    throw new Error('Firebase не настроен. Укажите конфигурацию проекта в настройках.');
  }
  const { GoogleAuthProvider, signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
  const provider = new GoogleAuthProvider();
  return await signInWithPopup(firebaseAuth, provider);
}

/**
 * Sign out
 */
export async function logoutUser() {
  if (!firebaseAuth) return;
  const { signOut } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
  return await signOut(firebaseAuth);
}

/**
 * Current logged in user object
 */
export function getCurrentUser() {
  return currentUser;
}

export function onAuthChanged(callback) {
  authStateListeners.push(callback);
}

export function onCloudDataChanged(callback) {
  syncListeners.push(callback);
}

/**
 * Listens for changes in the cloud Firestore document
 */
let unsubscribeCloudSync = null;

export async function setupFirestoreRealtimeSync(userId) {
  if (!firestoreDb || !userId) return;
  if (unsubscribeCloudSync) unsubscribeCloudSync();

  const { doc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
  const userDocRef = doc(firestoreDb, 'users', userId, 'budget_app', 'state');

  unsubscribeCloudSync = onSnapshot(userDocRef, { includeMetadataChanges: true }, (snap) => {
    // CRITICAL: Ignore local uncommitted writes to prevent infinite feedback echo loops
    if (snap.metadata && snap.metadata.hasPendingWrites) {
      return;
    }
    if (snap.exists()) {
      const data = snap.data();
      syncListeners.forEach((fn) => fn({ type: 'remote-state', data }));
    } else {
      // A new account has no cloud document yet. The UI will upload its
      // current local state once, after this explicit signal.
      syncListeners.forEach((fn) => fn({ type: 'missing-remote-state' }));
    }
  }, (err) => {
    console.warn('Firestore realtime sync error:', err);
  });
}

/**
 * Saves entire state to Firestore for current user with debouncing
 */
let cloudSyncTimeout = null;

export async function syncStateToCloud(stateData, debounceMs = 1000) {
  if (!firestoreDb || !currentUser) return false;

  return new Promise((resolve) => {
    if (cloudSyncTimeout) clearTimeout(cloudSyncTimeout);

    cloudSyncTimeout = setTimeout(async () => {
      try {
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
        const userDocRef = doc(firestoreDb, 'users', currentUser.uid, 'budget_app', 'state');
        
        // Incoming snapshots are applied locally without calling this method,
        // so every actual local change can safely receive a fresh timestamp.
        const payload = {
          ...stateData,
          lastUpdated: new Date().toISOString()
        };

        await setDoc(userDocRef, payload, { merge: true });
        resolve(true);
      } catch (err) {
        console.error('Failed to sync state to cloud:', err);
        resolve(false);
      }
    }, debounceMs);
  });
}
