/**
 * game.js
 * Contains the core game logic, state management, and orchestration of UI and API interactions.
 */

// Import from new modular files
import { getInitialPlayerData, gameState, playerData, isFantasyRosterFull, isPlayerPositionUndraftable, switchTurn, setGamePhase, setGameState, setPlayerData } from './playerState.js';
import { getOrCreateChild, updatePlayerContentDisplay, displayDraftInterface, displayFantasyRoster, renderPlayerAvatar } from './uiRenderer.js';
import { showSlotSelectionModal, hideSlotSelectionModal, hideRosterModal, showPlayerStatsModal, hidePlayerStatsModal, renderPlayerStatsInModal, showAvatarSelectionModal, hideAvatarSelectionModal } from './uiModals.js';
import { confirmName, selectAvatar, updateAvatarPreview, AVATAR_SVGS, resetPlayer } from './playerActions.js';
import { selectTeam, autoDraft, draftPlayer } from './gameFlow.js';
import { initializeFirebase } from './firebase.js';

// Import API functions
import { getTank01PlayerID, fetchLastGameStats } from './api.js';

// Import static data
import { teams } from './data.js'; 

// --- Multiplayer State ---
let gameId = null;
let playerNumber = null;
let gameRef = null;
let isMultiplayer = false;
// ---

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
    let changed = false;

    for (const slotId of rosterSlotsOrder) {
        const playerInSlot = playerRoster[slotId];
        if (playerInSlot && playerInSlot.fantasyPoints === null) {
            changed = true;
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
                playerData[playerNum].rosterSlots[slotId].fantasyPoints = result ? result.fantasyPoints : 'N/A';
                playerData[playerNum].rosterSlots[slotId].statsData = result ? result.stats : null;
            } else {
                playerData[playerNum].rosterSlots[slotId].fantasyPoints = 'N/A';
                playerData[playerNum].rosterSlots[slotId].statsData = null;
            }
        }
    }
    if (changed) {
        if (isMultiplayer) {
            gameRef.child('playerData').set(playerData);
        } else {
            localStorage.setItem(`fantasyTeam_${playerNum}`, JSON.stringify(playerData[playerNum]));
            updateLayout(); // Re-render fantasy roster for local play
        }
    } else if (!isMultiplayer) {
         displayFantasyRoster(playerNum, playerData[playerNum], teams, isFantasyRosterFull(playerNum), openPlayerStatsModalCaller); 
    }
}

/**
 * Updates the main layout of the application (single player view vs. two-player view)
 * and the internal display of each player section (name input vs. team display, draft vs. fantasy roster).
 */
