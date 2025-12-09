/**
 * Wavy Bird - Physical Flappy Bird Game
 * Adjust these values to tune the gameplay experience.
 */
const CONFIG = {
    // Canvas & World
    WIDTH: 288,
    HEIGHT: 512,
    SCROLL_SPEED: 2,        // Speed at which pipes and ground move left

    // Bird Physics
    GRAVITY: 0.6,           // Downward acceleration per frame
    LIFT: -10,              // Upward velocity when flapping
    AIR_RESISTANCE: 0.9,    // Velocity multiplier for smooth movement
    START_X: 64,            // Bird's horizontal position
    ANIMATION_SPEED: 0.2,   // Speed of wing flap animation

    // Pipe Generation
    PIPE_SPAWN_FRAMES: 90,  // How many frames between new pipes
    PIPE_GAP: 125,          // Vertical space between top and bottom pipes
    PIPE_WIDTH: 52,         // Width of the pipe image

    // Assets Paths
    ASSETS: {
        BG: 'sprites/background-day.png',
        BASE: 'sprites/base.png',
        PIPE: 'sprites/pipe-green.png',
        GAME_OVER: 'sprites/gameover.png',
        MESSAGE: 'sprites/message.png',
        BIRD: [
            'sprites/yellowbird-downflap.png',
            'sprites/yellowbird-midflap.png',
            'sprites/yellowbird-upflap.png'
        ],
        SOUNDS: {
            POINT: 'audio/point.ogg',
            HIT: 'audio/hit.ogg',
            DIE: 'audio/die.ogg',
            SWOOSH: 'audio/swoosh.ogg',
            WING: 'audio/wing.ogg'
        }
    }
};

// Global Variables
let sprites = {};
let sounds = {};
let bird;
let pipes = [];
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let score = 0;
let baseX = 0;
let practiceMode = false;

// --- P5.JS LIFECYCLE FUNCTIONS ---

function preload() {
    // Load static images
    sprites.background = loadImage(CONFIG.ASSETS.BG);
    sprites.base = loadImage(CONFIG.ASSETS.BASE);
    sprites.pipe = loadImage(CONFIG.ASSETS.PIPE);
    sprites.gameOver = loadImage(CONFIG.ASSETS.GAME_OVER);
    sprites.message = loadImage(CONFIG.ASSETS.MESSAGE);

    // Load bird animation frames
    sprites.bird = CONFIG.ASSETS.BIRD.map(path => loadImage(path));

    // Load numbers for score (0-9.png)
    sprites.numbers = [];
    for (let i = 0; i < 10; i++) {
        sprites.numbers.push(loadImage(`sprites/${i}.png`));
    }

    // Load sounds
    sounds.point = loadSound(CONFIG.ASSETS.SOUNDS.POINT);
    sounds.hit = loadSound(CONFIG.ASSETS.SOUNDS.HIT);
    sounds.die = loadSound(CONFIG.ASSETS.SOUNDS.DIE);
    sounds.swoosh = loadSound(CONFIG.ASSETS.SOUNDS.SWOOSH);
    sounds.wing = loadSound(CONFIG.ASSETS.SOUNDS.WING);
}

function setup() {
    const canvas = createCanvas(CONFIG.WIDTH, CONFIG.HEIGHT);
    canvas.parent('main'); // Attach to the main element in HTML
    bird = new Bird();
}

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
    stroke(0);
    strokeWeight(2);
    text("Press SPACE or Click to start\nPress '.' to toggle practice mode", width / 2, height / 2 - 180);

    if (practiceMode) {
        fill(100, 255, 100);
        textSize(16);
        text("PRACTICE MODE: ON", width / 2, height / 2 + 100);
    }
}

function drawPlayingScreen() {
    // Spawn pipes
    if (frameCount % CONFIG.PIPE_SPAWN_FRAMES === 0) {
        pipes.push(new Pipe());
    }

    // Update and draw pipes
    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].show();
        pipes[i].update();

        // Check for collisions (skip in practice mode)
        if (!practiceMode && pipes[i].hits(bird)) {
            gameOver();
        }

        // Update score
        if (pipes[i].pass(bird)) {
            score++;
            sounds.point.play();
        }

        // Remove off-screen pipes
        if (pipes[i].offscreen()) {
            pipes.splice(i, 1);
        }
    }

    bird.update();
    bird.show();

    // Check for ground/ceiling collision (skip in practice mode)
    if (!practiceMode) {
        const floorY = height - sprites.base.height;
        if (bird.y + bird.h / 2 > floorY || bird.y - bird.h / 2 < 0) {
            gameOver();
        }
    }

    drawScore();

    // Show practice mode indicator
    if (practiceMode) {
        fill(100, 255, 100);
        textAlign(CENTER, TOP);
        textSize(12);
        stroke(0);
        strokeWeight(2);
        text("PRACTICE MODE", width / 2, 5);
    }
}

