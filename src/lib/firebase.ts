import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyA8bB0qSlAzOIznbaKdDhFmS4kmLqeTBpQ',
  authDomain: 'myzip-de785.firebaseapp.com',
  projectId: 'myzip-de785',
  storageBucket: 'myzip-de785.firebasestorage.app',
  messagingSenderId: '555298220578',
  appId: '1:555298220578:web:c85a6616151ce110a0b87b',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
