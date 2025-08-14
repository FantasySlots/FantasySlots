import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, get, push, serverTimestamp, onDisconnect } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCJAJKkiwfDoGfI8CzWK2kkJRwo55yDvOc",
  authDomain: "nfl-fantasy-slots.firebaseapp.com",
  projectId: "nfl-fantasy-slots",
  storageBucket: "nfl-fantasy-slots.firebasestorage.app",
  messagingSenderId: "516330061675",
  appId: "1:516330061675:web:829f14031afef0bccc962e",
  measurementId: "G-RH80H7FNQ4"
};

let app;
let db;

export function initFirebase() {
    if (!app) {
        try {
            app = initializeApp(firebaseConfig);
            db = getDatabase(app);
            console.log("Firebase initialized successfully.");
        } catch (e) {
            console.error("Firebase initialization failed:", e);
        }
    }
}

export async function createGameSession(initialPlayerData) {
    const gamesRef = ref(db, 'games');
    const newGameRef = push(gamesRef);
    
    const initialGameState = {
        playerData: initialPlayerData,
        gameState: {
            turn: 1,
            status: 'waiting_for_p2',
            lastAction: null,
            winner: null
        },
        createdAt: serverTimestamp()
    };
    
    await set(newGameRef, initialGameState);
    return newGameRef.key;
}

export function onGameStateUpdate(gameId, callback) {
    const gameRef = ref(db, `games/${gameId}`);
    onValue(gameRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            callback(data);
        }
    });
}

export function updateGameState(gameId, newGameState) {
    const gameRef = ref(db, `games/${gameId}`);
    return set(gameRef, newGameState);
}

export async function getGameState(gameId) {
    const gameRef = ref(db, `games/${gameId}`);
    const snapshot = await get(gameRef);
    return snapshot.val();
}

export function markPlayerPresence(gameId, playerNum) {
    const presenceRef = ref(db, `games/${gameId}/playerData/${playerNum}/isPresent`);
    
    onDisconnect(presenceRef).set(false).then(() => {
        set(presenceRef, true);
        if (playerNum === 2) {
             set(ref(db, `games/${gameId}/gameState/status`), 'drafting');
        }
    });
}

