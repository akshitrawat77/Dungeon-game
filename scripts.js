/**
 * DUNGEON TERMINATOR - Core Web Application Script
 * Handles API interaction, username validation, tab switching, game deployment, and leaderboards.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // API CONFIGURATION
    // ==========================================
    const API_BASE = 'https://koda-4771d1d0.base44.app/functions';
    const ENDPOINTS = {
        checkStatus: `${API_BASE}/checkStatus`,
        submitScore: `${API_BASE}/submitScore`,
        getLeaderboard: `${API_BASE}/getLeaderboard`,
        getPlayerRank: `${API_BASE}/getPlayerRank`
    };

    const LOCAL_STORAGE_KEY = 'dungeon_terminator_username';

    // ==========================================
    // DOM ELEMENTS
    // ==========================================
    // Status Indicator
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = statusIndicator.querySelector('.status-text');

    // Navigation
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    // Username Form & Game
    const usernameSection = document.getElementById('username-section');
    const usernameForm = document.getElementById('username-form');
    const usernameInput = document.getElementById('username-input');
    const usernameError = document.getElementById('username-error');
    const recentPlayerInfo = document.getElementById('recent-player-info');
    const savedUsernameDisplay = document.getElementById('saved-username-display');
    const useSavedBtn = document.getElementById('use-saved-btn');

    // Game Container
    const gameContainer = document.getElementById('game-container');
    const activeOperatorName = document.getElementById('active-operator-name');
    const gameIframe = document.getElementById('game-iframe');
    const iframeLoader = document.getElementById('iframe-loader');
    const reloadGameBtn = document.getElementById('reload-game-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const changeOperatorBtn = document.getElementById('change-operator-btn');

    // Leaderboard
    const leaderboardLoading = document.getElementById('leaderboard-loading');
    const leaderboardError = document.getElementById('leaderboard-error');
    const leaderboardErrorMsg = document.getElementById('leaderboard-error-msg');
    const leaderboardContent = document.getElementById('leaderboard-content');
    const leaderboardTbody = document.getElementById('leaderboard-tbody');
    const refreshLeaderboardBtn = document.getElementById('refresh-leaderboard-btn');
    const retryLeaderboardBtn = document.getElementById('retry-leaderboard-btn');

    // Player Rank Lookup
    const lookupForm = document.getElementById('lookup-form');
    const lookupUsername = document.getElementById('lookup-username');
    const lookupScore = document.getElementById('lookup-score');
    const rankResult = document.getElementById('rank-result');

    // Current Active Operator State
    let currentUsername = '';

    // ==========================================
    // INITIALIZATION
    // ==========================================
    function init() {
        checkOnlineStatus();
        setInterval(checkOnlineStatus, 30000); // Check status every 30s

        loadSavedUsername();
        setupEventListeners();
    }

    // ==========================================
    // ONLINE STATUS CHECK
    // ==========================================
    async function checkOnlineStatus() {
        try {
            const response = await fetch(ENDPOINTS.checkStatus, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            if (data && data.success && data.status === 'online') {
                updateStatusUI(true);
            } else {
                updateStatusUI(false);
            }
        } catch (error) {
            console.warn('[System] Status check failed:', error);
            updateStatusUI(false);
        }
    }

    function updateStatusUI(isOnline) {
        if (!statusIndicator || !statusText) return;
        
        if (isOnline) {
            statusIndicator.className = 'status-indicator online';
            statusText.textContent = 'ONLINE';
        } else {
            statusIndicator.className = 'status-indicator offline';
            statusText.textContent = 'OFFLINE';
        }
    }

    // ==========================================
    // TAB SWITCHING
    // ==========================================
    function setupEventListeners() {
        // Tab buttons
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                switchTab(targetTab);
            });
        });

        // Username form submission
        usernameForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleUsernameSubmission();
        });

        // Auto-load saved username
        if (useSavedBtn) {
            useSavedBtn.addEventListener('click', () => {
                const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
                if (saved) {
                    usernameInput.value = saved;
                    handleUsernameSubmission();
                }
            });
        }

        // Change Operator button
        changeOperatorBtn.addEventListener('click', () => {
            resetToUsernameForm();
        });

        // Reload game button
        reloadGameBtn.addEventListener('click', () => {
            if (currentUsername) {
                loadGameIframe(currentUsername);
            }
        });

        // Fullscreen toggle button
        fullscreenBtn.addEventListener('click', () => {
            toggleFullscreen(gameIframe);
        });

        // Iframe load handler
        gameIframe.addEventListener('load', () => {
            if (iframeLoader) iframeLoader.classList.add('hidden');
        });

        // Leaderboard refresh & retry
        refreshLeaderboardBtn.addEventListener('click', () => fetchLeaderboard());
        retryLeaderboardBtn.addEventListener('click', () => fetchLeaderboard());

        // Player Rank Lookup
        lookupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleRankLookup();
        });

        // Listen for postMessages from iframe (game scores, game completion events)
        window.addEventListener('message', handleIframeMessage);
    }

    function switchTab(tabId) {
        tabBtns.forEach(btn => {
            if (btn.getAttribute('data-tab') === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        tabPanels.forEach(panel => {
            if (panel.id === `${tabId}-panel`) {
                panel.classList.add('active');
                panel.classList.remove('hidden');
            } else {
                panel.classList.remove('active');
                panel.classList.add('hidden');
            }
        });

        // Auto-fetch leaderboard when switching to leaderboard tab
        if (tabId === 'leaderboard') {
            fetchLeaderboard();
        }
    }

    // ==========================================
    // USERNAME VALIDATION & SANITIZATION
    // ==========================================
    function sanitizeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function validateUsername(rawName) {
        const name = rawName.trim();
        
        if (!name || name.length < 3) {
            return { valid: false, error: 'Callsign must be at least 3 characters long.' };
        }
        if (name.length > 20) {
            return { valid: false, error: 'Callsign cannot exceed 20 characters.' };
        }
        const regex = /^[a-zA-Z0-9_-]+$/;
        if (!regex.test(name)) {
            return { valid: false, error: 'Callsign can only contain letters, numbers, _ and -' };
        }

        return { valid: true, cleanName: name };
    }

    function showUsernameError(msg) {
        usernameError.textContent = msg;
        usernameError.classList.remove('hidden');
        usernameInput.classList.add('input-error');
    }

    function hideUsernameError() {
        usernameError.textContent = '';
        usernameError.classList.add('hidden');
        usernameInput.classList.remove('input-error');
    }

    function loadSavedUsername() {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
            usernameInput.value = saved;
            savedUsernameDisplay.textContent = sanitizeHTML(saved);
            recentPlayerInfo.classList.remove('hidden');
        }
    }

    function saveUsername(username) {
        localStorage.setItem(LOCAL_STORAGE_KEY, username);
        savedUsernameDisplay.textContent = sanitizeHTML(username);
        recentPlayerInfo.classList.remove('hidden');
    }

    function handleUsernameSubmission() {
        hideUsernameError();
        const inputVal = usernameInput.value;
        const validation = validateUsername(inputVal);

        if (!validation.valid) {
            showUsernameError(validation.error);
            return;
        }

        const cleanUsername = validation.cleanName;
        currentUsername = cleanUsername;
        saveUsername(cleanUsername);

        // Update UI state
        usernameSection.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        activeOperatorName.textContent = sanitizeHTML(cleanUsername);

        // Load iframe
        loadGameIframe(cleanUsername);
    }

    function resetToUsernameForm() {
        gameContainer.classList.add('hidden');
        usernameSection.classList.remove('hidden');
        gameIframe.src = 'about:blank';
    }

    function loadGameIframe(username) {
        if (iframeLoader) iframeLoader.classList.remove('hidden');
        // Load the Pygbag web game with username as URL param
        const gameUrl = `game/index.html?username=${encodeURIComponent(username)}`;
        gameIframe.src = gameUrl;
    }

    function toggleFullscreen(element) {
        if (!document.fullscreenElement) {
            if (element.requestFullscreen) {
                element.requestFullscreen().catch(err => {
                    console.warn(`Error enabling fullscreen: ${err.message}`);
                });
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    // ==========================================
    // LEADERBOARD FETCH & DISPLAY
    // ==========================================
    async function fetchLeaderboard() {
        showLeaderboardState('loading');

        try {
            const response = await fetch(ENDPOINTS.getLeaderboard, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

            const data = await response.json();
            
            if (data && data.success && Array.isArray(data.leaderboard)) {
                renderLeaderboardTable(data.leaderboard);
                showLeaderboardState('content');
            } else {
                throw new Error(data.error || 'Invalid leaderboard data received.');
            }
        } catch (error) {
            console.error('[Leaderboard] Fetch failed:', error);
            leaderboardErrorMsg.textContent = `CONNECTION ERROR: ${error.message || 'Unable to fetch leaderboard'}`;
            showLeaderboardState('error');
        }
    }

    function showLeaderboardState(state) {
        leaderboardLoading.classList.add('hidden');
        leaderboardError.classList.add('hidden');
        leaderboardContent.classList.add('hidden');

        if (state === 'loading') {
            leaderboardLoading.classList.remove('hidden');
        } else if (state === 'error') {
            leaderboardError.classList.remove('hidden');
        } else if (state === 'content') {
            leaderboardContent.classList.remove('hidden');
        }
    }

    function renderLeaderboardTable(leaderboard) {
        leaderboardTbody.innerHTML = '';

        if (leaderboard.length === 0) {
            const emptyTr = document.createElement('tr');
            emptyTr.innerHTML = `<td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">NO RECORDED DATA IN SYSTEM. BE THE FIRST OPERATOR TO DEPLOY!</td>`;
            leaderboardTbody.appendChild(emptyTr);
            return;
        }

        leaderboard.forEach(entry => {
            const tr = document.createElement('tr');
            
            // Highlight rank colors
            let rankClass = '';
            if (entry.rank === 1) rankClass = 'rank-1';
            else if (entry.rank === 2) rankClass = 'rank-2';
            else if (entry.rank === 3) rankClass = 'rank-3';

            // Highlight current user
            if (currentUsername && entry.username.toLowerCase() === currentUsername.toLowerCase()) {
                tr.classList.add('current-user-row');
            }

            if (rankClass) tr.classList.add(rankClass);

            const formattedScore = formatScore(entry.score);
            const formattedTime = formatTime(entry.time);
            const statusBadge = entry.completed 
                ? `<span class="badge-complete">COMPLETED</span>` 
                : `<span class="badge-failed">TERMINATED</span>`;

            tr.innerHTML = `
                <td class="col-rank">#${entry.rank}</td>
                <td class="col-player">${sanitizeHTML(entry.username)}</td>
                <td class="col-score highlight-cyan">${formattedScore}</td>
                <td class="col-level">LVL ${entry.level ?? 1}</td>
                <td class="col-time">${formattedTime}</td>
                <td class="col-enemies">${entry.enemies ?? 0}</td>
                <td class="col-status">${statusBadge}</td>
            `;

            leaderboardTbody.appendChild(tr);
        });
    }

    // ==========================================
    // SCORE & TIME FORMATTING
    // ==========================================
    function formatScore(score) {
        const num = Number(score);
        if (isNaN(num)) return '0';
        return num.toLocaleString('en-US');
    }

    function formatTime(seconds) {
        if (typeof seconds === 'string' && seconds.includes(':')) {
            return sanitizeHTML(seconds);
        }

        const secNum = parseInt(seconds, 10);
        if (isNaN(secNum) || secNum < 0) return '00:00';

        const minutes = Math.floor(secNum / 60);
        const remSeconds = secNum % 60;

        const padM = String(minutes).padStart(2, '0');
        const padS = String(remSeconds).padStart(2, '0');

        return `${padM}:${padS}`;
    }

    // ==========================================
    // PLAYER RANK LOOKUP
    // ==========================================
    async function handleRankLookup() {
        const username = lookupUsername.value.trim();
        const score = Number(lookupScore.value.trim() || 0);

        if (!username) {
            rankResult.textContent = 'Please enter a username.';
            rankResult.classList.remove('hidden');
            return;
        }

        rankResult.textContent = 'Searching database...';
        rankResult.classList.remove('hidden');

        try {
            const response = await fetch(ENDPOINTS.getPlayerRank, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, score })
            });

            const data = await response.json();

            if (data && data.success) {
                rankResult.innerHTML = `
                    OPERATOR <strong class="highlight-cyan">${sanitizeHTML(username)}</strong> 
                    RANK: <strong style="color: var(--neon-gold)">#${data.rank}</strong> 
                    OUT OF ${data.total_players || 'MANY'} PLAYERS.
                `;
            } else {
                rankResult.textContent = data.error || 'Operator not found in rankings.';
            }
        } catch (err) {
            console.error('[Lookup] Error:', err);
            rankResult.textContent = 'Failed to connect to ranking service.';
        }
    }

    // ==========================================
    // IFRAME POSTMESSAGE LISTENER
    // ==========================================
    function handleIframeMessage(event) {
        // Verify message format if game posts scores or level events
        try {
            const data = event.data;
            if (!data || typeof data !== 'object') return;

            // Optional: submit score automatically if game sends completion payload
            if (data.type === 'SUBMIT_SCORE' && data.payload) {
                autoSubmitScore(data.payload);
            }
        } catch (e) {
            console.warn('[Message] Error handling postMessage:', e);
        }
    }

    async function autoSubmitScore(payload) {
        try {
            const response = await fetch(ENDPOINTS.submitScore, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUsername || payload.username,
                    score: payload.score,
                    level: payload.level,
                    completion_time: payload.completion_time,
                    enemies_defeated: payload.enemies_defeated,
                    completed_game: payload.completed_game
                })
            });

            const result = await response.json();
            if (result.success) {
                console.log('[System] Score recorded successfully:', result);
                fetchLeaderboard(); // refresh leaderboard
            }
        } catch (err) {
            console.error('[System] Error auto-submitting score:', err);
        }
    }

    // Start App
    init();
});
