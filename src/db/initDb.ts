import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = require("../../serviceAccountKey.json");

function initDb() {
  initializeApp({
    credential: cert(serviceAccount),
  });
  console.log("Firebase initialized");
  return getFirestore();
}

export { initDb };
