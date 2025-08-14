import { playerData, gameState, setGamePhase } from './playerState.js';
import { updateLayout } from './game.js';
import { resetPlayer } from './gameFlow.js';
import { showTeamAnimationOverlay, hideTeamAnimationOverlay } from './uiAnimations.js';

let room;
let isMultiplayer = false;
let localPlayerNum = 0;

// Function to check if the current game is multiplayer
export const isMultiplayerGame = () => isMultiplayer;
export const getLocalPlayerNum = () => localPlayerNum;
export const getRoom = () => room;


// Function to initialize multiplayer
export async function initMultiplayer() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') !== 'multiplayer') {
        return;
    }
    isMultiplayer = true;

    const infoBox = document.getElementById('multiplayer-info-box');
    infoBox.style.display = 'block';

    const shareLinkInput = document.getElementById('share-link-input');
    shareLinkInput.value = window.location.href;

    const copyBtn = document.getElementById('copy-link-btn');
    copyBtn.addEventListener('click', () => {
        shareLinkInput.select();
        document.execCommand('copy');
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
    });

    room = new WebsimSocket();
    await room.initialize();

    setupInitialState();

    room.subscribePresence(handleStateUpdate);
    room.subscribeRoomState(handleStateUpdate);
    
    room.onmessage = (event) => {
        const { data } = event;
        if (data.type === 'teamAnimation') {
            showTeamAnimationOverlay(data.text, data.logoSrc, data.isAvatar);
        } else if (data.type === 'hideTeamAnimation') {
            hideTeamAnimationOverlay();
        }
    };

    handleStateUpdate();
}

function setupInitialState() {
    const isFirstPlayer = Object.keys(room.peers).length === 1 && !room.roomState.gamePhase;

    if (isFirstPlayer) {
        room.updateRoomState({
            gamePhase: 'NAME_ENTRY',
            currentPlayerClientId: room.clientId,
            player1: room.clientId,
            player2: null,
        });
    } else if (!room.roomState.player2 && room.roomState.player1 !== room.clientId) {
        room.updateRoomState({ player2: room.clientId });
    }

    // Initialize presence if it doesn't exist
    if (!room.presence[room.clientId]) {
        room.updatePresence({
            name: '', avatar: null, team: null, 
            draftedPlayers: {}, 
            rosterSlots: { QB: null, RB: null, WR1: null, WR2: null, TE: null, Flex: null, DEF: null, K: null },
            isSetupStarted: false,
        });
    }
}

function handleStateUpdate() {
    if (!isMultiplayer || !room.roomState || !room.presence) return;
    
    const previousPlayerNum = localPlayerNum;
    localPlayerNum = room.roomState.player1 === room.clientId ? 1 : (room.roomState.player2 === room.clientId ? 2 : 0);
    
    // If the player number has just been assigned, we might need to update the layout
    const justJoined = previousPlayerNum === 0 && localPlayerNum !== 0;

    // Map server state to local playerData and gameState
    const { player1: player1Id, player2: player2Id, currentPlayerClientId, gamePhase } = room.roomState;

    if (player1Id && room.presence[player1Id]) {
        playerData[1] = { ...playerData[1], ...room.presence[player1Id] };
    } else {
        // Soft reset without triggering updates
        playerData[1] = { name: '', avatar: null, team: null, draftedPlayers: [], rosterSlots: { QB: null, RB: null, WR1: null, WR2: null, TE: null, Flex: null, DEF: null, K: null }, isSetupStarted: false };
    }

    if (player2Id && room.presence[player2Id]) {
        playerData[2] = { ...playerData[2], ...room.presence[player2Id] };
    } else {
        playerData[2] = { name: '', avatar: null, team: null, draftedPlayers: [], rosterSlots: { QB: null, RB: null, WR1: null, WR2: null, TE: null, Flex: null, DEF: null, K: null }, isSetupStarted: false };
    }
    
    setGamePhase(gamePhase || 'NAME_ENTRY');
    gameState.currentPlayer = currentPlayerClientId === player1Id ? 1 : (currentPlayerClientId === player2Id ? 2 : 1);

    updateGameStatusText();
    updateLayout();
}

function updateGameStatusText() {
    const gameStatusText = document.getElementById('game-status-text');
    const { player1, player2, gamePhase } = room.roomState;

    if (!player2) {
        gameStatusText.textContent = 'Waiting for opponent to join...';
        gameStatusText.style.color = '#f59e0b';
    } else {
        if (gamePhase === 'NAME_ENTRY') {
             gameStatusText.textContent = 'Both players connected. Enter your names!';
             gameStatusText.style.color = '#10b981';
        } else if (gamePhase === 'DRAFTING') {
            const currentTurnPlayerNum = gameState.currentPlayer;
            const currentTurnPlayerName = playerData[currentTurnPlayerNum]?.name || `Player ${currentTurnPlayerNum}`;
            const localPlayerName = playerData[localPlayerNum]?.name;

            if (currentTurnPlayerName === localPlayerName) {
                gameStatusText.textContent = `It's your turn to draft!`;
            } else {
                gameStatusText.textContent = `Waiting for ${currentTurnPlayerName} to draft...`;
            }
            gameStatusText.style.color = '#3b82f6';
        } else if (gamePhase === 'COMPLETE') {
            gameStatusText.textContent = 'Game complete! Well played!';
            gameStatusText.style.color = '#10b981';
        }
    }
}

// Functions to broadcast updates
export function sendPresenceUpdate(update) {
    if (!isMultiplayer) return;
    room.updatePresence(update);
}

export function sendRoomStateUpdate(update) {
    if (!isMultiplayer) return;
    room.updateRoomState(update);
}

export function sendAnimation(animationData) {
    if (!isMultiplayer) return;
    room.send({ ...animationData, echo: false });
}