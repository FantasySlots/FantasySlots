// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCJAJKkiwfDoGfI8CzWK2kkJRwo55yDvOc",
  authDomain: "nfl-fantasy-slots.firebaseapp.com",
  projectId: "nfl-fantasy-slots",
  storageBucket: "nfl-fantasy-slots.appspot.com", 
  messagingSenderId: "516330061675",
  appId: "1:516330061675:web:829f14031afef0bccc962e",
  measurementId: "G-RH80H7FNQ4",
  databaseURL: "https://nfl-fantasy-slots-default-rtdb.firebaseio.com" 
};

let app;
let database;

/**
 * Initializes the Firebase app and database.
 * @returns {{app: firebase.app.App, database: firebase.database.Database}}
 */
export function initializeFirebase() {
    if (!app) {
        app = firebase.initializeApp(firebaseConfig);
        database = firebase.database();
    }
    return { app, database };
}