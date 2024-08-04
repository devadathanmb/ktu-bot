import { getFirestore } from "firebase-admin/firestore";
import initFirebase from "./initFirebase";
import Logger from "@/utils/logger";

const logger = Logger.getLogger("FIREBASE");

initFirebase();
const db = getFirestore();

logger.info("Firebase initialized");

export default db;
