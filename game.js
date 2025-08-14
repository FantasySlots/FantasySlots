/**
 * game.js
 * Contains the core game logic, state management, and orchestration of UI and API interactions.
 */

// Import from new modular files
import { playerData, isFantasyRosterFull, isPlayerPositionUndraftable } from './playerState.js';
import { shuffleArray, getRandomElement } from './utils.js';
import { getOrCreateChild, updatePlayerContentDisplay, displayDraftInterface, displayFantasyRoster, renderPlayerAvatar, renderAvatarSelectionOptions } from './uiRenderer.js';
import { showSlotSelectionModal, hideSlotSelectionModal, hideRosterModal, showPlayerStatsModal, hidePlayerStatsModal, renderPlayerStatsInModal, showAvatarSelectionModal, hideAvatarSelectionModal } from './uiModals.js';
import { showTeamAnimationOverlay, hideTeamAnimationOverlay } from './uiAnimations.js';
import * as firebase from './firebase.js';

// Import API functions
import { getTank01PlayerID, fetchLastGameStats } from './api.js';

// Import static data
import { teams } from './data.js'; 

// NEW: Define available avatars
const AVATAR_SVGS = [
    "https://www.svgrepo.com/download/3514/american-football.svg",
    "https://www.svgrepo.com/download/58433/american-football-player.svg",
    "https://www.svgrepo.com/download/9002/american-football-jersey.svg",
    "https://www.svgrepo.com/download/205005/american-football-helmet.svg",
    "https://www.svgrepo.com/download/106538/american-football-emblem.svg",
    "https://www.svgrepo.com/download/162507/american-football-stadium.svg",
    "https://www.svgrepo.com/download/150537/american-football.svg"
];

// NEW: Global state for multiplayer
let gameMode = 'local';
let gameId = null;
let localPlayerNum = null; // Will be 1 or 2 in multiplayer
let fullGameState = null; // This will hold the entire state from Firebase

/**
 * Helper function to update the avatar preview image and placeholder.
 * @param {number} playerNum - The player number (1 or 2).
 * @param {string|null} avatarUrl - The URL of the selected avatar, or null to show placeholder.
 */
