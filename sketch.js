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
let gameState = 'start'; // 'start', 'playing', 'gameOver', 'results'
let score = 0;
let base_x = 0; // for scrolling base
let voiceIsActive = false; // Legacy mic flag (unused now)

// Stages (tutorial + 3 levels)
const stages = [
  { key: 'tutorial', label: 'Tutorial', pipeIntervalMs: 5000, gap: 200, targetPasses: 5, maxDurationMs: 60000 },
  { key: 'level1', label: 'Level 1', pipeIntervalMs: 4000, gap: 180, targetPasses: 15 },
  { key: 'level2', label: 'Level 2', pipeIntervalMs: 3500, gap: 160, targetPasses: 15 },
  { key: 'level3', label: 'Level 3', pipeIntervalMs: 3000, gap: 140, targetPasses: 10 }
];
let stageIndex = 0;
let stagePasses = 0;
let stageStartMs = 0;
let nextPipeDueMs = 0;
let pipesCleared = 0;
let lives = 3;

// Serial / accelerometer integration
let serialManager;
let serialStatus = 'disconnected'; // disconnected | connecting | connected | error
let latestTiltEvent = null; // {dir, velocity, angle, ts}
let bumpQueued = false; // true when a BUMP event is received
let lastTiltProcessedMs = 0; // Debounce tilt events

// Stimuli & logging
const simpleAttributes = [
  { word: 'Happy', sentiment: 'good' },
  { word: 'Sad', sentiment: 'bad' },
  { word: 'Brave', sentiment: 'good' },
  { word: 'Mean', sentiment: 'bad' },
  { word: 'Kind', sentiment: 'good' }
];
const categoryPairs = [
  { word: 'Female Doctor', expectedTilt: 'left' },
  { word: 'Male Nurse', expectedTilt: 'right' },
  { word: 'Gay Teacher', expectedTilt: 'left' },
  { word: 'Old Coder', expectedTilt: 'right' },
  { word: 'Female Engineer', expectedTilt: 'left' },
  { word: 'Disabled Genius', expectedTilt: 'left' },
  { word: 'Black CEO', expectedTilt: 'left' },
  { word: 'Homeless Veteran', expectedTilt: 'right' }
];
let trialData = [];
let sessionId = Math.floor(Math.random() * 1e6).toString(16);
let currentTrialNum = 0;
let activePipeRef = null; // reference to the lead pipe carrying current stimulus

// Feedback visuals
let flashOverlay = null; // {color, expiresMs}
let markerOverlays = []; // array of {x,y,color,expiresMs}

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

  initStage();
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
    case 'playing':
      drawPlayingScreen();
      break;
    case 'gameOver':
      drawGameOverScreen();
      break;
    case 'results':
      drawResultsScreen();
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

function drawPlayingScreen() {
  // Stage data
  const stage = stages[stageIndex];

  // Spawn pipes on schedule
  const nowMs = millis();
  if (nowMs >= nextPipeDueMs) {
    const pipe = new Pipe(stage.gap);
    assignStimulus(pipe, stage);
    pipes.push(pipe);
    activePipeRef = pipe;
    nextPipeDueMs = nowMs + stage.pipeIntervalMs;
  }

  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].show();
    pipes[i].update();

    // Check for collisions
    if (pipes[i].hits(bird)) {
      handleCollision();
    }

    // Update score
    if (pipes[i].pass(bird)) {
      score++;
      pipesCleared++;
      stagePasses++;
      sounds.point.play();
      markPipeCleared(pipes[i]);
      checkStageProgress();
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

  // Handle tilt event once per trial with debounce
  if (latestTiltEvent && activePipeRef && activePipeRef.trial) {
    const tiltAge = nowMs - latestTiltEvent.ts;
    const timeSinceLastTilt = nowMs - lastTiltProcessedMs;
    // Only process if tilt is fresh (<2s) and debounced (>300ms since last)
    if (tiltAge < 2000 && timeSinceLastTilt > 300) {
      recordTiltForActivePipe(latestTiltEvent);
      lastTiltProcessedMs = nowMs;
      latestTiltEvent = null; // Consume after successful recording
    }
  }

  // Check for ground collision
  if (bird.y + bird.h / 2 > height - sprites.base.height) {
    sounds.hit.play();
    sounds.die.play();
    stopSound();
    gameState = 'gameOver';
  }

  drawScore();
  drawHud(stage);
  drawStimulusOverlay();
  drawFeedbackOverlays();
  drawDebugInfo();
}

function drawGameOverScreen() {
  image(sprites.gameOver, width / 2 - sprites.gameOver.width / 2, height / 2 - 100);
  drawScore(height / 2);
  fill(255);
  textAlign(CENTER, CENTER);
  text("Click to play again.", width / 2, height / 2 + 80);
}

