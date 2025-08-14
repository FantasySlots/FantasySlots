document.addEventListener('DOMContentLoaded', () => {
    const playSlotsBtn = document.getElementById('play-slots-btn');
    const playModeModal = document.getElementById('play-mode-modal');
    const closeModalBtn = document.querySelector('.close-play-mode-modal');
    const playWithFriendsBtn = document.getElementById('play-with-friends-btn');

    if (playSlotsBtn && playModeModal) {
        playSlotsBtn.addEventListener('click', () => {
            playModeModal.style.display = 'flex';
        });
    }

    if (closeModalBtn && playModeModal) {
        closeModalBtn.addEventListener('click', () => {
            playModeModal.style.display = 'none';
        });
    }

    if (playWithFriendsBtn) {
        playWithFriendsBtn.addEventListener('click', () => {
            alert('"Play with Friends" is coming soon!');
        });
    }

    window.addEventListener('click', (event) => {
        if (event.target === playModeModal) {
            playModeModal.style.display = 'none';
        }
    });
});

