// Game configuration
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let gridSize = 20;
let tileCount;

// Game state
let snake = [];
let food = {};
let dx = 0;
let dy = 0;
let nextDx = 0;
let nextDy = 0;
let score = 0;
let level = 1;
let speed = 90;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let gameRunning = false;
let gamePaused = false;
let gameLoop;
let startTime;
let elapsedTime = 0;
let timerInterval;
let particles = [];

// DOM elements
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('highScore');
const timeElement = document.getElementById('time');
const levelElement = document.getElementById('level');
const gameOverScreen = document.getElementById('gameOver');
const startScreen = document.getElementById('startScreen');
const pauseScreen = document.getElementById('pauseScreen');
const pauseBtn = document.getElementById('pauseBtn');
const finalScoreElement = document.getElementById('finalScore');
const finalTimeElement = document.getElementById('finalTime');
const finalLevelElement = document.getElementById('finalLevel');

// Initialize canvas size
function initCanvas() {
    const container = document.querySelector('.game-area');
    const maxWidth = Math.min(container.clientWidth - 40, 800);
    const maxHeight = Math.min(container.clientHeight - 40, 600);
    
    const size = Math.min(maxWidth, maxHeight);
    canvas.width = Math.floor(size / gridSize) * gridSize;
    canvas.height = canvas.width;
    
    tileCount = canvas.width / gridSize;
}

// Initialize
initCanvas();
highScoreElement.textContent = highScore;
startScreen.classList.add('show');

// Event listeners
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', restartGame);
document.getElementById('resumeBtn').addEventListener('click', togglePause);
pauseBtn.addEventListener('click', togglePause);

// Keyboard controls
document.addEventListener('keydown', handleKeyPress);

// Touch/Click controls for buttons
const mobileControls = document.getElementById('mobileControls');
if (mobileControls) {
    document.getElementById('upBtn').addEventListener('click', () => changeDirection(0, -1));
    document.getElementById('downBtn').addEventListener('click', () => changeDirection(0, 1));
    document.getElementById('leftBtn').addEventListener('click', () => changeDirection(-1, 0));
    document.getElementById('rightBtn').addEventListener('click', () => changeDirection(1, 0));
}

// Handle window resize
window.addEventListener('resize', () => {
    if (!gameRunning) {
        initCanvas();
        draw();
    }
});

function handleKeyPress(e) {
    // Prevent arrow keys from scrolling
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }

    if (!gameRunning) return;

    // Handle pause
    if (e.key === ' ') {
        togglePause();
        return;
    }

    if (gamePaused) return;

    switch (e.key) {
        case 'ArrowUp':
            changeDirection(0, -1);
            break;
        case 'ArrowDown':
            changeDirection(0, 1);
            break;
        case 'ArrowLeft':
            changeDirection(-1, 0);
            break;
        case 'ArrowRight':
            changeDirection(1, 0);
            break;
    }
}

function changeDirection(newDx, newDy) {
    // Use current direction for comparison if snake is moving, otherwise use buffered
    const currentDx = dx !== 0 || dy !== 0 ? dx : nextDx;
    const currentDy = dx !== 0 || dy !== 0 ? dy : nextDy;
    
    // Prevent reversing direction
    if ((newDx === -currentDx && currentDx !== 0) || (newDy === -currentDy && currentDy !== 0)) {
        return;
    }
    
    // Prevent same direction
    if (newDx === currentDx && newDy === currentDy) {
        return;
    }
    
    // Buffer the direction change
    nextDx = newDx;
    nextDy = newDy;
    
    // If snake hasn't started moving, apply immediately
    if (dx === 0 && dy === 0) {
        dx = nextDx;
        dy = nextDy;
    }
}

function togglePause() {
    if (!gameRunning) return;
    
    gamePaused = !gamePaused;
    
    if (gamePaused) {
        clearInterval(gameLoop);
        clearInterval(timerInterval);
        pauseScreen.classList.add('show');
        pauseBtn.textContent = '▶️ Resume';
    } else {
        pauseScreen.classList.remove('show');
        gameLoop = setInterval(update, speed);
        timerInterval = setInterval(updateTimer, 1000);
        pauseBtn.textContent = '⏸️ Pause';
    }
}

function startGame() {
    startScreen.classList.remove('show');
    pauseBtn.style.display = 'block';
    resetGame();
    gameRunning = true;
    gamePaused = false;
    startTime = Date.now();
    speed = 100;
    gameLoop = setInterval(update, speed);
    timerInterval = setInterval(updateTimer, 1000);
}

function restartGame() {
    gameOverScreen.classList.remove('show');
    startGame();
}

function resetGame() {
    const centerX = Math.floor(tileCount / 2);
    const centerY = Math.floor(tileCount / 2);
    snake = [{ x: centerX, y: centerY }];
    food = generateFood();
    dx = 0;
    dy = 0;
    nextDx = 0;
    nextDy = 0;
    score = 0;
    level = 1;
    speed = 100;
    elapsedTime = 0;
    particles = [];
    scoreElement.textContent = score;
    levelElement.textContent = level;
    timeElement.textContent = '00:00';
    draw();
}

