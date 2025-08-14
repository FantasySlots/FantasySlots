/**
 * playerState.js
 * Manages the core game state related to players, their rosters, and helper functions
 * to check roster status.
 */

export const playerData = {
    1: { 
        name: '', 
        avatar: null, // NEW: Added avatar property
        team: null, 
        draftedPlayers: [], 
        rosterSlots: { 
            QB: null, RB: null, WR1: null, WR2: null, TE: null, Flex: null, DEF: null, K: null 
        },
        isSetupStarted: false, // NEW: Flag to track if player's setup process has begun
        isPresent: false // NEW: for multiplayer
    },
    2: { 
        name: '', 
        avatar: null, // NEW: Added avatar property
        team: null, 
        draftedPlayers: [], 
        rosterSlots: {
            QB: null, RB: null, WR1: null, WR2: null, TE: null, Flex: null, DEF: null, K: null 
        },
        isSetupStarted: false, // NEW: Flag to track if player's setup process has begun
        isPresent: false // NEW: for multiplayer
    }
};

/**
 * Checks if a player's fantasy roster is completely full.
 * @param {number} playerNum - The player number (1 or 2).
 * @param {object} pData - Optional player data object to check against (for multiplayer state).
 * @returns {boolean} True if the roster is full, false otherwise.
 */
export function isFantasyRosterFull(playerNum, pData = playerData) {
    const roster = pData[playerNum].rosterSlots;
    const requiredSlots = ['QB', 'RB', 'WR1', 'WR2', 'TE', 'Flex', 'DEF', 'K'];
    return requiredSlots.every(slot => roster[slot] !== null);
}

/**
 * Checks if a player's fantasy roster has any available slot for a given position type.
 * @param {number} playerNum - The player number (1 or 2).
 * @param {string} originalPosition - The player's original position (e.g., 'QB', 'RB', 'WR', 'TE', 'K', 'DEF').
 * @returns {boolean} True if no slot is available for that position, false otherwise.
 */
export function isPlayerPositionUndraftable(playerNum, originalPosition) {
    const rosterSlots = playerData[playerNum].rosterSlots;

    if (originalPosition === 'QB') {
        return rosterSlots.QB !== null;
    }
    if (originalPosition === 'RB') {
        return rosterSlots.RB !== null && rosterSlots.Flex !== null;
    }
    if (originalPosition === 'WR') {
        return rosterSlots.WR1 !== null && rosterSlots.WR2 !== null && rosterSlots.Flex !== null;
    }
    if (originalPosition === 'TE') {
        return rosterSlots.TE !== null && rosterSlots.Flex !== null;
    }
    if (originalPosition === 'K') {
        return rosterSlots.K !== null;
    }
    if (originalPosition === 'DEF') {
        return rosterSlots.DEF !== null;
    }
    return true; 
}