export function updateLayout() {
    // Check game phase transition
    if (gameState.phase === 'NAME_ENTRY' && playerData[1].name && playerData[2].name) {
        const newGameState = { ...gameState, phase: 'DRAFTING' };
         if (isMultiplayer) {
            gameRef.child('gameState').set(newGameState);
        } else {
            setGameState(newGameState);
        }
    }
    
    if (isFantasyRosterFull(1) && isFantasyRosterFull(2)) {
         const newGameState = { ...gameState, phase: 'COMPLETE' };
         if (isMultiplayer) {
            gameRef.child('gameState').set(newGameState);
        } else {
            setGameState(newGameState);
        }
    }

    const playersContainer = document.querySelector('.players-container');
    playersContainer.classList.add('two-player-view'); // Always two player view now
    playersContainer.classList.remove('single-player-view');

    // Hide the "Add Player 2" button as it's obsolete
    const addPlayer2Button = document.getElementById('add-player2-btn');
    if (addPlayer2Button) addPlayer2Button.style.display = 'none';

    // Update internal display for each player section based on their individual state
    [1, 2].forEach(playerNum => {
        const playerSection = document.getElementById(`player${playerNum}-section`);
        const nameInputContainer = document.querySelector(`#player${playerNum}-section .name-input-container`);
        const playerDisplayDiv = document.getElementById(`player${playerNum}-display`);
        const playerLogoEl = document.getElementById(`player${playerNum}-logo`);
        const playerContentArea = document.getElementById(`player${playerNum}-content-area`);
        const isCurrentPlayerRosterFull = isFantasyRosterFull(playerNum);
        const readyMessageEl = document.getElementById(`player${playerNum}-ready-message`);
        const confirmBtn = document.getElementById(`player${playerNum}-name-confirm-btn`);

        // Handle button disabling for multiplayer
        if(isMultiplayer) {
            const isMyTurn = playerNum === playerNumber;
            const isMyNameConfirmed = !!playerData[playerNum].name;
            confirmBtn.disabled = isMyNameConfirmed || !isMyTurn;
        }

        // Handle visibility of name input vs team display based on game phase
        if (gameState.phase === 'NAME_ENTRY') {
            playerSection.classList.remove('active-turn', 'inactive-turn');
            playerDisplayDiv.style.display = 'none';

            if (playerData[playerNum].name) { // Player has confirmed their name
                nameInputContainer.style.display = 'none';
                readyMessageEl.textContent = `${playerData[playerNum].name} is ready`;
                readyMessageEl.style.display = 'block';
                renderPlayerAvatar(playerNum, playerData[playerNum].name, playerData[playerNum].avatar);
            } else { // Player has not confirmed name
                nameInputContainer.style.display = 'flex';
                readyMessageEl.style.display = 'none';
                renderPlayerAvatar(playerNum, `Player ${playerNum}`, null);
            }
        } else { // DRAFTING or COMPLETE phase
            nameInputContainer.style.display = 'none';
            readyMessageEl.style.display = 'none';
            playerDisplayDiv.style.display = 'block';

            // Update player title with name and avatar
            renderPlayerAvatar(playerNum, playerData[playerNum].name, playerData[playerNum].avatar);

            // Set active/inactive turn status
            if (gameState.phase === 'DRAFTING') {
                if (playerNum === gameState.currentPlayer) {
                    playerSection.classList.add('active-turn');
                    playerSection.classList.remove('inactive-turn');
                } else {
                    playerSection.classList.add('inactive-turn');
                    playerSection.classList.remove('active-turn');
                }

                // For multiplayer, disable controls for the player whose turn it is not
                if (isMultiplayer && playerNumber && playerNum !== playerNumber) {
                     playerSection.style.pointerEvents = 'none';
                } else {
                     playerSection.style.pointerEvents = 'auto';
                }
                
                // Also disable controls for the player whose turn it is, if it's not THIS client's player.
                if (isMultiplayer && playerNumber && gameState.currentPlayer !== playerNumber) {
                     document.getElementById(`player${gameState.currentPlayer}-section`).style.pointerEvents = 'none';
                }

            } else { // COMPLETE phase
                 playerSection.classList.remove('active-turn', 'inactive-turn');
                 playerSection.style.pointerEvents = 'auto'; // Re-enable for stats clicking
            }

            // Update team logo / avatar and team name
            if (isCurrentPlayerRosterFull && playerData[playerNum].avatar) {
                playerLogoEl.src = playerData[playerNum].avatar;
                playerLogoEl.alt = `${playerData[playerNum].name}'s avatar`;
                playerLogoEl.classList.add('is-avatar'); 
                document.getElementById(`player${playerNum}-team-name`).textContent = `${playerData[playerNum].name}'s Roster`;
            } else if (playerData[playerNum].team && playerData[playerNum].team.id) {
                playerLogoEl.src = playerData[playerNum].team.logo;
                playerLogoEl.alt = `${playerData[playerNum].team.name} logo`;
                playerLogoEl.classList.remove('is-avatar');
                document.getElementById(`player${playerNum}-team-name`).textContent = playerData[playerNum].team.name;
                
                if (playerData[playerNum].team.rosterData && playerData[playerNum].draftedPlayers.length === 0) {
                    const otherPlayerNum = playerNum === 1 ? 2 : 1;
                    const opponentData = playerData[otherPlayerNum];
                    displayDraftInterface(playerNum, playerData[playerNum].team.rosterData, playerData[playerNum], opponentData, isFantasyRosterFull, isPlayerPositionUndraftable, draftPlayer);
                } else {
                    const inlineRosterEl = getOrCreateChild(playerContentArea, 'inline-roster');
                    inlineRosterEl.innerHTML = ''; 
                }

            } else if (playerData[playerNum].avatar) {
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
            if (isCurrentPlayerRosterFull) {
                fetchAndDisplayPlayerFantasyPoints(playerNum);
            }
        }

        // Always update avatar preview for the selection area
        updateAvatarPreview(playerNum, playerData[playerNum].avatar);
    });
}

/**
 * Function to handle adding Player 2, typically called by a button.
 */
function addPlayer2() {
    // This function is now obsolete with the new flow but kept to prevent errors if called.
    console.log("addPlayer2 is obsolete and should not be called.");
}

/**
 * Initializes the application on DOMContentLoaded.
 * Sets up event listeners and loads saved data.
 */
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    gameId = urlParams.get('gameId');
    isMultiplayer = !!gameId;

    if (isMultiplayer) {
        document.body.classList.add('multiplayer-mode');
        const { database } = initializeFirebase();
        gameRef = database.ref(`games/${gameId}`);
        await setupMultiplayerGame();
    } else {
        document.body.classList.add('local-mode');
        setupLocalGame();
    }
    
    // Attach event listeners for player 1
    document.getElementById('player1-name-confirm-btn').addEventListener('click', () => confirmName(1, isMultiplayer, gameRef));
    document.getElementById('player1-select-team-btn').addEventListener('click', () => selectTeam(1, isMultiplayer, gameRef));
    document.getElementById('player1-auto-draft-btn').addEventListener('click', () => autoDraft(1, isMultiplayer, gameRef));
    document.getElementById('player1-reset-btn').addEventListener('click', () => resetPlayer(1, isMultiplayer, gameRef));

    // Attach event listeners for player 2
    document.getElementById('player2-name-confirm-btn').addEventListener('click', () => confirmName(2, isMultiplayer, gameRef));
    document.getElementById('player2-select-team-btn').addEventListener('click', () => selectTeam(2, isMultiplayer, gameRef));
    document.getElementById('player2-auto-draft-btn').addEventListener('click', () => autoDraft(2, isMultiplayer, gameRef));
    document.getElementById('player2-reset-btn').addEventListener('click', () => resetPlayer(2, isMultiplayer, gameRef));
    
    // Attach event listener for the "Add Player 2" button (obsolete but kept to prevent errors)
    const addPlayer2Btn = document.getElementById('add-player2-btn');
    if (addPlayer2Btn) addPlayer2Btn.addEventListener('click', () => {});

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

        if (event.target === rosterModal) hideRosterModal();
        if (event.target === statsModal) hidePlayerStatsModal();
        if (event.target === slotModal) hideSlotSelectionModal();
        if (event.target === avatarModal) hideAvatarSelectionModal();
    });

    // Add click listener to avatar previews to open the avatar selection modal
    document.getElementById('player1-avatar-preview').addEventListener('click', () => {
        showAvatarSelectionModal(1, playerData[1].avatar, AVATAR_SVGS, (pNum, avatar) => selectAvatar(pNum, avatar, isMultiplayer, gameRef));
    });
    document.getElementById('player2-avatar-preview').addEventListener('click', () => {
        showAvatarSelectionModal(2, playerData[2].avatar, AVATAR_SVGS, (pNum, avatar) => selectAvatar(pNum, avatar, isMultiplayer, gameRef));
    });
});