function updateAvatarPreview(playerNum, avatarUrl) {
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
function selectAvatar(playerNum, avatarUrl) {
    if (gameMode === 'multiplayer') {
        if (playerNum !== localPlayerNum) { alert("Not your player!"); return; }
        const newState = JSON.parse(JSON.stringify(fullGameState));
        newState.playerData[playerNum].avatar = avatarUrl;
        firebase.updateGameState(gameId, newState);
    } else {
        playerData[playerNum].avatar = avatarUrl;
        localStorage.setItem(`fantasyTeam_${playerNum}`, JSON.stringify(playerData[playerNum]));
        updateLayout();
    }
}

/**
 * Handles the confirmation of a player's name.
 * @param {number} playerNum - The player number (1 or 2).
 */
function confirmName(playerNum) {
    if (gameMode === 'multiplayer') {
        if (playerNum !== localPlayerNum) { alert("It's not your turn!"); return; }
    }
    const input = document.getElementById(`player${playerNum}-name`);
    const name = input.value.trim();
    
    if (!name) {
        alert('Please enter a name!');
        return;
    }
    
    if (gameMode === 'multiplayer') {
        const newState = JSON.parse(JSON.stringify(fullGameState));
        newState.playerData[playerNum].name = name;
        if (!newState.playerData[playerNum].avatar) {
            newState.playerData[playerNum].avatar = getRandomElement(AVATAR_SVGS);
        }
        newState.gameState.lastAction = `${name} confirmed for Player ${playerNum}`;
        firebase.updateGameState(gameId, newState);
    } else {
        playerData[playerNum].name = name;

        // If no avatar selected, pick a random one
        if (!playerData[playerNum].avatar) {
            playerData[playerNum].avatar = getRandomElement(AVATAR_SVGS);
        }
        
        localStorage.setItem(`fantasyTeam_${playerNum}`, JSON.stringify(playerData[playerNum])); // Save state after name confirmation
        
        // Update layout based on the new name confirmed state
        updateLayout(); 
    }
}

/**
 * Handles the process of selecting a random NFL team.
 * @param {number} playerNum - The player number (1 or 2).
 */
async function selectTeam(playerNum) {
    if (gameMode === 'multiplayer') {
        if (playerNum !== localPlayerNum || fullGameState.gameState.turn !== localPlayerNum) {
            alert("It's not your turn!");
            return;
        }
    }
    // If roster is full, prevent new team selection or auto-draft.
    if (isFantasyRosterFull(playerNum)) {
        alert('Your fantasy roster is full! You cannot draft more players.');
        return;
    }

    // Reset current team's drafted players for a new drafting turn
    playerData[playerNum].team = null;
    playerData[playerNum].draftedPlayers = []; 
    console.log(`Player ${playerNum}: draftedPlayers reset to [] after selecting new team.`);
    
    // Clear the player content area immediately for the animation
    document.getElementById(`player${playerNum}-content-area`).innerHTML = ''; 

    showTeamAnimationOverlay(); // Show animation overlay
    
    // Animate through logos
    let currentIndex = 0;
    const animationDuration = 3100; // 2.5 seconds
    const interval = 100; // Change every 100ms
    
    const animateInterval = setInterval(() => {
        const currentTeamLogo = teams[currentIndex].logo;
        showTeamAnimationOverlay(currentTeamLogo); // Update logo during animation
        currentIndex = (currentIndex + 1) % teams.length;
    }, interval);
    
    // Select random team after animation duration
    setTimeout(async () => {
        clearInterval(animateInterval);
        const randomTeam = teams[Math.floor(Math.random() * teams.length)];
        
        showTeamAnimationOverlay(randomTeam.logo); 
        
        try {
            const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${randomTeam.id}/roster`);
            const data = await response.json();
            const rosterData = data.athletes || [];

            if (gameMode === 'multiplayer') {
                const newState = JSON.parse(JSON.stringify(fullGameState));
                newState.playerData[playerNum].team = randomTeam;
                newState.playerData[playerNum].team.rosterData = rosterData;
                newState.playerData[playerNum].draftedPlayers = [];
                newState.gameState.lastAction = `${newState.playerData[playerNum].name} selected ${randomTeam.name}.`;
                await firebase.updateGameState(gameId, newState);
            } else {
                playerData[playerNum].team = randomTeam;
                if (rosterData) {
                    playerData[playerNum].team.rosterData = rosterData; 
                    localStorage.setItem(`fantasyTeam_${playerNum}`, JSON.stringify(playerData[playerNum]));
                }
            }
            
            // Wait a bit then hide animation and update UI
            setTimeout(async () => {
                hideTeamAnimationOverlay();
                if (gameMode === 'local') {
                    updateLayout();
                }
                // In multiplayer, layout is updated by handleRemoteStateUpdate
            }, 500);

        } catch (error) {
            console.error('Error fetching roster:', error);
            hideTeamAnimationOverlay();
        }
    }, animationDuration);
}

/**
 * Handles the auto-drafting process for a player.
 * @param {number} playerNum - The player number (1 or 2).
 */
async function autoDraft(playerNum) {
    if (!playerData[playerNum].name) {
        alert('Please enter your name first!');
        return;
    }
    if (isFantasyRosterFull(playerNum)) {
        alert('Your fantasy roster is already full! You cannot auto-draft more players.');
        return;
    }

    // Reset current team's drafted players for a new drafting turn
    // `draftedPlayers` is specifically for manual draft's "one player per team spin" rule.
    // Auto-draft bypasses this, so we ensure it's cleared but don't populate it with auto-draft picks.
    playerData[playerNum].team = null; // Clear any previously selected team
    playerData[playerNum].draftedPlayers = []; 
    console.log(`Player ${playerNum}: draftedPlayers reset to [] for auto-draft.`);
    
    // Clear the player content area immediately for the animation
    document.getElementById(`player${playerNum}-content-area`).innerHTML = ''; 

    // Show player's avatar immediately when starting auto-draft
    showTeamAnimationOverlay(playerData[playerNum].avatar, true); 
    
    const animationDuration = 3098;
    const interval = 100;
    
    const animateInterval = setInterval(() => {
        // Keep showing player's avatar during auto-draft animation, with `isAvatar` flag set to true
        showTeamAnimationOverlay(playerData[playerNum].avatar, true);
    }, interval);

    setTimeout(async () => {
        clearInterval(animateInterval);
        // For auto-draft, we display a random team logo, but players come from all teams.
        const randomTeamDisplay = teams[Math.floor(Math.random() * teams.length)];
        playerData[playerNum].team = randomTeamDisplay; // This is set so that updateLayout shows something if needed

        // Show player's avatar in the final animation frame, with `isAvatar` flag set to true
        showTeamAnimationOverlay(playerData[playerNum].avatar, true);

        try {
            let allAvailableNFLPlayers = [];

            // Fetch rosters for ALL teams and combine players
            for (const team of teams) {
                const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${team.id}/roster`);
                const data = await response.json();
                
                if (data.athletes) {
                    // Add all players from this team
                    allAvailableNFLPlayers.push(...data.athletes.flatMap(positionGroup => positionGroup.items || []));
                }

                // Add a Defense player object for this team
                const defPlayer = {
                    id: `DEF-${team.id}`,
                    displayName: team.name,
                    position: { name: 'Defense', abbreviation: 'DEF' },
                    headshot: { href: team.logo }
                };
                allAvailableNFLPlayers.push(defPlayer);
            }

            // Filter out players already on the fantasy roster (should be empty if starting fresh auto-draft)
            // And normalize 'PK' to 'K'
            const currentRosterIds = new Set(Object.values(playerData[playerNum].rosterSlots).filter(p => p).map(p => p.id));
            allAvailableNFLPlayers = allAvailableNFLPlayers.filter(p => !currentRosterIds.has(p.id)).map(p => {
                if (p.position?.abbreviation === 'PK') p.position.abbreviation = 'K';
                return p;
            });
            
            shuffleArray(allAvailableNFLPlayers); // Shuffle the entire pool of players

            const rosterSlotsOrder = ['QB', 'RB', 'WR1', 'WR2', 'TE', 'Flex', 'DEF', 'K'];
            const autoDraftedThisSpinIds = new Set(); // To prevent drafting the same player twice in this auto-draft session

            for (const slotId of rosterSlotsOrder) {
                if (playerData[playerNum].rosterSlots[slotId] === null) { // Only attempt to fill empty slots
                    const allowedPos = {
                        'QB': ['QB'], 'RB': ['RB'], 'WR1': ['WR'], 'WR2': ['WR'], 'TE': ['TE'],
                        'Flex': ['RB', 'WR', 'TE'], 'DEF': ['DEF'], 'K': ['K']
                    }[slotId];
                    
                    const chosenPlayerIndex = allAvailableNFLPlayers.findIndex(p => {
                        const playerPos = p.position?.abbreviation || p.position?.name;
                        return allowedPos.includes(playerPos) && !autoDraftedThisSpinIds.has(p.id);
                    });

                    if (chosenPlayerIndex !== -1) {
                        const chosenPlayer = allAvailableNFLPlayers[chosenPlayerIndex];
                        
                        playerData[playerNum].rosterSlots[slotId] = {
                            id: chosenPlayer.id,
                            displayName: chosenPlayer.displayName,
                            originalPosition: chosenPlayer.position?.abbreviation || chosenPlayer.position?.name,
                            assignedSlot: slotId,
                            headshot: chosenPlayer.headshot,
                            fantasyPoints: null, // Points will be fetched later
                            statsData: null      // Stats data will be fetched later
                        };
                        autoDraftedThisSpinIds.add(chosenPlayer.id); // Mark as drafted in this session
                        allAvailableNFLPlayers.splice(chosenPlayerIndex, 1); // Remove from pool to prevent re-picking
                        
                        // Do NOT push to playerData[playerNum].draftedPlayers here.
                        // That array is specifically for the "one player per team spin" rule for manual drafting.
                        // Auto-draft is a complete roster fill process.
                    }
                }
            }

            localStorage.setItem(`fantasyTeam_${playerNum}`, JSON.stringify(playerData[playerNum]));
            
            setTimeout(() => {
                hideTeamAnimationOverlay(); 
                updateLayout(); // Update layout based on auto-draft completion
            }, 500);

        } catch (error) {
            console.error('Error during auto-draft:', error);
            setTimeout(() => hideTeamAnimationOverlay(), 500);
            alert('Failed to auto-draft. Please try again or select a team manually.');
        }
    }, animationDuration);
}

