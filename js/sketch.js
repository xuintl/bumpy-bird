// Game assets
let sprites = {};
let birdFrames = [];
let sounds = {};

// Game objects
let bird;
let pipes = [];

// Game state and score
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let score = 0;
let base_x = 0; // for scrolling base

// Practice mode (invincible)
let practiceMode = false;

// Preload all image sprites
function preload() {
  // Load static images
  sprites.background = loadImage('sprites/background-day.png');
  sprites.base = loadImage('sprites/base.png');
  sprites.pipe = loadImage('sprites/pipe-green.png');
  sprites.gameOver = loadImage('sprites/gameover.png');
  sprites.message = loadImage('sprites/message.png');

  // Load bird animation frames
  birdFrames.push(loadImage('sprites/yellowbird-downflap.png'));
  birdFrames.push(loadImage('sprites/yellowbird-midflap.png'));
  birdFrames.push(loadImage('sprites/yellowbird-upflap.png'));

  // Load numbers for score
  sprites.numbers = [];
  for (let i = 0; i < 10; i++) {
    sprites.numbers.push(loadImage(`sprites/${i}.png`));
  }

  // Load sounds
  sounds.point = loadSound('audio/point.ogg');
  sounds.hit = loadSound('audio/hit.ogg');
  sounds.die = loadSound('audio/die.ogg');
  sounds.swoosh = loadSound('audio/swoosh.ogg');
  sounds.wing = loadSound('audio/wing.ogg');
}

function setup() {
  createCanvas(BASE_WIDTH, BASE_HEIGHT);
  bird = new Bird();
}

// --- GAME LOGIC AND DRAW LOOP ---

function draw() {
  // Draw background
  image(sprites.background, 0, 0, width, height);

  // Handle different game states
  switch (gameState) {
    case 'start':
      drawStartScreen();
      break;
    case 'playing':
      drawPlayingScreen();
      break;
    case 'gameOver':
      drawGameOverScreen();
      break;
  }

  // Draw the scrolling base
  drawBase();
}

// --- GAME STATE DRAWING FUNCTIONS ---

function drawStartScreen() {
  image(sprites.message, width / 2 - sprites.message.width / 2, height / 2 - 150);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(14);
  text("Press SPACE or Click to start\nPress '.' to toggle practice mode", width / 2, height / 2 - 180);

  if (practiceMode) {
    fill(100, 255, 100);
    textSize(16);
    text("PRACTICE MODE: ON", width / 2, height / 2 + 100);
  }
}

function drawPlayingScreen() {
  // Spawn pipes every 90 frames
  if (frameCount % 90 === 0) {
    pipes.push(new Pipe());
  }

  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].show();
    pipes[i].update();

    // Check for collisions (skip in practice mode)
    if (!practiceMode && pipes[i].hits(bird)) {
      sounds.hit.play();
      sounds.die.play();
      gameState = 'gameOver';
    }

    // Update score
    if (pipes[i].pass(bird)) {
      score++;
      sounds.point.play();
    }

    // Remove pipes that are off-screen
    if (pipes[i].offscreen()) {
      pipes.splice(i, 1);
    }
  }

  bird.update();
  bird.show();

  // Check for ground/ceiling collision (skip in practice mode)
  if (!practiceMode) {
    if (bird.y + bird.h / 2 > height - sprites.base.height || bird.y - bird.h / 2 < 0) {
      sounds.hit.play();
      sounds.die.play();
      gameState = 'gameOver';
    }
  }

  drawScore();

  // Show practice mode indicator
  if (practiceMode) {
    fill(100, 255, 100);
    textAlign(CENTER, TOP);
    textSize(12);
    text("PRACTICE MODE", width / 2, 5);
  }
}

function drawGameOverScreen() {
  image(sprites.gameOver, width / 2 - sprites.gameOver.width / 2, height / 2 - 100);
  drawScore(height / 2);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(14);
  text("Click or press SPACE to play again.", width / 2, height / 2 + 80);
}

function drawBase() {
  // Create a seamless scrolling effect
  base_x -= 2;
  if (base_x <= -width) {
    base_x = 0;
  }
  image(sprites.base, base_x, height - sprites.base.height, width, sprites.base.height);
  image(sprites.base, base_x + width, height - sprites.base.height, width, sprites.base.height);
}

function drawScore(yPos = 30) {
  const scoreStr = score.toString();
  let totalWidth = 0;
  for (let char of scoreStr) {
    totalWidth += sprites.numbers[parseInt(char)].width;
  }

  let x = (width - totalWidth) / 2;
  for (let char of scoreStr) {
    const num = parseInt(char);
    image(sprites.numbers[num], x, yPos);
    x += sprites.numbers[num].width;
  }
}

// --- USER INPUT AND GAME RESET ---

function mousePressed() {
  switch (gameState) {
    case 'start':
      sounds.swoosh.play();
      gameState = 'playing';
      break;
    case 'gameOver':
      resetGame();
      break;
  }
}

function resetGame() {
  pipes = [];
  bird = new Bird();
  score = 0;
  gameState = 'start';
  sounds.swoosh.play();
}

function keyPressed() {
  // Toggle practice mode with '.' key
  if (key === '.') {
    practiceMode = !practiceMode;
    console.log('Practice mode:', practiceMode ? 'ON' : 'OFF');
    return false;
  }

  // Flap with space during gameplay
  if (gameState === 'playing' && (key === ' ' || keyCode === 32)) {
    bird.flap();
    return false;
  }

  // Start game with space
  if (gameState === 'start' && (key === ' ' || keyCode === 32)) {
    sounds.swoosh.play();
    gameState = 'playing';
    return false;
  }

  // Restart game with space
  if (gameState === 'gameOver' && (key === ' ' || keyCode === 32)) {
    resetGame();
    return false;
  }
}
