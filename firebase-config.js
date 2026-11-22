const firebaseConfig = {
  apiKey: "AIzaSyC6fPNw92jan6UTTfC913epNDSUNszapnA",
  authDomain: "rifas-los-brothers-22b15.firebaseapp.com",
  projectId: "rifas-los-brothers-22b15",
  storageBucket: "rifas-los-brothers-22b15.firebasestorage.app",
  messagingSenderId: "382791401858",
  appId: "1:382791401858:web:06aaa2a0990142c8050f9b",
  measurementId: "G-Q52EF4SBMT"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();