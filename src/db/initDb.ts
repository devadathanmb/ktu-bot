import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);

function initDb() {
  initializeApp({
    credential: cert(serviceAccount),
  });
  console.log("Firebase initialized");
  return getFirestore();
}

export { initDb };
