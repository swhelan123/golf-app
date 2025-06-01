class GolfApp {
  constructor() {
    this.gameState = {
      gameType: "match",
      players: [],
      currentHole: 1,
      scores: {}, // playerIndex: { hole: score }
      points: {}, // playerIndex: totalPoints
      holeResults: [], // { hole, results: [{ player, score, points }] }
      rules: {
        firstPoints: 2,
        secondPoints: 1,
        thirdPoints: 0,
        birdieBonus: 1,
        eagleBonus: 2,
        hioWin: false,
      },
    };

    this.course = COURSE_DATA;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.generatePlayerInputs();
    this.loadSavedGame();
  }

  setupEventListeners() {
    // Game type selection
    document.querySelectorAll(".game-type-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".game-type-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.gameState.gameType = btn.dataset.type;
      });
    });

    // Player count controls
    document
      .getElementById("player-count-minus")
      .addEventListener("click", () => {
        const count = parseInt(
          document.getElementById("player-count").textContent
        );
        if (count > 2) {
          document.getElementById("player-count").textContent = count - 1;
          this.generatePlayerInputs();
        }
      });

    document
      .getElementById("player-count-plus")
      .addEventListener("click", () => {
        const count = parseInt(
          document.getElementById("player-count").textContent
        );
        if (count < 6) {
          document.getElementById("player-count").textContent = count + 1;
          this.generatePlayerInputs();
        }
      });

    // Start game
    document.getElementById("start-game").addEventListener("click", () => {
      this.startGame();
    });

    // Hole navigation
    document.getElementById("prev-hole").addEventListener("click", () => {
      this.navigateHole(-1);
    });

    document.getElementById("next-hole").addEventListener("click", () => {
      this.navigateHole(1);
    });

    // Menu controls
    document.getElementById("menu-btn").addEventListener("click", () => {
      document.getElementById("menu-modal").classList.add("active");
    });

    document.getElementById("close-menu").addEventListener("click", () => {
      document.getElementById("menu-modal").classList.remove("active");
    });

    document.getElementById("end-game").addEventListener("click", () => {
      this.endGame();
    });

    // Summary actions
    document.getElementById("new-game").addEventListener("click", () => {
      this.newGame();
    });

    document.getElementById("share-results").addEventListener("click", () => {
      this.shareResults();
    });
  }

  generatePlayerInputs() {
    const count = parseInt(document.getElementById("player-count").textContent);
    const container = document.getElementById("player-inputs");
    container.innerHTML = "";

    for (let i = 0; i < count; i++) {
      const playerDiv = document.createElement("div");
      playerDiv.className = "player-input";
      playerDiv.innerHTML = `
                <input type="text" placeholder="Player ${
                  i + 1
                }" id="player-name-${i}">
                <label>Start:</label>
                <input type="number" value="0" id="player-start-${i}">
            `;
      container.appendChild(playerDiv);
    }
  }

  startGame() {
    // Collect player data
    const playerCount = parseInt(
      document.getElementById("player-count").textContent
    );
    this.gameState.players = [];

    for (let i = 0; i < playerCount; i++) {
      const name =
        document.getElementById(`player-name-${i}`).value.trim() ||
        `Player ${i + 1}`;
      const startPoints =
        parseInt(document.getElementById(`player-start-${i}`).value) || 0;

      this.gameState.players.push({ name, startPoints });
      this.gameState.scores[i] = {};
      this.gameState.points[i] = startPoints;
    }

    // Collect scoring rules
    this.gameState.rules = {
      firstPoints: parseInt(document.getElementById("first-points").value),
      secondPoints: parseInt(document.getElementById("second-points").value),
      thirdPoints: parseInt(document.getElementById("third-points").value),
      birdieBonus: parseInt(document.getElementById("birdie-bonus").value),
      eagleBonus: parseInt(document.getElementById("eagle-bonus").value),
      hioWin: document.getElementById("hio-win").checked,
    };

    this.switchScreen("game-screen");
    this.updateGameDisplay();
    this.generateScoreInputs();
    this.saveGame();
  }

  updateGameDisplay() {
    const hole = this.course.holes[this.gameState.currentHole - 1];
    document.getElementById("current-hole").textContent =
      this.gameState.currentHole;
    document.getElementById("hole-par").textContent = hole.par;
    document.getElementById("hole-yards").textContent = hole.yards;

    this.updateLeaderboard();
    this.updateHoleControls();
  }

  updateLeaderboard() {
    const container = document.getElementById("players-scores");
    container.innerHTML = "";

    // Sort players by total points
    const sortedPlayers = this.gameState.players
      .map((player, index) => ({
        ...player,
        index,
        points: this.gameState.points[index],
      }))
      .sort((a, b) => b.points - a.points);

    sortedPlayers.forEach((player, position) => {
      const playerDiv = document.createElement("div");
      playerDiv.className = "player-score";

      if (position === 0) playerDiv.classList.add("leader");

      // Check for hot streak (3+ consecutive holes won)
      if (this.checkHotStreak(player.index)) {
        playerDiv.classList.add("hot-streak");
      }

      const currentHoleScore =
        this.gameState.scores[player.index][this.gameState.currentHole];
      const par = this.course.holes[this.gameState.currentHole - 1].par;
      let statusText = "";

      if (currentHoleScore !== undefined) {
        const scoreToPar = currentHoleScore - par;
        if (scoreToPar < 0) statusText = `${Math.abs(scoreToPar)} under`;
        else if (scoreToPar > 0) statusText = `${scoreToPar} over`;
        else statusText = "Even par";
      }

      playerDiv.innerHTML = `
                <div class="player-info">
                    <div class="player-name">${player.name}</div>
                    <div class="player-status">${statusText}</div>
                </div>
                <div class="player-points">${player.points}</div>
            `;

      container.appendChild(playerDiv);
    });
  }

  generateScoreInputs() {
    const container = document.getElementById("score-inputs");
    container.innerHTML = "";

    this.gameState.players.forEach((player, index) => {
      const currentScore =
        this.gameState.scores[index][this.gameState.currentHole] ||
        this.course.holes[this.gameState.currentHole - 1].par;
      const par = this.course.holes[this.gameState.currentHole - 1].par;
      const scoreToPar = currentScore - par;

      const scoreDiv = document.createElement("div");
      scoreDiv.className = "score-input";
      scoreDiv.innerHTML = `
                <div class="player-info">
                    <div class="player-name">${player.name}</div>
                </div>
                <div class="score-controls">
                    <button class="score-btn minus" onclick="app.adjustScore(${index}, -1)">−</button>
                    <div class="score-display">
                        <div>${currentScore}</div>
                        <div class="par-indicator">${
                          scoreToPar >= 0 ? "+" : ""
                        }${scoreToPar}</div>
                    </div>
                    <button class="score-btn plus" onclick="app.adjustScore(${index}, 1)">+</button>
                </div>
            `;

      container.appendChild(scoreDiv);
    });
  }

  adjustScore(playerIndex, adjustment) {
    const currentScore =
      this.gameState.scores[playerIndex][this.gameState.currentHole] ||
      this.course.holes[this.gameState.currentHole - 1].par;
    const newScore = Math.max(1, currentScore + adjustment);

    this.gameState.scores[playerIndex][this.gameState.currentHole] = newScore;
    this.calculateHolePoints();
    this.generateScoreInputs();
    this.updateLeaderboard();
    this.saveGame();
  }

  calculateHolePoints() {
    if (!this.allScoresEntered()) return;

    const holeScores = this.gameState.players.map((player, index) => ({
      playerIndex: index,
      score: this.gameState.scores[index][this.gameState.currentHole],
      player: player.name,
    }));

    // Sort by score (ascending)
    holeScores.sort((a, b) => a.score - b.score);

    // Reset points for this hole calculation
    const holePoints = {};
    this.gameState.players.forEach((_, index) => {
      holePoints[index] = 0;
    });

    // Assign position points
    const rules = this.gameState.rules;
    const positions = [
      rules.firstPoints,
      rules.secondPoints,
      rules.thirdPoints,
    ];

    for (let i = 0; i < holeScores.length; i++) {
      const currentScore = holeScores[i].score;
      const tiedPlayers = holeScores.filter((p) => p.score === currentScore);

      if (tiedPlayers.length === 1) {
        // No tie
        holePoints[holeScores[i].playerIndex] =
          positions[Math.min(i, positions.length - 1)] || 0;
      } else {
        // Handle ties
        const startPosition = i;
        const endPosition = Math.min(
          i + tiedPlayers.length - 1,
          positions.length - 1
        );
        const totalPoints = positions
          .slice(startPosition, endPosition + 1)
          .reduce((sum, p) => sum + (p || 0), 0);
        const avgPoints = totalPoints / tiedPlayers.length;

        tiedPlayers.forEach((tp) => {
          holePoints[tp.playerIndex] = avgPoints;
        });

        i += tiedPlayers.length - 1; // Skip the tied players
      }
    }

    // Add bonus points
    const par = this.course.holes[this.gameState.currentHole - 1].par;
    holeScores.forEach(({ playerIndex, score }) => {
      const scoreToPar = score - par;

      if (score === 1) {
        // Hole in one
        if (rules.hioWin) {
          // Instant win logic could be implemented here
          holePoints[playerIndex] += 10; // Arbitrary large bonus
        }
      } else if (scoreToPar === -2) {
        // Eagle
        holePoints[playerIndex] += rules.eagleBonus;
      } else if (scoreToPar === -1) {
        // Birdie
        holePoints[playerIndex] += rules.birdieBonus;
      }
    });

    // Update total points
    Object.keys(holePoints).forEach((playerIndex) => {
      this.gameState.points[playerIndex] += holePoints[playerIndex];
    });

    // Store hole results
    this.gameState.holeResults[this.gameState.currentHole - 1] = {
      hole: this.gameState.currentHole,
      results: holeScores.map(({ playerIndex, score, player }) => ({
        player,
        score,
        points: holePoints[playerIndex],
      })),
    };

    this.displayHoleResults();
  }

  allScoresEntered() {
    return this.gameState.players.every(
      (_, index) =>
        this.gameState.scores[index][this.gameState.currentHole] !== undefined
    );
  }

  displayHoleResults() {
    const container = document.getElementById("hole-results");
    const holeResult =
      this.gameState.holeResults[this.gameState.currentHole - 1];

    if (!holeResult) return;

    container.innerHTML = `
            <div class="hole-result">
                <h4>Hole ${holeResult.hole} Results</h4>
                <div class="result-breakdown">
                    ${holeResult.results
                      .map(
                        (result) => `
                        <div class="result-item">
                            <span>${result.player}: ${result.score}</span>
                            <span>+${result.points} pts</span>
                        </div>
                    `
                      )
                      .join("")}
                </div>
            </div>
        `;
  }

  navigateHole(direction) {
    const newHole = this.gameState.currentHole + direction;

    if (newHole < 1 || newHole > 18) return;

    this.gameState.currentHole = newHole;
    this.updateGameDisplay();
    this.generateScoreInputs();

    if (newHole === 18 && this.allScoresEntered()) {
      // Check if all holes are complete
      const allHolesComplete = Array.from(
        { length: 18 },
        (_, i) => i + 1
      ).every((hole) =>
        this.gameState.players.every(
          (_, playerIndex) =>
            this.gameState.scores[playerIndex][hole] !== undefined
        )
      );

      if (allHolesComplete) {
        this.endGame();
      }
    }

    this.saveGame();
  }

  updateHoleControls() {
    document.getElementById("prev-hole").disabled =
      this.gameState.currentHole === 1;

    const nextBtn = document.getElementById("next-hole");
    if (this.gameState.currentHole === 18) {
      nextBtn.textContent = "Finish Round";
    } else {
      nextBtn.textContent = "Next →";
    }
  }

  checkHotStreak(playerIndex) {
    if (this.gameState.holeResults.length < 3) return false;

    const lastThreeHoles = this.gameState.holeResults.slice(-3);
    return lastThreeHoles.every((holeResult) => {
      const playerResult = holeResult.results.find(
        (r) => r.player === this.gameState.players[playerIndex].name
      );
      const bestScore = Math.min(...holeResult.results.map((r) => r.score));
      return playerResult && playerResult.score === bestScore;
    });
  }

  endGame() {
    this.calculateFinalResults();
    this.switchScreen("summary-screen");
    this.saveGame();
  }

  calculateFinalResults() {
    const finalResults = this.gameState.players
      .map((player, index) => ({
        ...player,
        totalPoints: this.gameState.points[index],
        holesWon: this.getHolesWon(index),
        bestStreak: this.getBestStreak(index),
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    this.displayFinalResults(finalResults);
    this.displayGameHighlights(finalResults);
  }

  displayFinalResults(results) {
    const container = document.getElementById("final-leaderboard");
    container.innerHTML = results
      .map(
        (player, position) => `
            <div class="player-score ${position === 0 ? "leader" : ""}">
                <div class="player-info">
                    <div class="player-name">${position + 1}. ${
          player.name
        }</div>
                    <div class="player-status">${
                      player.holesWon
                    } holes won</div>
                </div>
                <div class="player-points">${player.totalPoints} pts</div>
            </div>
        `
      )
      .join("");
  }

  displayGameHighlights(results) {
    const container = document.getElementById("game-highlights");
    const winner = results[0];
    const mostHoles = results.reduce((max, p) =>
      p.holesWon > max.holesWon ? p : max
    );
    const bestStreak = results.reduce((max, p) =>
      p.bestStreak > max.bestStreak ? p : max
    );

    container.innerHTML = `
            <div class="hole-result">
                <h4>🏆 Game Highlights</h4>
                <div class="result-breakdown">
                    <div class="result-item">
                        <span>Winner:</span>
                        <span>${winner.name}</span>
                    </div>
                    <div class="result-item">
                        <span>Most Holes Won:</span>
                        <span>${mostHoles.name} (${mostHoles.holesWon})</span>
                    </div>
                    <div class="result-item">
                        <span>Best Streak:</span>
                        <span>${bestStreak.name} (${bestStreak.bestStreak})</span>
                    </div>
                </div>
            </div>
        `;
  }

  getHolesWon(playerIndex) {
    return this.gameState.holeResults.filter((holeResult) => {
      const playerResult = holeResult.results.find(
        (r) => r.player === this.gameState.players[playerIndex].name
      );
      const bestScore = Math.min(...holeResult.results.map((r) => r.score));
      return playerResult && playerResult.score === bestScore;
    }).length;
  }

  getBestStreak(playerIndex) {
    let maxStreak = 0;
    let currentStreak = 0;

    this.gameState.holeResults.forEach((holeResult) => {
      const playerResult = holeResult.results.find(
        (r) => r.player === this.gameState.players[playerIndex].name
      );
      const bestScore = Math.min(...holeResult.results.map((r) => r.score));

      if (playerResult && playerResult.score === bestScore) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    });

    return maxStreak;
  }

  shareResults() {
    // Create a simple text summary for sharing
    const results = this.gameState.players
      .map((player, index) => ({
        name: player.name,
        points: this.gameState.points[index],
      }))
      .sort((a, b) => b.points - a.points);

    const summary =
      `🏌️ Golf Match Results\n\n` +
      results
        .map((player, i) => `${i + 1}. ${player.name}: ${player.points} pts`)
        .join("\n") +
      `\n\nGame Type: ${this.gameState.gameType.toUpperCase()}` +
      `\nCourse: ${this.course.name}`;

    if (navigator.share) {
      navigator.share({
        title: "Golf Match Results",
        text: summary,
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(summary).then(() => {
        alert("Results copied to clipboard!");
      });
    }
  }

  newGame() {
    if (confirm("Start a new game? Current progress will be lost.")) {
      this.gameState = {
        gameType: "match",
        players: [],
        currentHole: 1,
        scores: {},
        points: {},
        holeResults: [],
        rules: {
          firstPoints: 2,
          secondPoints: 1,
          thirdPoints: 0,
          birdieBonus: 1,
          eagleBonus: 2,
          hioWin: false,
        },
      };
      localStorage.removeItem("golfAppSave");
      this.switchScreen("setup-screen");
    }
  }

  switchScreen(screenId) {
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active");
    });
    document.getElementById(screenId).classList.add("active");
  }

  saveGame() {
    localStorage.setItem("golfAppSave", JSON.stringify(this.gameState));
  }

  loadSavedGame() {
    const saved = localStorage.getItem("golfAppSave");
    if (saved) {
      try {
        const savedState = JSON.parse(saved);
        if (savedState.players && savedState.players.length > 0) {
          if (confirm("Continue your saved game?")) {
            this.gameState = savedState;
            this.switchScreen("game-screen");
            this.updateGameDisplay();
            this.generateScoreInputs();
          }
        }
      } catch (e) {
        console.error("Error loading saved game:", e);
      }
    }
  }
}

// PWA Service Worker Registration
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => console.log("SW registered"))
      .catch((error) => console.log("SW registration failed"));
  });
}

// Initialize the app
const app = new GolfApp();
