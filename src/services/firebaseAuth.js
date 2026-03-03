const admin = require('firebase-admin');

let firebaseApp;

const initFirebase = () => {
  if (!firebaseApp && process.env.FIREBASE_PROJECT_ID) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
  }
  return firebaseApp;
};

const verifyFirebaseToken = async (idToken) => {
  const app = initFirebase();
  if (!app) {
    throw new Error('Firebase not configured');
  }
  const decodedToken = await admin.auth().verifyIdToken(idToken);
  return decodedToken;
};

module.exports = { verifyFirebaseToken, initFirebase };
