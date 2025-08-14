/**
 * playerActions.js
 * Contains functions related to direct player actions like confirming names and selecting avatars.
 */
import { playerData, gameState, resetGameState, getInitialPlayerData, setGameState } from './playerState.js';
import { getRandomElement } from './utils.js';
import { updateLayout } from './game.js';

// Define available avatars
export const AVATAR_SVGS = [
    "https://www.svgrepo.com/download/3514/american-football.svg",
    "https://www.svgrepo.com/download/58433/american-football-player.svg",
    "https://www.svgrepo.com/download/9002/american-football-jersey.svg",
    "https://www.svgrepo.com/download/205005/american-football-helmet.svg",
    "https://www.svgrepo.com/download/106538/american-football-emblem.svg",
    "https://www.svgrepo.com/download/162507/american-football-stadium.svg",
    "https://www.svgrepo.com/download/150537/american-football.svg"
];

/**
 * Helper function to update the avatar preview image and placeholder.
 * @param {number} playerNum - The player number (1 or 2).
 * @param {string|null} avatarUrl - The URL of the selected avatar, or null to show placeholder.
 */
export function updateAvatarPreview(playerNum, avatarUrl) {
    const previewImg = document.getElementById(`player${playerNum}-avatar-preview`).querySelector('.player-avatar-img');
    const placeholderSpan = document.getElementById(`player${playerNum}-avatar-preview`).querySelector('.avatar-placeholder');

    if (avatarUrl) {
        previewImg.src = avatarUrl;
        previewImg.style.display = 'block';
        placeholderSpan.style.display = 'none';
    } else {
        previewImg.src = '';
        previewImg.style.display = 'none';
        placeholderSpan.style.display = 'block';
    }
}

/**
 * Callback function to set player avatar.
 * @param {number} playerNum - The player number (1 or 2).
 * @param {string} avatarUrl - The URL of the selected avatar.
 * @param {boolean} isMultiplayer - Flag for multiplayer mode.
 * @param {object} gameRef - Firebase reference.
 */
export function selectAvatar(playerNum, avatarUrl, isMultiplayer, gameRef) {
    playerData[playerNum].avatar = avatarUrl;
    if (isMultiplayer) {
        gameRef.child('playerData').child(playerNum).set(playerData[playerNum]);
    } else {
        localStorage.setItem(`fantasyTeam_${playerNum}`, JSON.stringify(playerData[playerNum]));
        updateLayout();
    }
}

/**
 * Handles the confirmation of a player's name.
 * @param {number} playerNum - The player number (1 or 2).
 * @param {boolean} isMultiplayer - Flag for multiplayer mode.
 * @param {object} gameRef - Firebase reference.
 */
export function confirmName(playerNum, isMultiplayer, gameRef) {
    const input = document.getElementById(`player${playerNum}-name`);
    const name = input.value.trim();
    
    if (!name) {
        alert('Please enter a name!');
        return;
    }
    
    playerData[playerNum].name = name;

    // If no avatar selected, pick a random one
    if (!playerData[playerNum].avatar) {
        playerData[playerNum].avatar = getRandomElement(AVATAR_SVGS);
    }
    
    if(isMultiplayer) {
        gameRef.child('playerData').child(playerNum).set(playerData[playerNum]);
    } else {
        localStorage.setItem(`fantasyTeam_${playerNum}`, JSON.stringify(playerData[playerNum]));
        updateLayout(false); // Pass false to prevent turn switch on name confirm
    }
}

/**
 * Resets a player's fantasy data and UI.
 * @param {number} playerNum - The player number (1 or 2).
 * @param {boolean} isMultiplayer - Flag for multiplayer mode.
 * @param {object} gameRef - Firebase reference.
 */
export function resetPlayer(playerNum, isMultiplayer, gameRef) {
    const newPlayerData = getInitialPlayerData();

    if (isMultiplayer) {
        // In multiplayer, a reset just clears this player's data.
        // We only reset if it's our player.
        // The overall game state (turn) might need adjusting if the game is in progress.
        // For simplicity, we just clear our data. A full game reset needs a different mechanism.
        gameRef.child('playerData').child(playerNum).set(newPlayerData);

        // If both players reset, reset the game state
        gameRef.child('playerData').once('value', (snapshot) => {
            const allPlayersData = snapshot.val();
            if(!allPlayersData[1].name && !allPlayersData[2].name) {
                gameRef.child('gameState').set(resetGameState());
            }
        });

    } else {
        // Local game logic
        playerData[playerNum] = newPlayerData;
        localStorage.removeItem(`fantasyTeam_${playerNum}`);
        
        const otherPlayerNum = playerNum === 1 ? 2 : 1;

        // If both players are reset, also reset the shared game state
        if (!playerData[1].name && !playerData[2].name) {
            setGameState(resetGameState());
        } else if (playerData[otherPlayerNum].name) {
            // If the other player is still in the game, make it their turn.
            gameState.currentPlayer = otherPlayerNum;
        }
        
        // Clear input values
        document.getElementById(`player${playerNum}-name`).value = '';
        
        updateLayout();
    }
}