import { initializeFirebase } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    const playSlotsBtn = document.getElementById('play-slots-btn');
    const gameModeSelection = document.getElementById('game-mode-selection');
    const initialOptions = document.getElementById('initial-landing-options');
    const backToMainBtn = document.getElementById('back-to-main-btn');
    const playFriendsBtn = document.getElementById('play-friends-btn');
    
    // Multiplayer info box elements
    const multiplayerInfoBox = document.getElementById('multiplayer-info-box');
    const shareLinkInput = document.getElementById('share-link-input');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const goToGameBtn = document.getElementById('go-to-game-btn');
    const gameStatusText = document.getElementById('game-status-text');

    if (playSlotsBtn && gameModeSelection && initialOptions) {
        playSlotsBtn.addEventListener('click', () => {
            initialOptions.style.display = 'none';
            gameModeSelection.style.display = 'flex';
        });
    }

    if (backToMainBtn && gameModeSelection && initialOptions) {
        backToMainBtn.addEventListener('click', () => {
            gameModeSelection.style.display = 'none';
            initialOptions.style.display = 'flex';
            multiplayerInfoBox.style.display = 'none'; // Hide multiplayer box on back
        });
    }

    if (playFriendsBtn) {
        playFriendsBtn.addEventListener('click', async () => {
            try {
                // Disable button to prevent multiple clicks
                playFriendsBtn.disabled = true;
                playFriendsBtn.textContent = 'Creating Game...';

                // Initialize Firebase and get a reference to the database
                const { database } = initializeFirebase();
                
                // Create a new game room in Firebase by pushing to the 'games' collection
                const gamesRef = firebase.database().ref('games');
                const newGameRef = gamesRef.push();
                
                const gameId = newGameRef.key;

                // Construct the full URL
                const gameUrl = `${window.location.origin}${window.location.pathname.replace('index.html', '')}game.html?gameId=${gameId}`;

                // Instead of redirecting, show the info box
                gameModeSelection.style.display = 'none';
                multiplayerInfoBox.style.display = 'block';

                shareLinkInput.value = gameUrl;

                copyLinkBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(gameUrl).then(() => {
                        copyLinkBtn.textContent = 'Copied!';
                        setTimeout(() => { copyLinkBtn.textContent = 'Copy Link'; }, 2000);
                    });
                });

                goToGameBtn.style.display = 'flex';
                goToGameBtn.addEventListener('click', () => {
                    window.location.href = gameUrl;
                });

            } catch (error) {
                console.error("Failed to create multiplayer game:", error);
                gameStatusText.textContent = "Could not create a multiplayer game. Please try again.";
                gameStatusText.style.color = "#ef4444"; // Red color for error
                // Re-enable button on failure
                playFriendsBtn.disabled = false;
                playFriendsBtn.innerHTML = '<span>Play with Friends</span><div class="btn-shimmer"></div>';

            }
        });
    }
});