// Base canvas dimensions (keep game logic consistent)
const BASE_WIDTH = 288;
const BASE_HEIGHT = 512;
let canvasRenderer;

// Game assets
let sprites = {};
let birdFrames = [];
let sounds = {};

// Game objects
let bird;
let pipes = [];

// Game state and score
let gameState = 'start'; // 'start', 'calibrateNoise', 'calibratePitch', 'playing', 'gameOver'
let score = 0;
let base_x = 0; // for scrolling base
let voiceIsActive = false; // To track if voice is detected

// Serial / accelerometer integration
let serialManager;
let serialStatus = 'disconnected'; // disconnected | connecting | connected | error
let latestTiltEvent = null; // {dir, velocity, angle, ts}
let bumpQueued = false; // true when a BUMP event is received

// Pitch detection
let mic;
let pitch;
let audioContext;
let currentFreq = 0;
let smoothedFreq = 0;
let freqHistory = []; // Store recent frequencies for better smoothing
const SMOOTHING_WINDOW = 5; // Number of readings to average

// Calibration
let minPitch = 100; // Default low C
let maxPitch = 500; // Default high C
let noiseThreshold = 0.01; // Default amplitude threshold
let isCalibratingLow = false;
let isCalibratingHigh = false;

const model_url = 'https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe/';

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
  canvasRenderer = createCanvas(BASE_WIDTH, BASE_HEIGHT);
  applyViewportScale();
  bird = new Bird();

  // Setup audio for pitch detection
  audioContext = getAudioContext();
  // Don't create mic here, will do when calibration starts

  // Prepare serial manager but don't auto-connect; user triggers with 'C'
  serialManager = new SerialManager(onSerialLine, onSerialError, onSerialOpen, onSerialClose);
}

// --- PITCH DETECTION FUNCTIONS ---

function startPitch() {
  // Create a new mic instance each time we start pitch detection
  mic = new p5.AudioIn();
  // The callback function will start pitch detection after the mic is ready
  mic.start(() => {
    pitch = ml5.pitchDetection(model_url, audioContext, mic.stream, modelLoaded);
  }, (err) => {
    console.error("Mic start error:", err);
  });
}

function modelLoaded() {
  console.log('Pitch model loaded');
  getPitch();
}

function getPitch() {
  if (!mic.enabled) return; // Stop listening if mic is off

  pitch.getPitch((err, frequency) => {
    const amplitude = mic.getLevel();

    // Only update frequency if amplitude is above the noise threshold
    if (amplitude > noiseThreshold) {
      voiceIsActive = true;
      if (frequency) {
        currentFreq = frequency;

        // Add to history for smoothing
        freqHistory.push(frequency);
        if (freqHistory.length > SMOOTHING_WINDOW) {
          freqHistory.shift();
        }

        // Calculate smoothed frequency (average of recent readings)
        smoothedFreq = freqHistory.reduce((a, b) => a + b, 0) / freqHistory.length;
      }
    } else {
      voiceIsActive = false;
    }
    // If below threshold, don't reset frequencies, let the bird hover

    console.log(`Detected: ${currentFreq.toFixed(2)} Hz | Smoothed: ${smoothedFreq.toFixed(2)} Hz | Amp: ${amplitude.toFixed(3)}`);

    // Continue the loop
    if (gameState !== 'gameOver') {
      getPitch();
    }
  });
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
    case 'calibrateNoise':
      drawCalibrateNoiseScreen();
      break;
    case 'calibratePitch':
      drawCalibratePitchScreen();
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
  text("Flap with accelerometer bumps.\nPress 'C' to connect accelerometer (Web Serial).\nClick to start.", width / 2, height / 2 - 200);
}

function drawCalibrateNoiseScreen() {
  textAlign(CENTER, CENTER);
  fill(255);
  text("Please be quiet for a moment...\nCalibrating background noise.", width / 2, height / 2);
}