/**
 * Resets a player's fantasy data and UI.
 * @param {number} playerNum - The player number (1 or 2).
 */
function resetPlayer(playerNum) {
    if (gameMode === 'multiplayer') {
        alert("Reset is disabled in multiplayer games.");
        return;
    }
    playerData[playerNum] = { 
        name: '', 
        avatar: null, // Reset avatar as well
        team: null, 
        draftedPlayers: [], 
        rosterSlots: {
            QB: null, RB: null, WR1: null, WR2: null, TE: null, Flex: null, DEF: null, K: null
        },
        isSetupStarted: false // Reset this flag on full reset
    };
    
    localStorage.removeItem(`fantasyTeam_${playerNum}`);
    
    // Clear input values
    document.getElementById(`player${playerNum}-name`).value = '';
    
    // Reset player title to default "Player X" and remove avatar
    renderPlayerAvatar(playerNum, `Player ${playerNum}`, null); 
    
    // Clear player logo and team name display content
    const playerLogoEl = document.getElementById(`player${playerNum}-logo`);
    playerLogoEl.src = ''; 
    playerLogoEl.alt = '';
    playerLogoEl.classList.remove('is-avatar'); 
    document.getElementById(`player${playerNum}-team-name`).textContent = '';

    // Reset avatar preview to placeholder state
    updateAvatarPreview(playerNum, null);

    // Hide any open modals
    hideSlotSelectionModal();
    hidePlayerStatsModal();
    hideRosterModal(); 
    hideAvatarSelectionModal(); 
    
    // Crucially, call updateLayout to refresh UI based on reset state
    updateLayout();
}

/**
 * Initiates the drafting process for a selected player.
 * @param {number} playerNum - The player number (1 or 2).
 * @param {object} player - The NFL player object to draft.
 * @param {string} originalPosition - The player's original position (e.g., 'QB', 'RB', 'WR', 'TE', 'K', 'DEF').
 */