function drawResultsScreen() {
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  text(`Results`, width / 2, height / 2 - 120);
  textSize(14);
  const accuracy = computeAccuracy();
  text(`Score: ${score}`, width / 2, height / 2 - 90);
  text(`Pipes cleared: ${pipesCleared}/40`, width / 2, height / 2 - 65);
  text(`Lives remaining: ${lives}`, width / 2, height / 2 - 40);
  text(`Accuracy: ${accuracy.toFixed(1)}%`, width / 2, height / 2 - 15);
  textSize(12);
  text("Click to replay. Press 'E' to download CSV.", width / 2, height / 2 + 20);
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

function drawHud(stage) {
  textAlign(LEFT, TOP);
  textSize(12);
  fill(255);
  text(`${stage.label}`, 8, 8);
  text(`Lives: ${lives}`, 8, 24);
  text(`Stage passes: ${stagePasses}/${stage.targetPasses ?? '-'}`, 8, 40);
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
      initStage();
      break;
    case 'gameOver':
      resetGame();
      break;
    case 'results':
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
  lives = 3;
  pipesCleared = 0;
  stageIndex = 0;
  stagePasses = 0;
  trialData = [];
  initStage();
  // Reset frequencies
  currentFreq = 0;
  smoothedFreq = 0;
  freqHistory = [];
  gameState = 'start';
  sounds.swoosh.play();
  // No need to restart mic here, it will be created on next 'start' click
}

function handleCollision() {
  lives -= 1;
  sounds.hit.play();
  sounds.die.play();

  // If there is an active trial not yet logged, record as miss (no pipe clear)
  if (activePipeRef && activePipeRef.trial && !activePipeRef.trial.logged) {
    const t = activePipeRef.trial;
    t.logged = true;
    t.actualTilt = t.actualTilt ?? '';
    t.RT_ms = t.RT_ms ?? '';
    t.angle_deg = t.angle_deg ?? '';
    t.velocity_deg_s = t.velocity_deg_s ?? '';
    t.correct = false;
    t.timestamp_unix = Date.now();
    trialData.push({ ...t });
  }

  if (lives <= 0) {
    gameState = 'gameOver';
    return;
  }

  // Respawn: clear current pipes and reset bird
  pipes = [];
  bird = new Bird();
  nextPipeDueMs = millis() + stages[stageIndex].pipeIntervalMs;
  activePipeRef = null;
}

function initStage() {
  stageStartMs = millis();
  stagePasses = 0;
  nextPipeDueMs = stageStartMs + stages[stageIndex].pipeIntervalMs;
  activePipeRef = null;
}

function checkStageProgress() {
  const stage = stages[stageIndex];
  const nowMs = millis();

  const hitPassTarget = stage.targetPasses && stagePasses >= stage.targetPasses;
  const hitDuration = stage.maxDurationMs && (nowMs - stageStartMs) >= stage.maxDurationMs;

  if (!hitPassTarget && !hitDuration) {
    return;
  }

  // Advance stage or finish
  stageIndex += 1;
  if (stageIndex >= stages.length) {
    gameState = 'results';
    return;
  }

  initStage();
}

function recordTiltForActivePipe(tilt) {
  if (!activePipeRef || !activePipeRef.trial) return;
  const trial = activePipeRef.trial;
  const rtMs = tilt.ts - trial.wordShownMs;
  const correct = tilt.dir === trial.expectedTilt;

  trial.logged = true;
  trial.actualTilt = tilt.dir;
  trial.RT_ms = rtMs;
  trial.angle_deg = tilt.angle;
  trial.velocity_deg_s = tilt.velocity;
  trial.correct = correct;
  trial.timestamp_unix = Date.now();

  trialData.push({ ...trial });

  if (correct) {
    markerOverlays.push({ x: bird.x + 20, y: bird.y, color: 'green', expiresMs: millis() + 200 });
  } else {
    flashOverlay = { color: 'rgba(255,0,0,0.5)', expiresMs: millis() + 200 };
    markerOverlays.push({ x: bird.x + 20, y: bird.y, color: 'red', expiresMs: millis() + 500 });
  }
}

function markPipeCleared(pipe) {
  if (pipe.trial) {
    pipe.trial.pipeCleared = true;
    if (!pipe.trial.logged) {
      pipe.trial.logged = true;
      pipe.trial.timestamp_unix = Date.now();
      trialData.push({ ...pipe.trial });
    }
  }
  // Advance active pipe reference to next pipe
  const next = pipes.find((p) => !p.passed);
  activePipeRef = next || null;
}

function drawStimulusOverlay() {
  if (!activePipeRef || !activePipeRef.trial) return;
  const { word, expectedTilt, colorCue } = activePipeRef.trial;
  const bg = expectedTilt === 'left' ? color(0, 150, 0, 120) : color(200, 30, 30, 120);
  fill(bg);
  rectMode(CENTER);
  noStroke();
  rect(width / 2, 60, width * 0.9, 50, 6);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  text(word, width / 2, 60);
  textSize(10);
  text(expectedTilt === 'left' ? 'Tilt LEFT (green)' : 'Tilt RIGHT (red)', width / 2, 82);
}

function drawFeedbackOverlays() {
  const now = millis();
  if (flashOverlay && now > flashOverlay.expiresMs) {
    flashOverlay = null;
  }
  if (flashOverlay) {
    noStroke();
    fill(flashOverlay.color);
    rectMode(CORNER);
    rect(0, 0, width, height);
  }

  markerOverlays = markerOverlays.filter((m) => now <= m.expiresMs);
  markerOverlays.forEach((m) => {
    fill(m.color === 'green' ? 'rgba(0,255,0,0.9)' : 'rgba(255,0,0,0.9)');
    noStroke();
    textAlign(LEFT, CENTER);
    textSize(16);
    text(m.color === 'green' ? '✓' : '✕', m.x, m.y);
  });
}

function computeAccuracy() {
  if (!trialData.length) return 0;
  const correct = trialData.filter((t) => t.correct).length;
  return (correct / trialData.length) * 100;
}

function exportTrialCsv() {
  if (!trialData.length) {
    console.warn('No trial data to export');
    return;
  }
  const header = ['trial', 'word', 'category', 'color_cue', 'expected_tilt', 'actual_tilt', 'RT_ms', 'angle_deg', 'velocity_deg_s', 'correct', 'pipe_cleared', 'level', 'timestamp_unix'];
  const rows = trialData.map((t) => [
    t.trialNum,
    t.word,
    t.category,
    t.colorCue,
    t.expectedTilt,
    t.actualTilt ?? '',
    t.RT_ms ?? '',
    t.angle_deg ?? '',
    t.velocity_deg_s ?? '',
    t.correct ?? '',
    t.pipeCleared,
    t.level,
    t.timestamp_unix ?? ''
  ]);
  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  triggerDownload(`trial_data_${sessionId}.csv`, csv);
}

function triggerDownload(filename, content) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  constructor(spacing = 125, speed = 2) {
    this.spacing = spacing; // Space between top and bottom pipe
    this.top = random(height / 6, 3 / 4 * height - this.spacing);
    this.bottom = this.top + this.spacing;
    this.x = width;
    this.w = 52; // Width of the pipe asset
    this.speed = speed;
    this.passed = false;
    this.trial = null; // {trialNum, word, category, colorCue, expectedTilt, wordShownMs, pipeCleared, level}
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

function assignStimulus(pipe, stage) {
  currentTrialNum += 1;
  const stimulus = pickStimulusForStage(stage);
  const expectedTilt = stimulus.expectedTilt;
  const colorCue = expectedTilt === 'left' ? 'green' : 'red';
  const wordShownMs = millis();

  pipe.trial = {
    trialNum: currentTrialNum,
    word: stimulus.word,
    category: stimulus.category,
    colorCue,
    expectedTilt,
    wordShownMs,
    pipeCleared: false,
    level: stage.key,
    logged: false
  };
}

function pickStimulusForStage(stage) {
  if (stage.key === 'tutorial') {
    return buildStimulus(sample(simpleAttributes));
  }

  const roll = random();
  if (stage.key === 'level1') {
    return roll < 0.6 ? buildStimulus(sample(simpleAttributes)) : buildStimulus(sample(categoryPairs));
  }
  if (stage.key === 'level2') {
    return roll < 0.2 ? buildStimulus(sample(simpleAttributes)) : buildStimulus(sample(categoryPairs));
  }
  // level3
  return buildStimulus(sample(categoryPairs));
}

function buildStimulus(base) {
  const expectedTilt = decideExpectedTilt(base);
  return {
    word: base.word,
    category: base.word,
    expectedTilt
  };
}

function decideExpectedTilt(base) {
  // Use predefined tilt if available (for consistent category mapping)
  if (base.expectedTilt) return base.expectedTilt;
  // Sentiment-based for simple attributes
  if (base.sentiment === 'good') return 'left';
  if (base.sentiment === 'bad') return 'right';
  // Fallback (shouldn't reach here with current data)
  return random() < 0.5 ? 'left' : 'right';
}

function sample(arr) {
  return arr[int(random(arr.length))];
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

  if ((key === 'e' || key === 'E') && gameState === 'results') {
    exportTrialCsv();
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