function drawGameOverScreen() {
    image(sprites.gameOver, width / 2 - sprites.gameOver.width / 2, height / 2 - 100);
    drawScore(height / 2);

    fill(255);
    textAlign(CENTER, CENTER);
    textSize(14);
    stroke(0);
    strokeWeight(2);
    text("Click or press SPACE to play again.", width / 2, height / 2 + 80);
}

function drawBase() {
    // Create a seamless scrolling effect
    baseX -= CONFIG.SCROLL_SPEED;
    if (baseX <= -width) {
        baseX = 0;
    }
    image(sprites.base, baseX, height - sprites.base.height, width, sprites.base.height);
    image(sprites.base, baseX + width, height - sprites.base.height, width, sprites.base.height);
}

function drawScore(yPos = 30) {
    const scoreStr = score.toString();
    let totalWidth = 0;

    // Calculate total width to center the score
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

function gameOver() {
    sounds.hit.play();
    sounds.die.play();
    gameState = 'gameOver';
}

// --- USER INPUT AND GAME RESET ---

function mousePressed() {
    handleInput();
}

function keyPressed() {
    // Toggle practice mode with '.' key
    if (key === '.') {
        practiceMode = !practiceMode;
        console.log('Practice mode:', practiceMode ? 'ON' : 'OFF');
        return false;
    }

    if (key === ' ' || keyCode === 32) {
        handleInput();
        return false;
    }
}

function handleInput() {
    switch (gameState) {
        case 'start':
            sounds.swoosh.play();
            gameState = 'playing';
            break;
        case 'playing':
            bird.flap();
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

// --- CLASSES ---

class Bird {
    constructor() {
        this.y = height / 2;
        this.x = CONFIG.START_X;
        this.w = 34; // Approximate width from asset
        this.h = 24; // Approximate height from asset
        this.vy = 0;
        this.frame = 0;
    }

    show() {
        // Animate the bird by cycling through frames
        const currentFrame = sprites.bird[floor(this.frame) % sprites.bird.length];
        image(currentFrame, this.x - this.w / 2, this.y - this.h / 2);
        this.frame += CONFIG.ANIMATION_SPEED;
    }

    update() {
        this.vy += CONFIG.GRAVITY;
        this.vy *= CONFIG.AIR_RESISTANCE;
        this.y += this.vy;

        // Keep bird in bounds (prevent flying above ceiling)
        if (this.y < 0) {
            this.y = 0;
            this.vy = 0;
        }

        // Floor collision is handled in drawPlayingScreen
        const floorY = height - sprites.base.height;
        if (this.y > floorY) {
            this.y = floorY;
            this.vy = 0;
        }
    }

    flap() {
        this.vy = CONFIG.LIFT;
        if (sounds.wing && !sounds.wing.isPlaying()) {
            sounds.wing.play();
        }
    }
}

class Pipe {
    constructor() {
        this.spacing = CONFIG.PIPE_GAP;
        // Randomize pipe position
        // Ensure pipe is within playable area (between top and base)
        const minTop = height / 6;
        const maxTop = (height - sprites.base.height) - this.spacing - (height / 6);

        this.top = random(minTop, maxTop);
        this.bottom = this.top + this.spacing;
        this.x = width;
        this.w = CONFIG.PIPE_WIDTH;
        this.speed = CONFIG.SCROLL_SPEED;
        this.passed = false;
    }

    show() {
        // Draw bottom pipe
        image(sprites.pipe, this.x, this.bottom);

        // Draw top pipe (flipped)
        push();
        translate(this.x + this.w, this.top);
        scale(1, -1); // Flip vertically
        image(sprites.pipe, 0, 0);
        pop();
    }

    update() {
        this.x -= this.speed;
    }

    offscreen() {
        return this.x < -this.w;
    }

    hits(bird) {
        // Check horizontal overlap
        if (bird.x + bird.w / 2 > this.x && bird.x - bird.w / 2 < this.x + this.w) {
            // Check vertical overlap (hit top pipe OR hit bottom pipe)
            if (bird.y - bird.h / 2 < this.top || bird.y + bird.h / 2 > this.bottom) {
                return true;
            }
        }
        return false;
    }

    pass(bird) {
        if (bird.x > this.x + this.w && !this.passed) {
            this.passed = true;
            return true;
        }
        return false;
    }
}