function draftPlayer(playerNum, player, originalPosition) {
    if (gameMode === 'multiplayer') {
        if (playerNum !== localPlayerNum || fullGameState.gameState.turn !== localPlayerNum) {
            alert("It's not your turn!");
            return;
        }
    }
    const isAlreadyInFantasyRoster = Object.values(playerData[playerNum].rosterSlots).some(slotPlayer => slotPlayer && slotPlayer.id === player.id);
    if (isAlreadyInFantasyRoster) {
        console.warn(`Player ${player.displayName} is already in Player ${playerNum}'s fantasy roster.`);
        alert(`${player.displayName} is already in your fantasy roster!`);
        return;
    }

    // This check ensures only one player is drafted per 'team spin'
    if (playerData[playerNum].draftedPlayers.length > 0) {
        console.warn(`Player ${playerNum} has already drafted a player from this team. draftedPlayers.length: ${playerData[playerNum].draftedPlayers.length}`);
        alert('You have already drafted a player from this team. Please select a new team or auto-draft to draft another player.');
        return;
    }

    if (isFantasyRosterFull(playerNum)) {
        console.warn(`Player ${playerNum}'s fantasy roster is full. Cannot draft ${player.displayName}.`);
        alert('Your fantasy roster is full! You cannot draft more players.');
        return;
    }

    const flexPositions = ['RB', 'WR', 'TE'];

    if (flexPositions.includes(originalPosition)) {
        showSlotSelectionModal(player, playerNum, originalPosition, playerData[playerNum], assignPlayerToSlot, hideSlotSelectionModal);
    } else {
        let targetSlot;
        if (originalPosition === 'QB') targetSlot = 'QB';
        else if (originalPosition === 'K') targetSlot = 'K';
        else if (originalPosition === 'DEF') targetSlot = 'DEF';

        if (targetSlot) {
            assignPlayerToSlot(playerNum, player, targetSlot);
        } else {
            console.error(`Attempted to draft ${player.displayName} (${originalPosition}) to an unknown slot.`);
            alert(`Cannot draft ${player.displayName} to an unknown slot for position ${originalPosition}.`);
        }
    }
}

/**
 * Assigns a drafted player to a specific fantasy roster slot.
 * @param {number} playerNum - The player number (1 or 2).
 * @param {object} playerObj - The NFL player object to assign.
 * @param {string} slotId - The fantasy roster slot ID (e.g., 'QB', 'RB', 'WR1').
 */
function assignPlayerToSlot(playerNum, playerObj, slotId) {
    const isAlreadyInFantasyRoster = Object.values(playerData[playerNum].rosterSlots).some(slotPlayer => slotPlayer && slotPlayer.id === playerObj.id);
    if (isAlreadyInFantasyRoster) {
        console.warn(`ASSIGNMENT BLOCKED: ${playerObj.displayName} is already in Player ${playerNum}'s fantasy roster.`);
        alert(`${playerObj.displayName} is already in your fantasy roster!`);
        hideSlotSelectionModal();
        return;
    }

    // This check ensures only one player is drafted per 'team spin'
    if (playerData[playerNum].draftedPlayers.length > 0) {
        console.warn(`ASSIGNMENT BLOCKED: Player ${playerNum} has already drafted a player from this team (length: ${playerData[playerNum].draftedPlayers.length}).`);
        alert('You have already drafted a player from this team. Please select a new team or auto-draft to draft another player.');
        hideSlotSelectionModal();
        return;
    }

    if (playerData[playerNum].rosterSlots[slotId]) {
        console.warn(`ASSIGNMENT BLOCKED: The ${slotId} slot for Player ${playerNum} is already occupied by ${playerData[playerNum].rosterSlots[slotId].displayName}.`);
        alert(`The ${slotId} slot is already occupied by ${playerData[playerNum].rosterSlots[slotId].displayName}.`);
        hideSlotSelectionModal();
        return;
    }

    // If all checks pass, assign the player
    console.log(`Assigning ${playerObj.displayName} to ${slotId} for Player ${playerNum}.`);

    if (gameMode === 'multiplayer') {
        const newState = JSON.parse(JSON.stringify(fullGameState));
        newState.playerData[playerNum].rosterSlots[slotId] = {
            id: playerObj.id,
            displayName: playerObj.displayName,
            originalPosition: playerObj.position?.abbreviation || playerObj.position?.name,
            assignedSlot: slotId,
            headshot: playerObj.headshot,
            fantasyPoints: null,
            statsData: null
        };
        newState.playerData[playerNum].draftedPlayers.push({ id: playerObj.id, assignedSlot: slotId });
        
        // Clear team selection for next turn's roll
        newState.playerData[playerNum].team = null; 
        
        // Switch turns
        newState.gameState.turn = (playerNum === 1) ? 2 : 1;
        newState.gameState.lastAction = `${newState.playerData[playerNum].name} drafted ${playerObj.displayName}.`;
        
        // Check for game over
        const p1RosterFull = isFantasyRosterFull(1, newState.playerData);
        const p2RosterFull = isFantasyRosterFull(2, newState.playerData);
        if (p1RosterFull && p2RosterFull) {
            newState.gameState.status = 'complete';
        }

        firebase.updateGameState(gameId, newState);
    } else {
        playerData[playerNum].rosterSlots[slotId] = {
            id: playerObj.id,
            displayName: playerObj.displayName,
            originalPosition: playerObj.position?.abbreviation || playerObj.position?.name,
            assignedSlot: slotId,
            headshot: playerObj.headshot,
            fantasyPoints: null,
            statsData: null
        };

        playerData[playerNum].draftedPlayers.push({ id: playerObj.id, assignedSlot: slotId });
        localStorage.setItem(`fantasyTeam_${playerNum}`, JSON.stringify(playerData[playerNum]));
        updateLayout();
    }
    hideSlotSelectionModal();
}

