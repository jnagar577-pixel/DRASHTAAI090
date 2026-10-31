import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  runTransaction
} from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.resolve(__dirname, '../firebase-applet-config.json');

let db = null;
let app = null;

export function isFirebaseConfigured() {
  try {
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return Boolean(raw.projectId && raw.apiKey);
    }
  } catch {
    return false;
  }
  return false;
}

export function getDb() {
  if (db) return db;
  if (!isFirebaseConfigured()) return null;
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  app = getApps().length > 0 ? getApps()[0] : initializeApp(config);
  db = getFirestore(app, config.firestoreDatabaseId || undefined);
  return db;
}

/* ==================== FIRESTORE DATA ADAPTER ==================== */

export async function fbGetConversation(hash) {
  const firestore = getDb();
  if (!firestore) return null;
  const q = query(collection(firestore, 'conversations'), where('token_hash', '==', hash), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function fbEnsureConversation(hash) {
  const firestore = getDb();
  if (!firestore) return { id: hash, token_hash: hash };
  const existing = await fbGetConversation(hash);
  if (existing) return existing;
  const docRef = doc(firestore, 'conversations', hash);
  const data = {
    token_hash: hash,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  await setDoc(docRef, data, { merge: true });
  return { id: hash, ...data };
}

export async function fbUpdateConversation(convId, updateFields) {
  const firestore = getDb();
  if (!firestore) return;
  const docRef = doc(firestore, 'conversations', convId);
  await setDoc(docRef, { ...updateFields, updated_at: new Date().toISOString() }, { merge: true });
}

export async function fbBumpUsage(hash, day) {
  const firestore = getDb();
  if (!firestore) return 1;
  const usageId = `${hash}_${day}`;
  const docRef = doc(firestore, 'usage', usageId);
  return await runTransaction(firestore, async (transaction) => {
    const snap = await transaction.get(docRef);
    let count = 1;
    if (snap.exists()) {
      count = (snap.data().count || 0) + 1;
    }
    transaction.set(docRef, { hash, day, count, updated_at: new Date().toISOString() }, { merge: true });
    return count;
  });
}

export async function fbGetMessages(convId, turnLimit = 10) {
  const firestore = getDb();
  if (!firestore) return [];
  const q = query(
    collection(firestore, 'messages'),
    where('conversation_id', '==', convId),
    orderBy('created_at', 'desc'),
    limit(turnLimit)
  );
  try {
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .reverse();
  } catch (err) {
    // If composite index is pending, fallback to filtering by conversation_id
    const fallbackQ = query(collection(firestore, 'messages'), where('conversation_id', '==', convId), limit(50));
    const snap = await getDocs(fallbackQ);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
      .slice(-turnLimit);
  }
}

export async function fbAddMessage(convId, role, content) {
  const firestore = getDb();
  const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  if (!firestore) return id;
  const docRef = doc(firestore, 'messages', id);
  await setDoc(docRef, {
    conversation_id: convId,
    role,
    content,
    created_at: new Date().toISOString()
  });
  return id;
}

export async function fbClearMessages(convId) {
  const firestore = getDb();
  if (!firestore) return;
  const q = query(collection(firestore, 'messages'), where('conversation_id', '==', convId));
  const snap = await getDocs(q);
  const deletes = snap.docs.map(d => deleteDoc(doc(firestore, 'messages', d.id)));
  await Promise.all(deletes);
}

export async function fbAddFeedback(messageId, helpful) {
  const firestore = getDb();
  if (!firestore) return;
  const id = `fb_${messageId}`;
  await setDoc(doc(firestore, 'feedback', id), {
    message_id: messageId,
    helpful,
    created_at: new Date().toISOString()
  }, { merge: true });
}

export async function fbDeleteAll(hash) {
  const firestore = getDb();
  if (!firestore) return;
  const conv = await fbGetConversation(hash);
  if (conv) {
    await fbClearMessages(conv.id);
    await deleteDoc(doc(firestore, 'conversations', conv.id));
  }
}

export async function fbGetKnowledge() {
  const firestore = getDb();
  if (!firestore) return [];
  try {
    const q = query(collection(firestore, 'knowledge_base'), where('active', '==', true), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  } catch {
    return [];
  }
}

export async function fbTestHealth() {
  const firestore = getDb();
  if (!firestore) return { ok: false, error: 'Firebase config missing' };
  try {
    const snap = await getDocs(query(collection(firestore, 'conversations'), limit(1)));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
