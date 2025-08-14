/**
 * playerActions.js
 * Contains functions related to direct player actions like confirming names and selecting avatars.
 */
import { playerData } from './playerState.js';
import { getRandomElement } from './utils.js';
import { updateLayout } from './game.js';
import { isMultiplayerGame, sendPresenceUpdate, getLocalPlayerNum } from './multiplayer.js';

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
 */
export function selectAvatar(playerNum, avatarUrl) {
    if (isMultiplayerGame() && playerNum !== getLocalPlayerNum()) {
        return; // Prevent opponent's avatar from being changed
    }
    playerData[playerNum].avatar = avatarUrl;
    if (isMultiplayerGame()) {
        sendPresenceUpdate({ avatar: avatarUrl });
    } else {
        localStorage.setItem(`fantasyTeam_${playerNum}`, JSON.stringify(playerData[playerNum]));
    }
    // The preview and title will be updated by updateLayout when it's called after selection/modal close.
    updateLayout();
}

/**
 * Handles the confirmation of a player's name.
 * @param {number} playerNum - The player number (1 or 2).
 */
export function confirmName(playerNum) {
    const input = document.getElementById(`player${playerNum}-name`);
    const name = input.value.trim();
    
    if (isMultiplayerGame() && playerNum !== getLocalPlayerNum()) {
        return; // Prevent confirming name for the opponent
    }

    if (!name) {
        alert('Please enter a name!');
        return;
    }
    
    playerData[playerNum].name = name;
    playerData[playerNum].isSetupStarted = true; // Mark setup as started

    // If no avatar selected, pick a random one
    if (!playerData[playerNum].avatar) {
        playerData[playerNum].avatar = getRandomElement(AVATAR_SVGS);
    }
    
    if (isMultiplayerGame()) {
        // Send all relevant updates at once. The UI will update via handleStateUpdate.
        sendPresenceUpdate({ 
            name: playerData[playerNum].name, 
            avatar: playerData[playerNum].avatar,
            isSetupStarted: true 
        });
    } else {
        localStorage.setItem(`fantasyTeam_${playerNum}`, JSON.stringify(playerData[playerNum])); // Save state after name confirmation
        // For local play, we still need to manually trigger the update.
        updateLayout(false);
    }
}