/**
 * Utility function to open player stats modal, acting as a bridge.
 * This is needed because `displayFantasyRoster` in `uiRenderer.js` requires a callback,
 * and that callback needs to pass `getTank01PlayerID` and `fetchLastGameStats` (from `api.js`)
 * and `renderPlayerStatsInModal` (from `uiModals.js`) to `showPlayerStatsModal`.
 * @param {object} playerObj - The player object from the fantasy roster.
 */
function openPlayerStatsModalCaller(playerObj) {
    showPlayerStatsModal(playerObj, teams, getTank01PlayerID, fetchLastGameStats, renderPlayerStatsInModal);
}

/**
 * Fetches and displays fantasy points for all players in a roster.
 * This is called when both rosters are full or on initial load for full rosters.
 * @param {number} playerNum - The player number (1 or 2).
 */
async function fetchAndDisplayPlayerFantasyPoints(playerNum) {
    const playerRoster = playerData[playerNum].rosterSlots;
    const rosterSlotsOrder = ['QB', 'RB', 'WR1', 'WR2', 'TE', 'Flex', 'DEF', 'K'];

    for (const slotId of rosterSlotsOrder) {
        const playerInSlot = playerRoster[slotId];
        if (playerInSlot && playerInSlot.fantasyPoints === null) {
            let playerNameForTank01 = playerInSlot.displayName;
            if (playerInSlot.originalPosition === 'DEF') {
                const team = teams.find(t => t.id === playerInSlot.id.split('-')[1]);
                if (team) {
                    playerNameForTank01 = `${team.name} Defense`;
                }
            }

            const tank01PlayerID = await getTank01PlayerID(playerNameForTank01);
            if (tank01PlayerID) {
                const result = await fetchLastGameStats(tank01PlayerID);
                playerInSlot.fantasyPoints = result ? result.fantasyPoints : 'N/A';
                playerInSlot.statsData = result ? result.stats : null;
            } else {
                playerInSlot.fantasyPoints = 'N/A';
                playerInSlot.statsData = null;
            }
            localStorage.setItem(`fantasyTeam_${playerNum}`, JSON.stringify(playerData[playerNum]));
            // Re-render the fantasy roster after each player's points are fetched
            displayFantasyRoster(playerNum, playerData[playerNum], teams, isFantasyRosterFull(playerNum), openPlayerStatsModalCaller); 
        }
    }
}

/**
 * Updates the main layout of the application (single player view vs. two-player view)
 * and the internal display of each player section (name input vs. team display, draft vs. fantasy roster).
 */
