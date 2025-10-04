// Script to migrate data from old bot's firestore DB to new bot's postgres DB
const POSTGRES_CONNECTION_STRING = process.env.POSTGRES_CONNECTION_STRING!;
const FIREBASE_SERVICE_ACCOUNT_JSON =
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON!;