function setupLocalGame() {
    // Load saved data for both players and initialize playerData structure
    [1, 2].forEach(playerNum => {
        const savedData = localStorage.getItem(`fantasyTeam_${playerNum}`);
        
        // Ensure playerData structure is correctly initialized, filling in missing fields for old saves
        if (savedData) {
            const parsed = JSON.parse(savedData);
            playerData[playerNum] = { ...getInitialPlayerData(), ...parsed };

            // Ensure fantasyPoints and statsData field is initialized for loaded players if not present (for old saves)
            for (const slot in playerData[playerNum].rosterSlots) {
                if (playerData[playerNum].rosterSlots[slot] && playerData[playerNum].rosterSlots[slot].fantasyPoints === undefined) {
                    playerData[playerNum].rosterSlots[slot].fantasyPoints = null;
                    playerData[playerNum].rosterSlots[slot].statsData = null;
                }
            }
        } else {
            // If no saved data, ensure base player data is set
            playerData[playerNum] = getInitialPlayerData();
        }
        
        // Populate name input field from loaded data
        document.getElementById(`player${playerNum}-name`).value = playerData[playerNum].name;
    });
    
    // On initial load, reset all game state to ensure a clean start for the new flow.
    resetPlayer(1, false, null);
    resetPlayer(2, false, null);
    
    // Call updateLayout AFTER all saved data is loaded to set initial UI state correctly
    updateLayout(); 
}