function updateLayout() {
    const playersContainer = document.querySelector('.players-container');
    const player1Section = document.getElementById('player1-section');
    const player2Section = document.getElementById('player2-section');
    const addPlayer2Button = document.getElementById('add-player2-btn');

    // Multiplayer-specific UI updates
    if (gameMode === 'multiplayer' && fullGameState) {
        const { status, turn } = fullGameState.gameState;
        const gameStatusText = document.getElementById('game-status-text');
        const animationOverlay = document.getElementById('team-animation');
        const animationText = document.getElementById('animation-main-text');

        addPlayer2Button.style.display = 'none'; // Hide "Add Player" button in multi
        document.querySelectorAll('.reset-btn, .auto-draft-btn').forEach(btn => btn.style.display = 'none');
        
        player1Section.style.display = 'block';
        player2Section.style.display = 'block';
        playersContainer.classList.add('two-player-view');

        if (status === 'waiting_for_p2') {
            gameStatusText.textContent = 'Waiting for Player 2 to join...';
            if (localPlayerNum === 1) {
                animationText.textContent = 'Waiting for Player 2...';
                animationOverlay.style.display = 'flex';
            }
        } else if (status === 'drafting') {
            gameStatusText.textContent = `It's Player ${turn}'s turn.`;
            if (turn !== localPlayerNum) {
                animationText.textContent = `Waiting for Player ${turn}...`;
                animationOverlay.style.display = 'flex';
            } else {
                animationOverlay.style.display = 'none';
            }
        } else if (status === 'complete') {
            gameStatusText.textContent = 'Draft complete! Calculating scores...';
            animationOverlay.style.display = 'none';
        }
        // Early return to skip local layout logic
        // We will now continue to let the rest of the function run to render player data
    } else {
        // Local play logic for Add Player 2 button
        const p1RosterFull = isFantasyRosterFull(1);
        const p2RosterFull = isFantasyRosterFull(2);
        const p2SetupStarted = playerData[2].isSetupStarted;
        const condition1 = p1RosterFull && !p2RosterFull && !p2SetupStarted;
        const condition2 = p2RosterFull && !p1RosterFull;
        addPlayer2Button.style.display = (condition1 || condition2) ? 'block' : 'none';
    }

    if (gameMode === 'local') {
        const p1RosterFull = isFantasyRosterFull(1);
        const p2RosterFull = isFantasyRosterFull(2);
        const p1NameConfirmed = !!playerData[1].name;
        const p2NameConfirmed = !!playerData[2].name;
        const p2SetupStarted = playerData[2].isSetupStarted;

        // Reset container classes and default section visibility
        playersContainer.classList.remove('single-player-view', 'two-player-view');
        player1Section.style.display = 'none'; // Default to hidden, will be set to block below
        player2Section.style.display = 'none'; // Default to hidden, will be set to block below
        addPlayer2Button.style.display = 'none'; // Default to hidden

        // Determine which player sections are visible and the overall layout
        if (p1RosterFull && p2RosterFull) {
            // State: Both full
            player1Section.style.display = 'block';
            player2Section.style.display = 'block';
            playersContainer.classList.add('two-player-view');
        } else if (p2SetupStarted || p2NameConfirmed) {
            // State: Player 2 is in progress (name confirmed or setup started)
            // Focus on Player 2's section, hide Player 1
            player1Section.style.display = 'none';
            player2Section.style.display = 'block';
            playersContainer.classList.add('single-player-view');
        } else {
            // State: Only Player 1 is active/in progress, Player 2 is uninitialized
            // Focus on Player 1's section, hide Player 2
            player1Section.style.display = 'block';
            player2Section.style.display = 'none';
            playersContainer.classList.add('single-player-view');
        }

        // Update internal display for each player section based on their individual state
        [1, 2].forEach(playerNum => {
            const nameInputContainer = document.querySelector(`#player${playerNum}-section .name-input-container`);
            const playerDisplayDiv = document.getElementById(`player${playerNum}-display`);
            const playerLogoEl = document.getElementById(`player${playerNum}-logo`);
            const playerNameConfirmed = !!playerData[playerNum].name;
            const playerContentArea = document.getElementById(`player${playerNum}-content-area`);
            const isCurrentPlayerRosterFull = isFantasyRosterFull(playerNum); // Get specific player's roster status

            // Handle visibility of name input vs team display
            if (playerNameConfirmed) {
                nameInputContainer.style.display = 'none';
                playerDisplayDiv.style.display = 'block';

                // Update player title with name and avatar
                renderPlayerAvatar(playerNum, playerData[playerNum].name, playerData[playerNum].avatar);

                // Update team logo / avatar and team name
                if (isCurrentPlayerRosterFull && playerData[playerNum].avatar) {
                    // If roster is full (e.g., after auto-draft), show player's avatar
                    playerLogoEl.src = playerData[playerNum].avatar;
                    playerLogoEl.alt = `${playerData[playerNum].name}'s avatar`;
                    playerLogoEl.classList.add('is-avatar'); // Add class to invert colors
                    document.getElementById(`player${playerNum}-team-name`).textContent = `${playerData[playerNum].name}'s Roster`;
                } else if (playerData[playerNum].team && playerData[playerNum].team.id) {
                    // If a team is selected (for manual drafting or just rolled a team), display team logo
                    playerLogoEl.src = playerData[playerNum].team.logo;
                    playerLogoEl.alt = `${playerData[playerNum].team.name} logo`;
                    playerLogoEl.classList.remove('is-avatar'); // Remove class if it's a team logo
                    document.getElementById(`player${playerNum}-team-name`).textContent = playerData[playerNum].team.name;
                    
                    // If a team is selected and roster data is available, display draft interface
                    // IMPORTANT: For auto-draft, rosterData will be null, so it shouldn't try to display draft interface based on a single team.
                    // It should always go to fantasy roster if not full and auto-drafted.
                    if (playerData[playerNum].team.rosterData && playerData[playerNum].draftedPlayers.length === 0) {
                         // Only display draft interface if a specific team's roster is loaded and nothing has been drafted from *this* team yet.
                         // This prevents the auto-draft from showing a "single team" draft interface when it's global.
                        displayDraftInterface(playerNum, playerData[playerNum].team.rosterData, playerData[playerNum], isFantasyRosterFull, isPlayerPositionUndraftable, draftPlayer);
                    } else {
                        // This case handles when a team is selected, but roster data is not yet fetched
                        // OR if it's an auto-drafted state where no single team roster is relevant.
                        const inlineRosterEl = getOrCreateChild(playerContentArea, 'inline-roster');
                        inlineRosterEl.innerHTML = ''; // Clear it, it won't be shown for auto-draft state
                    }

                } else if (playerData[playerNum].avatar) {
                    // If no team is selected but player has an avatar, show avatar and "Select your team!"
                    playerLogoEl.src = playerData[playerNum].avatar;
                    playerLogoEl.alt = `${playerData[playerNum].name}'s avatar`;
                    playerLogoEl.classList.add('is-avatar');
                    document.getElementById(`player${playerNum}-team-name`).textContent = 'Select your team!';
                } else { // Fallback if no avatar or team
                    playerLogoEl.src = '';
                    playerLogoEl.alt = '';
                    playerLogoEl.classList.remove('is-avatar');
                    document.getElementById(`player${playerNum}-team-name`).textContent = 'Select your team!';
                }
                
                // Render fantasy roster always if name is confirmed, it will show as empty slots if not filled
                displayFantasyRoster(playerNum, playerData[playerNum], teams, isCurrentPlayerRosterFull, openPlayerStatsModalCaller);
                
                // This function also handles showing/hiding roll/auto-draft buttons and roster views
                updatePlayerContentDisplay(playerNum, playerData[playerNum], isFantasyRosterFull);

                // If roster is full, fetch fantasy points
                const bothRostersFull = gameMode === 'multiplayer' 
                    ? fullGameState?.gameState.status === 'complete'
                    : isFantasyRosterFull(1) && isFantasyRosterFull(2);

                if (bothRostersFull) {
                    fetchAndDisplayPlayerFantasyPoints(playerNum);
                }

            } else {
                // Name not confirmed, show name input and hide team display
                nameInputContainer.style.display = 'flex';
                playerDisplayDiv.style.display = 'none';
                // Reset player title to default "Player X" and clear any old team info/roster display
                renderPlayerAvatar(playerNum, `Player ${playerNum}`, null);
                playerLogoEl.src = '';
                playerLogoEl.alt = '';
                playerLogoEl.classList.remove('is-avatar');
                document.getElementById(`player${playerNum}-team-name`).textContent = '';
                // Clear content areas using getOrCreateChild to ensure elements exist but are empty
                getOrCreateChild(playerContentArea, 'inline-roster').innerHTML = '';
                getOrCreateChild(playerContentArea, 'fantasy-roster').innerHTML = '';
            }

            // Always update avatar preview for the selection area
            updateAvatarPreview(playerNum, playerData[playerNum].avatar);
        });
    }
}

