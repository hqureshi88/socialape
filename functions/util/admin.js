import * as firebaseAdminApp from 'firebase-admin/app';
import * as firebaseAdminFirestore from "firebase-admin/firestore";

const adminApp = firebaseAdminApp.initializeApp();
const db = firebaseAdminFirestore.getFirestore(adminApp);

export { adminApp, db };