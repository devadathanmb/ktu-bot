import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// I wasted an entire day trying to pass a json to docker run env
// life is too short for ci
const base64ServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT!;
const serviceAccountBuffer = Buffer.from(base64ServiceAccount, "base64");
const serviceAccountJson = serviceAccountBuffer.toString("utf-8");

const serviceAccount = JSON.parse(serviceAccountJson);

function initDb() {
  initializeApp({
    credential: cert(serviceAccount),
  });
  console.log("Firebase initialized");
  return getFirestore();
}

const db = initDb();

export default db;