/**
 * Function to handle adding Player 2, typically called by a button.
 */
function addPlayer2() {
    // Reset Player 2's state to ensure a fresh start for drafting
    resetPlayer(2); 
    // Set flag to indicate Player 2 setup has started (resetPlayer sets it to false, so explicitly set true here)
    playerData[2].isSetupStarted = true; 
    localStorage.setItem(`fantasyTeam_2`, JSON.stringify(playerData[2])); // Save this state change
    
    // Update the layout to show Player 2's name input/drafting section
    updateLayout(); 
}

/**
 * NEW: Handle remote state updates from Firebase
 */
function handleRemoteStateUpdate(newState) {
    fullGameState = newState;
    
    // Update local playerData mirror
    if (newState.playerData) {
        // A simple merge might not be enough if players are removed, etc.
        // For this game, a direct replacement is fine.
        playerData[1] = newState.playerData[1];
        playerData[2] = newState.playerData[2];
    }
    
    // Re-populate name inputs from new state
    document.getElementById('player1-name').value = playerData[1].name || '';
    document.getElementById('player2-name').value = playerData[2].name || '';

    updateLayout();
}

/**
 * NEW: Functions to handle multiplayer game creation and joining
 */
async function handleCreateGame() {
    localPlayerNum = 1;
    gameId = await firebase.createGameSession(playerData); // Create with default empty state
    
    const newUrl = `${window.location.pathname}?mode=multiplayer&gameId=${gameId}`;
    history.pushState({ path: newUrl }, '', newUrl);

    const multiInfoBox = document.getElementById('multiplayer-info-box');
    const shareLinkInput = document.getElementById('share-link-input');
    multiInfoBox.style.display = 'block';
    shareLinkInput.value = window.location.href;

    document.getElementById('copy-link-btn').addEventListener('click', () => {
        shareLinkInput.select();
        document.execCommand('copy');
        alert('Link copied!');
    });

    firebase.markPlayerPresence(gameId, 1);
    firebase.onGameStateUpdate(gameId, handleRemoteStateUpdate);
}

async function handleJoinGame() {
    localPlayerNum = 2;
    const existingGameState = await firebase.getGameState(gameId);
    if (!existingGameState) {
        alert("Game not found!");
        window.location.href = 'index.html';
        return;
    }

    const multiInfoBox = document.getElementById('multiplayer-info-box');
    multiInfoBox.style.display = 'block';
    document.getElementById('share-link-container').style.display = 'none';

    firebase.markPlayerPresence(gameId, 2);
    firebase.onGameStateUpdate(gameId, handleRemoteStateUpdate);
}

