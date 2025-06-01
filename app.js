const APP_VERSION = "1.3.0";

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
    this.updateVersionDisplay();
    this.loadSavedGame();
  }

  updateVersionDisplay() {
    // Add version to setup screen
    const header = document.querySelector("#setup-screen .header h1");
    if (header && !header.querySelector(".version")) {
      const versionSpan = document.createElement("span");
      versionSpan.className = "version";
      versionSpan.textContent = ` v${APP_VERSION}`;
      header.appendChild(versionSpan);
    }
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

    // Refresh button
    document.getElementById("refresh-app").addEventListener("click", () => {
      this.refreshApp();
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

    document.getElementById("view-scorecard").addEventListener("click", () => {
      document.getElementById("menu-modal").classList.remove("active");
      this.showScorecard();
    });

    document.getElementById("end-game").addEventListener("click", () => {
      document.getElementById("menu-modal").classList.remove("active");
      this.endGame();
    });

    // Summary actions
    document.getElementById("new-game").addEventListener("click", () => {
      this.newGame();
    });

    document.getElementById("share-results").addEventListener("click", () => {
      this.shareResults();
    });

    // Scorecard modal close
    document.getElementById("close-scorecard").addEventListener("click", () => {
      document.getElementById("scorecard-modal").classList.remove("active");
    });
  }

  refreshApp() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          registration.update().then(() => {
            // Force reload to get new version
            window.location.reload();
          });
        } else {
          // No service worker, just reload
          window.location.reload();
        }
      });
    } else {
      // No service worker support, just reload
      window.location.reload();
    }
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

    // Reset game state
    this.gameState.currentHole = 1;
    this.gameState.holeResults = [];

    // Initialize par scores for all players on all holes
    this.initializeParScores();

    this.switchScreen("game-screen");
    this.updateGameDisplay();
    this.generateScoreInputs();
    this.saveGame();
  }

  // NEW METHOD: Initialize par scores for all players
  initializeParScores() {
    for (
      let playerIndex = 0;
      playerIndex < this.gameState.players.length;
      playerIndex++
    ) {
      this.gameState.scores[playerIndex] = {};
      for (let hole = 1; hole <= 18; hole++) {
        const par = this.course.holes[hole - 1].par;
        this.gameState.scores[playerIndex][hole] = par;
      }
    }
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
        if (scoreToPar < 0) statusText = `${Math.abs(scoreToPar)} under par`;
        else if (scoreToPar > 0) statusText = `${scoreToPar} over par`;
        else statusText = "Even par";
      } else {
        statusText = "No score entered";
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
        this.gameState.scores[index][this.gameState.currentHole];
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
      this.gameState.scores[playerIndex][this.gameState.currentHole];
    const newScore = Math.max(1, currentScore + adjustment);

    this.gameState.scores[playerIndex][this.gameState.currentHole] = newScore;
    this.recalculateAllPoints();
    this.generateScoreInputs();
    this.updateLeaderboard();
    this.saveGame();
  }

  recalculateAllPoints() {
    // Reset points to starting values
    this.gameState.players.forEach((player, index) => {
      this.gameState.points[index] = player.startPoints;
    });

    // Clear hole results
    this.gameState.holeResults = [];

    // Recalculate points for each completed hole
    for (let holeNum = 1; holeNum <= 18; holeNum++) {
      if (this.allScoresEnteredForHole(holeNum)) {
        this.calculatePointsForHole(holeNum);
      }
    }

    // Display current hole results if they exist
    if (this.gameState.holeResults[this.gameState.currentHole - 1]) {
      this.displayHoleResults();
    }
  }

  allScoresEnteredForHole(holeNum) {
    return this.gameState.players.every(
      (_, index) => this.gameState.scores[index][holeNum] !== undefined
    );
  }

  calculatePointsForHole(holeNum) {
    const holeScores = this.gameState.players.map((player, index) => ({
      playerIndex: index,
      score: this.gameState.scores[index][holeNum],
      player: player.name,
    }));

    // Sort by score (ascending)
    holeScores.sort((a, b) => a.score - b.score);

    // Calculate points for this hole
    const holePoints = {};
    this.gameState.players.forEach((_, index) => {
      holePoints[index] = 0;
    });

    // Assign position points with proper tie handling
    const rules = this.gameState.rules;

    let currentPosition = 0;
    let i = 0;

    while (i < holeScores.length) {
      const currentScore = holeScores[i].score;
      const tiedPlayers = holeScores.filter((p) => p.score === currentScore);

      // Calculate average points for tied players
      let totalPointsForTiedGroup = 0;
      for (
        let pos = currentPosition;
        pos < currentPosition + tiedPlayers.length;
        pos++
      ) {
        if (pos === 0) totalPointsForTiedGroup += rules.firstPoints;
        else if (pos === 1) totalPointsForTiedGroup += rules.secondPoints;
        else if (pos === 2) totalPointsForTiedGroup += rules.thirdPoints;
        // Players beyond 3rd place get 0 points
      }

      const avgPoints = totalPointsForTiedGroup / tiedPlayers.length;

      // Assign points to all tied players
      tiedPlayers.forEach((tp) => {
        holePoints[tp.playerIndex] = avgPoints;
      });

      currentPosition += tiedPlayers.length;
      i += tiedPlayers.length;
    }

    // Add bonus points
    const par = this.course.holes[holeNum - 1].par;
    holeScores.forEach(({ playerIndex, score }) => {
      const scoreToPar = score - par;

      if (score === 1) {
        // Hole in one
        if (rules.hioWin) {
          holePoints[playerIndex] += 10; // Large bonus for HIO
        }
      } else if (scoreToPar === -2) {
        // Eagle
        holePoints[playerIndex] += rules.eagleBonus;
      } else if (scoreToPar === -1) {
        // Birdie
        holePoints[playerIndex] += rules.birdieBonus;
      }
    });

    // Add hole points to total points
    Object.keys(holePoints).forEach((playerIndex) => {
      this.gameState.points[playerIndex] += holePoints[playerIndex];
    });

    // Store hole results
    this.gameState.holeResults[holeNum - 1] = {
      hole: holeNum,
      results: holeScores.map(({ playerIndex, score, player }) => ({
        player,
        score,
        points: holePoints[playerIndex],
      })),
    };
  }

  allScoresEntered() {
    return this.allScoresEnteredForHole(this.gameState.currentHole);
  }

  displayHoleResults() {
    const container = document.getElementById("hole-results");
    const holeResult =
      this.gameState.holeResults[this.gameState.currentHole - 1];

    if (!holeResult) {
      container.innerHTML = "";
      return;
    }

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

    // FIXED: Proper handling for finish round
    if (this.gameState.currentHole === 18 && direction === 1) {
      this.endGame();
      return;
    }

    if (newHole < 1 || newHole > 18) return;

    this.gameState.currentHole = newHole;
    this.updateGameDisplay();
    this.generateScoreInputs();
    this.displayHoleResults();
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

  // NEW METHOD: Show scorecard
  showScorecard() {
    const modal = document.getElementById("scorecard-modal");
    const container = document.getElementById("scorecard-content");

    // Generate scorecard table
    let scorecardHTML = `
      <div class="scorecard-header">
        <h3>Scorecard</h3>
        <div class="scorecard-course">${this.course.name}</div>
      </div>
      <div class="scorecard-table">
        <table>
          <thead>
            <tr>
              <th>Hole</th>
              <th>Par</th>
              <th>Yds</th>
              ${this.gameState.players
                .map((player) => `<th>${player.name}</th>`)
                .join("")}
            </tr>
          </thead>
          <tbody>
    `;

    // Front 9
    for (let hole = 1; hole <= 9; hole++) {
      const holeData = this.course.holes[hole - 1];
      scorecardHTML += `
        <tr class="${
          hole === this.gameState.currentHole ? "current-hole" : ""
        }">
          <td>${hole}</td>
          <td>${holeData.par}</td>
          <td>${holeData.yards}</td>
          ${this.gameState.players
            .map((_, index) => {
              const score = this.gameState.scores[index][hole];
              const par = holeData.par;
              const scoreToPar = score - par;
              let className = "";
              if (scoreToPar < 0) className = "under-par";
              else if (scoreToPar > 0) className = "over-par";
              return `<td class="${className}">${score}</td>`;
            })
            .join("")}
        </tr>
      `;
    }

    // Front 9 totals
    scorecardHTML += `
      <tr class="total-row">
        <td><strong>Out</strong></td>
        <td><strong>${this.course.holes
          .slice(0, 9)
          .reduce((sum, h) => sum + h.par, 0)}</strong></td>
        <td><strong>${this.course.holes
          .slice(0, 9)
          .reduce((sum, h) => sum + h.yards, 0)}</strong></td>
        ${this.gameState.players
          .map((_, index) => {
            const frontNine = this.course.holes
              .slice(0, 9)
              .reduce((sum, _, holeIndex) => {
                return sum + (this.gameState.scores[index][holeIndex + 1] || 0);
              }, 0);
            return `<td><strong>${frontNine}</strong></td>`;
          })
          .join("")}
      </tr>
    `;

    // Back 9
    for (let hole = 10; hole <= 18; hole++) {
      const holeData = this.course.holes[hole - 1];
      scorecardHTML += `
        <tr class="${
          hole === this.gameState.currentHole ? "current-hole" : ""
        }">
          <td>${hole}</td>
          <td>${holeData.par}</td>
          <td>${holeData.yards}</td>
          ${this.gameState.players
            .map((_, index) => {
              const score = this.gameState.scores[index][hole];
              const par = holeData.par;
              const scoreToPar = score - par;
              let className = "";
              if (scoreToPar < 0) className = "under-par";
              else if (scoreToPar > 0) className = "over-par";
              return `<td class="${className}">${score}</td>`;
            })
            .join("")}
        </tr>
      `;
    }

    // Back 9 totals
    scorecardHTML += `
      <tr class="total-row">
        <td><strong>In</strong></td>
        <td><strong>${this.course.holes
          .slice(9, 18)
          .reduce((sum, h) => sum + h.par, 0)}</strong></td>
        <td><strong>${this.course.holes
          .slice(9, 18)
          .reduce((sum, h) => sum + h.yards, 0)}</strong></td>
        ${this.gameState.players
          .map((_, index) => {
            const backNine = this.course.holes
              .slice(9, 18)
              .reduce((sum, _, holeIndex) => {
                return (
                  sum + (this.gameState.scores[index][holeIndex + 10] || 0)
                );
              }, 0);
            return `<td><strong>${backNine}</strong></td>`;
          })
          .join("")}
      </tr>
    `;

    // Total scores
    scorecardHTML += `
      <tr class="total-row final-total">
        <td><strong>Total</strong></td>
        <td><strong>${this.course.holes.reduce(
          (sum, h) => sum + h.par,
          0
        )}</strong></td>
        <td><strong>${this.course.holes.reduce(
          (sum, h) => sum + h.yards,
          0
        )}</strong></td>
        ${this.gameState.players
          .map((_, index) => {
            const total = this.course.holes.reduce((sum, _, holeIndex) => {
              return sum + (this.gameState.scores[index][holeIndex + 1] || 0);
            }, 0);
            return `<td><strong>${total}</strong></td>`;
          })
          .join("")}
      </tr>
    `;

    // Points row
    scorecardHTML += `
      <tr class="points-row">
        <td colspan="3"><strong>Points</strong></td>
        ${this.gameState.players
          .map((_, index) => {
            return `<td><strong>${this.gameState.points[index]}</strong></td>`;
          })
          .join("")}
      </tr>
    `;

    scorecardHTML += `
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = scorecardHTML;
    modal.classList.add("active");
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
                  <div class="player-name">${position + 1}. ${player.name}</div>
                  <div class="player-status">${player.holesWon} holes won</div>
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
      `\nCourse: ${this.course.name}` +
      `\nApp Version: ${APP_VERSION}`;

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
      // Clear localStorage completely
      localStorage.removeItem("golfAppSave");

      // Reset all game state
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

      // Reset UI to default values
      document.getElementById("player-count").textContent = "3";
      document
        .querySelectorAll(".game-type-btn")
        .forEach((btn) => btn.classList.remove("active"));
      document
        .querySelector('.game-type-btn[data-type="match"]')
        .classList.add("active");
      document.getElementById("first-points").value = "2";
      document.getElementById("second-points").value = "1";
      document.getElementById("third-points").value = "0";
      document.getElementById("birdie-bonus").value = "1";
      document.getElementById("eagle-bonus").value = "2";
      document.getElementById("hio-win").checked = false;

      this.generatePlayerInputs();
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
    const saveData = {
      ...this.gameState,
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem("golfAppSave", JSON.stringify(saveData));
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
            this.displayHoleResults();
          }
        }
      } catch (e) {
        console.error("Error loading saved game:", e);
        localStorage.removeItem("golfAppSave");
      }
    }
  }
}

// PWA Service Worker Registration with version handling
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("SW registered with version:", APP_VERSION);

        // Check for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // New version available
              if (confirm("New version available! Refresh to update?")) {
                window.location.reload();
              }
            }
          });
        });
      })
      .catch((error) => console.log("SW registration failed"));
  });
}

// Initialize the app
const app = new GolfApp();
