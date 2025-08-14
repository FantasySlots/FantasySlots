document.addEventListener('DOMContentLoaded', () => {
    const playSlotsBtn = document.getElementById('play-slots-btn');
    const gameModeSelection = document.getElementById('game-mode-selection');
    const backToMainBtn = document.getElementById('back-to-main-btn');
    const initialOptions = document.getElementById('initial-landing-options');

    if (playSlotsBtn) {
        playSlotsBtn.addEventListener('click', () => {
            initialOptions.style.display = 'none';
            gameModeSelection.style.display = 'flex';
        });
    }

    if (backToMainBtn) {
        backToMainBtn.addEventListener('click', () => {
            gameModeSelection.style.display = 'none';
            initialOptions.style.display = 'flex';
        });
    }
});

