import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, getDocs, getDoc,
  updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, Timestamp, GeoPoint
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { firebaseConfig } from "./config.js?v=18";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export {
  collection, doc, addDoc, getDocs, getDoc,
  updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, Timestamp, GeoPoint,
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  ref, uploadBytes, getDownloadURL
};