function update() {
    if (!gameRunning || gamePaused) return;

    // Apply buffered direction
    if (nextDx !== 0 || nextDy !== 0) {
        dx = nextDx;
        dy = nextDy;
        nextDx = 0;
        nextDy = 0;
    }

    // Only move if direction is set
    if (dx === 0 && dy === 0) {
        draw();
        return;
    }

    // Move snake
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    // Check wall collision
    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        endGame();
        return;
    }

    // Check self collision
    for (let segment of snake) {
        if (head.x === segment.x && head.y === segment.y) {
            endGame();
            return;
        }
    }

    snake.unshift(head);

    // Check food collision
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        scoreElement.textContent = score;
        
        // Create particles
        createParticles(food.x, food.y);
        
        food = generateFood();
        
        // Level progression - speed up every 50 points
        const newLevel = Math.floor(score / 50) + 1;
        if (newLevel > level) {
            level = newLevel;
            levelElement.textContent = level;
            speed = Math.max(50, 100 - (level - 1) * 10);
            clearInterval(gameLoop);
            gameLoop = setInterval(update, speed);
        }
        
        // Update high score
        if (score > highScore) {
            highScore = score;
            highScoreElement.textContent = highScore;
            localStorage.setItem('snakeHighScore', highScore);
        }
    } else {
        snake.pop();
    }

    updateParticles();
    draw();
}

// Particle system
function createParticles(x, y) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x * gridSize + gridSize / 2,
            y: y * gridSize + gridSize / 2,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 20,
            color: `hsl(${Math.random() * 60 + 340}, 100%, 60%)`
        });
    }
}

function updateParticles() {
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        return p.life > 0;
    });
}

function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = p.life / 20;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function draw() {
    // Clear canvas
    ctx.fillStyle = '#f0f4ff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid (optional subtle grid)
    ctx.strokeStyle = '#e8eeff';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < tileCount; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridSize, 0);
        ctx.lineTo(i * gridSize, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * gridSize);
        ctx.lineTo(canvas.width, i * gridSize);
        ctx.stroke();
    }

    // Draw snake
    snake.forEach((segment, index) => {
        const gradient = ctx.createLinearGradient(
            segment.x * gridSize,
            segment.y * gridSize,
            segment.x * gridSize + gridSize,
            segment.y * gridSize + gridSize
        );
        
        if (index === 0) {
            // Head - darker
            gradient.addColorStop(0, '#667eea');
            gradient.addColorStop(1, '#5568d3');
        } else {
            // Body - lighter gradient
            gradient.addColorStop(0, '#7c8ef5');
            gradient.addColorStop(1, '#667eea');
        }
        
        ctx.fillStyle = gradient;
        ctx.fillRect(
            segment.x * gridSize + 1,
            segment.y * gridSize + 1,
            gridSize - 2,
            gridSize - 2
        );
        ctx.strokeStyle = '#5568d3';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            segment.x * gridSize + 1,
            segment.y * gridSize + 1,
            gridSize - 2,
            gridSize - 2
        );

        // Draw eyes on head
        if (index === 0) {
            ctx.fillStyle = 'white';
            const eyeSize = 3;
            const eyeOffset = 5;
            
            if (dx === 1) { // Moving right
                ctx.fillRect(segment.x * gridSize + 12, segment.y * gridSize + 5, eyeSize, eyeSize);
                ctx.fillRect(segment.x * gridSize + 12, segment.y * gridSize + 12, eyeSize, eyeSize);
            } else if (dx === -1) { // Moving left
                ctx.fillRect(segment.x * gridSize + 5, segment.y * gridSize + 5, eyeSize, eyeSize);
                ctx.fillRect(segment.x * gridSize + 5, segment.y * gridSize + 12, eyeSize, eyeSize);
            } else if (dy === 1) { // Moving down
                ctx.fillRect(segment.x * gridSize + 5, segment.y * gridSize + 12, eyeSize, eyeSize);
                ctx.fillRect(segment.x * gridSize + 12, segment.y * gridSize + 12, eyeSize, eyeSize);
            } else if (dy === -1) { // Moving up
                ctx.fillRect(segment.x * gridSize + 5, segment.y * gridSize + 5, eyeSize, eyeSize);
                ctx.fillRect(segment.x * gridSize + 12, segment.y * gridSize + 5, eyeSize, eyeSize);
            } else { // Not moving yet
                ctx.fillRect(segment.x * gridSize + 5, segment.y * gridSize + 7, eyeSize, eyeSize);
                ctx.fillRect(segment.x * gridSize + 12, segment.y * gridSize + 7, eyeSize, eyeSize);
            }
        }
    });

    // Draw food with glow effect
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff4757';
    ctx.fillStyle = '#ff4757';
    ctx.beginPath();
    ctx.arc(
        food.x * gridSize + gridSize / 2,
        food.y * gridSize + gridSize / 2,
        gridSize / 2 - 2,
        0,
        Math.PI * 2
    );
    ctx.fill();
    ctx.shadowBlur = 0;

    // Add shine to food
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(
        food.x * gridSize + gridSize / 3,
        food.y * gridSize + gridSize / 3,
        gridSize / 6,
        0,
        Math.PI * 2
    );
    ctx.fill();

    // Draw particles
    drawParticles();
}

function generateFood() {
    let newFood;
    do {
        newFood = {
            x: Math.floor(Math.random() * tileCount),
            y: Math.floor(Math.random() * tileCount)
        };
    } while (snake.some(segment => segment.x === newFood.x && segment.y === newFood.y));
    return newFood;
}

function updateTimer() {
    if (!gameRunning) return;
    elapsedTime++;
    const minutes = Math.floor(elapsedTime / 60);
    const seconds = elapsedTime % 60;
    timeElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function endGame() {
    gameRunning = false;
    gamePaused = false;
    clearInterval(gameLoop);
    clearInterval(timerInterval);
    pauseBtn.style.display = 'none';
    
    finalScoreElement.textContent = score;
    finalLevelElement.textContent = level;
    finalTimeElement.textContent = timeElement.textContent;
    
    setTimeout(() => {
        gameOverScreen.classList.add('show');
    }, 300);
}

// Draw initial state
draw();
