import { getFirestore } from "firebase-admin/firestore";
import initFirebase from "./initFirebase";

initFirebase();
const db = getFirestore();

export default db;