/**
 * NEW: Function to load local data for non-multiplayer games
 */
function loadLocalDataAndInit() {
    [1, 2].forEach(playerNum => {
        const savedData = localStorage.getItem(`fantasyTeam_${playerNum}`);
        
        // Ensure playerData structure is correctly initialized, filling in missing fields for old saves
        if (savedData) {
            const parsed = JSON.parse(savedData);
            playerData[playerNum] = { 
                name: parsed.name || '', 
                avatar: parsed.avatar || null, 
                team: parsed.team || null, 
                draftedPlayers: parsed.draftedPlayers || [], 
                rosterSlots: parsed.rosterSlots || {
                    QB: null, RB: null, WR1: null, WR2: null, TE: null, Flex: null, DEF: null, K: null
                },
                isSetupStarted: parsed.isSetupStarted || false 
            };

            // Ensure fantasyPoints and statsData field is initialized for loaded players if not present (for old saves)
            for (const slot in playerData[playerNum].rosterSlots) {
                if (playerData[playerNum].rosterSlots[slot] && playerData[playerNum].rosterSlots[slot].fantasyPoints === undefined) {
                    playerData[playerNum].rosterSlots[slot].fantasyPoints = null;
                    playerData[playerNum].rosterSlots[slot].statsData = null;
                }
            }
        } else {
            // If no saved data, ensure base player data is set (it's already set by default export, but explicit is good)
            playerData[playerNum] = { 
                name: '', avatar: null, team: null, draftedPlayers: [], 
                rosterSlots: { QB: null, RB: null, WR1: null, WR2: null, TE: null, Flex: null, DEF: null, K: null },
                isSetupStarted: false
            };
        }
        
        // Populate name input field from loaded data
        document.getElementById(`player${playerNum}-name`).value = playerData[playerNum].name;
    });
    
    updateLayout(); 
}

/**
 * Initializes the application on DOMContentLoaded.
 * Sets up event listeners and loads saved data.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Attach event listeners for player 1
    document.getElementById('player1-name-confirm-btn').addEventListener('click', () => confirmName(1));
    document.getElementById('player1-select-team-btn').addEventListener('click', () => selectTeam(1));
    document.getElementById('player1-auto-draft-btn').addEventListener('click', () => autoDraft(1));
    document.getElementById('player1-reset-btn').addEventListener('click', () => resetPlayer(1));

    // Attach event listeners for player 2
    document.getElementById('player2-name-confirm-btn').addEventListener('click', () => confirmName(2));
    document.getElementById('player2-select-team-btn').addEventListener('click', () => selectTeam(2));
    document.getElementById('player2-auto-draft-btn').addEventListener('click', () => autoDraft(2));
    document.getElementById('player2-reset-btn').addEventListener('click', () => resetPlayer(2));

    // Attach event listener for the new Add Player 2 button
    document.getElementById('add-player2-btn').addEventListener('click', addPlayer2);

    // Attach event listeners for modals (using IDs for direct access)
    document.querySelector('.close-roster').addEventListener('click', hideRosterModal); 
    document.querySelector('.cancel-slot-selection').addEventListener('click', hideSlotSelectionModal);
    document.querySelector('.close-stats').addEventListener('click', hidePlayerStatsModal);
    document.querySelector('.close-avatar-modal').addEventListener('click', hideAvatarSelectionModal); 

    // Handle outside clicks for modals
    window.addEventListener('click', (event) => {
        const rosterModal = document.getElementById('roster-modal');
        const statsModal = document.getElementById('player-stats-modal');
        const slotModal = document.getElementById('slot-selection-modal');
        const avatarModal = document.getElementById('avatar-selection-modal'); 

        if (event.target === rosterModal) {
            hideRosterModal(); 
        }
        if (event.target === statsModal) {
            hidePlayerStatsModal();
        }
        if (event.target === slotModal) { 
            hideSlotSelectionModal();
        }
        if (event.target === avatarModal) { 
            hideAvatarSelectionModal();
        }
    });

    // Add click listener to avatar previews to open the avatar selection modal
    document.getElementById('player1-avatar-preview').addEventListener('click', () => {
        showAvatarSelectionModal(1, playerData[1].avatar, AVATAR_SVGS, selectAvatar);
    });
    document.getElementById('player2-avatar-preview').addEventListener('click', () => {
        showAvatarSelectionModal(2, playerData[2].avatar, AVATAR_SVGS, selectAvatar);
    });

    // NEW: Game initialization logic based on mode
    const urlParams = new URLSearchParams(window.location.search);
    gameMode = urlParams.get('mode') === 'multiplayer' ? 'multiplayer' : 'local';
    gameId = urlParams.get('gameId');

    if (gameMode === 'multiplayer') {
        firebase.initFirebase();
        if (gameId) {
            handleJoinGame();
        } else {
            handleCreateGame();
        }
    } else {
        loadLocalDataAndInit();
    }
});