function drawCalibratePitchScreen() {
  textAlign(CENTER, CENTER);
  fill(255);
  if (isCalibratingLow) {
    text("Sing your LOWEST comfortable note.", width / 2, height / 2);
  } else if (isCalibratingHigh) {
    text("Now sing your HIGHEST comfortable note.", width / 2, height / 2);
  }
}

function drawPlayingScreen() {
  // Update and draw pipes
  if (frameCount % 90 === 0) {
    pipes.push(new Pipe());
  }
  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].show();
    pipes[i].update();

    // Check for collisions
    if (pipes[i].hits(bird)) {
      sounds.hit.play();
      sounds.die.play();
      stopSound();
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

  // Apply pending bump (flap)
  if (bumpQueued) {
    bird.flap();
    bumpQueued = false;
  }

  bird.update();
  bird.show();

  // Check for ground collision
  if (bird.y + bird.h / 2 > height - sprites.base.height) {
    sounds.hit.play();
    sounds.die.play();
    stopSound();
    gameState = 'gameOver';
  }

  drawScore();
  drawDebugInfo();
}

function drawGameOverScreen() {
  image(sprites.gameOver, width / 2 - sprites.gameOver.width / 2, height / 2 - 100);
  drawScore(height / 2);
  fill(255);
  textAlign(CENTER, CENTER);
  text("Click to play again.", width / 2, height / 2 + 80);
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

function drawDebugInfo() {
  fill(0);
  textSize(10);
  textAlign(LEFT, TOP);
  text(`Serial: ${serialStatus}`, 5, 5);
  if (latestTiltEvent) {
    text(`Tilt: ${latestTiltEvent.dir} v=${latestTiltEvent.velocity.toFixed(0)} a=${latestTiltEvent.angle.toFixed(1)}`, 5, 20);
  }
  textSize(12); // Reset text size
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
  if (audioContext.state !== 'running') {
    audioContext.resume();
  }
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

function stopSound() {
  if (mic && mic.enabled) {
    mic.stop();
    console.log("Microphone stopped.");
  }
  // Also nullify the pitch object to be recreated
  pitch = null;
}

function resetGame() {
  pipes = [];
  bird = new Bird();
  score = 0;
  // Reset frequencies
  currentFreq = 0;
  smoothedFreq = 0;
  freqHistory = [];
  gameState = 'start';
  sounds.swoosh.play();
  // No need to restart mic here, it will be created on next 'start' click
}

// --- BIRD CLASS ---

class Bird {
  constructor() {
    this.y = height / 2;
    this.x = 64;
    this.w = 34; // Approximate width from asset
    this.h = 24; // Approximate height from asset
    this.vy = 0;
    this.gravity = 0.6;
    this.lift = -9.5;
    this.frame = 0;
  }

  show() {
    // Animate the bird by cycling through frames
    const currentFrame = birdFrames[floor(this.frame) % birdFrames.length];
    image(currentFrame, this.x - this.w / 2, this.y - this.h / 2);
    this.frame += 0.2; // Control animation speed
  }

  update() {
    this.vy += this.gravity;
    this.y += this.vy;

    // Keep bird in bounds
    if (this.y < 0) {
      this.y = 0;
      this.vy = 0;
    }
    const floorY = height - sprites.base.height;
    if (this.y > floorY) {
      this.y = floorY;
      this.vy = 0;
    }
  }

  flap() {
    this.vy = this.lift;
    if (sounds.wing && !sounds.wing.isPlaying()) {
      sounds.wing.play();
    }
  }
}

// --- PIPE CLASS ---

class Pipe {
  constructor() {
    this.spacing = 125; // Space between top and bottom pipe
    this.top = random(height / 6, 3 / 4 * height - this.spacing);
    this.bottom = this.top + this.spacing;
    this.x = width;
    this.w = 52; // Width of the pipe asset
    this.speed = 2;
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
    // Check if bird is within the x-range of the pipe
    if (bird.x + bird.w / 2 > this.x && bird.x - bird.w / 2 < this.x + this.w) {
      // Check if bird hits the top or bottom pipe
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

// --- VIEWPORT AND DISPLAY HELPERS ---

function applyViewportScale() {
  if (!canvasRenderer) {
    return;
  }
  const viewportHeight = windowHeight || window.innerHeight || BASE_HEIGHT;
  const scaleFactor = viewportHeight / BASE_HEIGHT;
  const scaledWidth = BASE_WIDTH * scaleFactor;
  canvasRenderer.style('height', `${viewportHeight}px`);
  canvasRenderer.style('width', `${scaledWidth}px`);
  canvasRenderer.style('max-width', '100vw');
  canvasRenderer.style('display', 'block');
}

function windowResized() {
  applyViewportScale();
}

function keyPressed() {
  if (key === 'f' || key === 'F') {
    toggleFullscreen();
  }

  // Manual serial connect/disconnect
  if (key === 'c' || key === 'C') {
    serialManager.connect();
  }
}

function toggleFullscreen() {
  const fs = fullscreen();
  fullscreen(!fs);
  // Allow the browser a moment to enter/exit fullscreen before re-scaling
  setTimeout(applyViewportScale, 150);
}

// --- WEB SERIAL INTEGRATION ---

function onSerialLine(rawLine) {
  const line = rawLine.trim();
  if (!line) return;

  if (line === 'BUMP') {
    bumpQueued = true;
    return;
  }

  const tiltMatch = line.match(/^TILT_(LEFT|RIGHT):([0-9]+):(-?[0-9]+(?:\.\d+)?)/);
  if (tiltMatch) {
    latestTiltEvent = {
      dir: tiltMatch[1] === 'LEFT' ? 'left' : 'right',
      velocity: parseFloat(tiltMatch[2]),
      angle: parseFloat(tiltMatch[3]),
      ts: millis()
    };
    return;
  }

  // Unknown lines are kept visible in console for troubleshooting
  console.log('Serial (unparsed):', line);
}

function onSerialError(err) {
  console.error('Serial error', err);
  serialStatus = 'error';
}

function onSerialOpen() {
  serialStatus = 'connected';
  console.log('Serial connected');
}

function onSerialClose() {
  serialStatus = 'disconnected';
  console.log('Serial closed');
}

class SerialManager {
  constructor(onLine, onError, onOpen, onClose) {
    this.onLine = onLine;
    this.onError = onError;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.port = null;
    this.reader = null;
    this.decoder = new TextDecoder();
    this.buffer = '';
  }

  async connect() {
    if (!('serial' in navigator)) {
      serialStatus = 'unsupported';
      console.warn('Web Serial not supported in this browser.');
      return;
    }

    if (this.port) {
      // Already connected; toggle to disconnect
      await this.disconnect();
      return;
    }

    try {
      serialStatus = 'connecting';
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 115200 });
      this.onOpen && this.onOpen();
      this.readLoop();
    } catch (err) {
      serialStatus = 'error';
      this.onError && this.onError(err);
    }
  }

  async disconnect() {
    try {
      if (this.reader) {
        await this.reader.cancel();
      }
      if (this.port) {
        await this.port.close();
      }
    } catch (err) {
      console.warn('Error during serial disconnect', err);
    } finally {
      this.port = null;
      this.reader = null;
      this.buffer = '';
      this.onClose && this.onClose();
    }
  }

  async readLoop() {
    if (!this.port?.readable) return;
    this.reader = this.port.readable.getReader();

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          const chunk = this.decoder.decode(value, { stream: true });
          this.buffer += chunk;
          let newlineIndex;
          while ((newlineIndex = this.buffer.indexOf('\n')) >= 0) {
            const line = this.buffer.slice(0, newlineIndex);
            this.buffer = this.buffer.slice(newlineIndex + 1);
            this.onLine && this.onLine(line);
          }
        }
      }
    } catch (err) {
      this.onError && this.onError(err);
    } finally {
      await this.disconnect();
    }
  }
}