async function setupMultiplayerGame() {
    const multiplayerInfoBox = document.getElementById('multiplayer-info-box');
    multiplayerInfoBox.style.display = 'block';

    gameRef.on('value', (snapshot) => {
        const gameData = snapshot.val();
        if (gameData) {
            // Sync local state with Firebase state
            setGameState(gameData.gameState || { currentPlayer: 1, phase: 'NAME_ENTRY' });
            setPlayerData(gameData.playerData || { 1: getInitialPlayerData(), 2: getInitialPlayerData() });
            
            // Update UI
            updateLayout();
            updateMultiplayerInfoBox();
        }
    });

    const snapshot = await gameRef.once('value');
    let gameData = snapshot.val();
    
    if (!gameData) {
        // This is the first player (creator). Initialize the game state.
        playerNumber = 1;
        const initialGame = {
            gameState: { currentPlayer: 1, phase: 'NAME_ENTRY' },
            playerData: {
                1: getInitialPlayerData(),
                2: getInitialPlayerData()
            },
            player1_id: playerNumber // Store who is P1
        };
        await gameRef.set(initialGame);
    } else if (!gameData.player2_id) {
        // This is the second player joining.
        playerNumber = 2;
        await gameRef.child('player2_id').set(playerNumber);
    } else {
        // Game is full. Observe only.
        playerNumber = null; 
        alert("This game room is full. You are now in observer mode.");
    }
}

function updateMultiplayerInfoBox() {
    const statusText = document.getElementById('multiplayer-status-text');
    const shareContainer = document.getElementById('share-link-container');
    const shareInput = document.getElementById('share-link-input');
    const copyBtn = document.getElementById('copy-link-btn');

    if (playerData[1].name && playerData[2].name) {
        statusText.textContent = 'Game in progress!';
        statusText.classList.add('ready');
        shareContainer.style.display = 'none';
    } else if (playerNumber === 1 && !playerData[2].name) {
        statusText.textContent = 'Waiting for opponent to join and confirm their name...';
        statusText.classList.remove('ready');
        shareContainer.style.display = 'block';
        shareInput.value = window.location.href;
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(shareInput.value).then(() => {
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 2000);
            });
        };
    } else if (playerNumber === 2 && !playerData[1].name) {
        statusText.textContent = 'Waiting for Player 1 to confirm their name...';
        statusText.classList.remove('ready');
        shareContainer.style.display = 'none';
    } else {
        statusText.textContent = 'Both players, please enter your names to begin!';
        statusText.classList.remove('ready');
        if (playerNumber === 1) {
            shareContainer.style.display = 'block';
             shareInput.value = window.location.href;
        } else {
            shareContainer.style.display = 'none';
        }
    }
}