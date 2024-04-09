import { initializeApp, cert } from "firebase-admin/app";

const base64ServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT!;
const serviceAccountBuffer = Buffer.from(base64ServiceAccount, "base64");
const serviceAccountJson = serviceAccountBuffer.toString("utf-8");

const serviceAccount = JSON.parse(serviceAccountJson);

function initFirebase() {
  initializeApp({
    credential: cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

export default initFirebase;
