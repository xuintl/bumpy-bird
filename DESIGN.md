# Complete Game Design Document: Flappy Bird IAT

## I. Game Workflow & Stage Structure

### Stage 1: Tutorial/Learning (30 seconds, not scored)
**Objective:** Learn controls without IAT pressure

- **Screen Display:** "Tutorial Mode" header
- **Mechanics:** 5 pipes, 5-second intervals, extra-wide gaps
- **Prompts:** Only simple attribute words (Happy, Sad, Brave, Mean, Kind)
- **Instructions overlay:**
  - "BUMP accelerometer UP to fly"
  - "TILT LEFT for GREEN words (Good)"
  - "TILT RIGHT for RED words (Bad)"
- **No penalties:** Screen shows "Great!" for correct tilts, "Try again!" for incorrect (no point deduction)
- **Transition:** After 5 successful pipe passes OR 60 seconds elapsed, auto-advance to Stage 2

### Stage 2: Main Game - Level 1 (Trials 1-15, ~60 seconds)
**Objective:** Collect baseline data with moderate difficulty

- **Pipe interval:** 4 seconds
- **Gap size:** 180 pixels
- **Stimuli:** Mix of simple attributes (60%) + category pairs (40%)
  - Category words: "Female Doctor," "Male Nurse," "Gay Teacher," "Old Coder"
- **Lives system:** 3 lives (health hearts displayed top-right)
- **Scoring:** +10 points per successful pipe pass, no deductions[1][2]

### Stage 3: Main Game - Level 2 (Trials 16-30, ~55 seconds)
**Objective:** Increase pressure for authentic implicit responses

- **Pipe interval:** 3.5 seconds
- **Gap size:** 160 pixels  
- **Stimuli:** 80% category pairs, 20% simple attributes
- **Lives:** Continue from Level 1 remaining lives
- **Speed increase notification:** Brief "LEVEL UP!" flash between stages

### Stage 4: Main Game - Level 3 (Trials 31-40, ~35 seconds)
**Objective:** Maximum challenge, flow state testing

- **Pipe interval:** 3 seconds
- **Gap size:** 140 pixels
- **Stimuli:** 100% category pairs (most stereotype-challenging)
  - "Female Engineer," "Disabled Genius," "Black CEO," "Homeless Veteran"
- **Lives:** Continue from previous

### Stage 5: Results Screen (indefinite)
**Objective:** Show performance without labeling bias

- **Display metrics:**
  - Final score
  - Pipes cleared (out of 40)
  - Average reaction time
  - "Your fastest category responses: [X]" (neutral framing)[3][4]
- **Replay button:** Restart from Tutorial

***

## II. Detection Mechanisms

### A. Active Detection: IAT Tilt Responses

**What we measure:**
| Metric | Collection Method | Interpretation |
|--------|------------------|----------------|
| **Reaction Time (RT)** | Timestamp from word display → tilt detection [5] | Slower RT on stereotype-incongruent = implicit bias [6] |
| **Tilt Angle** | X-axis accelerometer reading in degrees [7] | Lower angle (<35°) = hesitation/uncertainty [8] |
| **Tilt Speed** | Angular velocity (degrees/second) [8][9] | Slower velocity = cognitive conflict [10] |
| **Error Rate** | Incorrect tilt direction per category [6] | Higher errors = stronger implicit associations |

**Data logged per trial (CSV format):**
```
trial_num, word, category, color_cue, expected_tilt, actual_tilt, RT_ms, angle_deg, velocity_deg_s, correct_boolean, pipe_cleared, timestamp
```

### B. Passive Detection: Personality & Behavioral Traits

**What we track in background (no user awareness):**

| Trait | Detection Pattern | Data Source |
|-------|------------------|-------------|
| **Impulsivity** | Premature bumps during "no-bump" calibration phases [11] | Z-axis spikes before pipe in range |
| **Risk-Taking** | Choosing tight vertical gaps vs. waiting [10] | Y-position choices when gap varies |
| **Persistence** | Retry count after death, time between retries | Session restart timestamps |
| **Consistency** | Reaction time variance (SD of RTs) [10] | Statistical measure across trials |
| **Emotional Regulation** | Bump frequency increase after errors [12] | Input frequency spikes post-collision |
| **Cognitive Load Handling** | Performance delta Level 1 vs. Level 3 | Score/accuracy drop rate |

**Passive data logged (separate file):**
```
session_id, total_retries, avg_bump_frequency, RT_variance, risk_score, post_error_input_spike, level_performance_delta
```

***

## III. Feedback & Error Handling

### A. Incorrect Tilt Response (Wrong Category)

**Immediate feedback (happens in <200ms):**
1. **Full-screen red flash** (200ms duration, 50% opacity overlay)[12][13]
2. **Error sound:** Short buzz (200ms, low tone)
3. **Visual indicator:** Red "X" appears at tilt location (fades over 500ms)
4. **Scoring:** **No point deduction** (to avoid punitive feel)[4][12]
5. **Data logged:** `correct = FALSE`, trial still counts for bias calculation

**Rationale:** Immediate, clear feedback without punishment maintains engagement while collecting error data.[13][4]

### B. Collision with Pipe (Failed Flight)

**Death sequence:**
1. **Bird animation:** Rotation + fall (500ms)
2. **Screen effect:** Subtle gray vignette (not full red—reserve red for tilt errors)
3. **Life deduction:** -1 heart from top-right HUD
4. **Sound:** Different tone from tilt error (distinct feedback types)[13]

**If lives remain (>0):**
- **Respawn:** Bird reappears at center after 1-second pause
- **Pipe reset:** Current pipe disappears, new pipe spawns at normal interval
- **Trial continues:** Same word/category reappears (gives second chance at IAT response)[12]

**If lives exhausted (0 hearts):**
- **Game Over screen:** "Score: [X] | Pipes cleared: [Y]/40"
- **Options:** "Replay" or "View Results"

### C. Successful Pipe Pass

**Positive feedback (subtle, not distracting):**
1. **Score increment:** +10 points, number animates briefly[2]
2. **Sound:** Light chime (50ms)
3. **No visual flash:** Keeps focus on next pipe
4. **If tilt was correct:** Small green checkmark (200ms) at tilt location[13]

***

## IV. Scoring & Life System

### Life Mechanics (Recommended: 3-Life System)

**Why lives over instant death:**
- **Reduces frustration:** Players can recover from mistakes, encouraging continuation[3][12]
- **More data:** 3 lives ≈ 80-120 pipe attempts before game over = full 40 IAT trials[5]
- **Authentic responses:** Players stay relaxed enough for implicit bias to show (high stress = conscious override)[6]

**Life deduction triggers:**
- Collision with pipe body: -1 life
- Collision with ground: -1 life  
- Collision with ceiling: -1 life
- **NOT deducted for:** Incorrect tilt (only visual feedback)[4][12]

### Point System

| Action | Points | Rationale |
|--------|--------|-----------|
| Pass pipe successfully | +10 | Standard Flappy Bird scoring [1][2] |
| Correct tilt response | +0 | No bonus—keeps focus on flight, not gaming the tilt |
| Incorrect tilt response | +0 | No penalty—avoids conscious compensation [12] |
| Collision | +0 | Lives are penalty enough |

**Score display:** Top-left corner, updates smoothly[2]

**High score tracking:** Local storage saves personal best, displayed on results screen

***

## V. Data Flow Architecture

```
Arduino (Accelerometer Loop 100Hz)
   ↓
   Reads: X, Y, Z acceleration
   Detects: BUMP (Z > 2.5G), TILT_LEFT (X < -30°), TILT_RIGHT (X > 30°)
   Calculates: Angle magnitude, Angular velocity
   ↓
Serial.println("BUMP") OR
Serial.println("TILT_LEFT:850:42") OR  // velocity_ms_per_deg:angle_deg
Serial.println("TILT_RIGHT:1200:38")
   ↓
   ↓
p5.js (Serial Event Handler)
   ↓
   Parses command
   If BUMP → Apply flap physics
   If TILT → Log timestamp delta from word display
   ↓
   Stores to trial array:
   {trial: 15, word: "Female Engineer", RT: 780, angle: 42, velocity: 850, correct: true, ...}
   ↓
   Checks collision → Triggers feedback
   ↓
   ↓
Game Loop (p5.js draw())
   ↓
   Renders: Bird, Pipes, Score, Lives, Word overlay
   Detects: Pipe center crossing → Display new word + color border
   Updates: Physics, positions
   ↓
   ↓
Results Screen
   ↓
   Calculate: Total score, avg RT by category, accuracy %
   Generate CSV: Download trial_data.csv & passive_metrics.csv
```

***

## VI. Visual Feedback Summary Table

| Event | Visual | Audio | Duration | Score Impact |
|-------|--------|-------|----------|--------------|
| **Correct tilt** | Small green ✓ at tilt position | Soft chime | 200ms | +0 |
| **Incorrect tilt** | Full-screen red flash + red X | Error buzz | 500ms | +0 |
| **Pipe passed** | Score +10 animation | Light chime | 300ms | +10 |
| **Collision** | Gray vignette, bird falls, -1 heart | Thud sound | 1000ms | +0 |
| **Game over** | "Game Over" overlay, final score | Descending tone | — | — |
| **Level up** | "LEVEL UP!" center flash | Ascending notes | 1000ms | +0 |

***

## VII. Results Screen Display (Post-Game Analytics)

### Displayed to User (Non-Technical, Gamified)

**Primary Metrics:**
- **Final Score:** [X] points
- **Pipes Cleared:** [Y]/40
- **Accuracy:** [Z]% correct tilts
- **Your Fastest Responses:** "[Category Name]" (e.g., "Social Traits")

**Engagement Metrics (Optional):**
- **Longest Streak:** [N] pipes in a row
- **Best Level:** Level [1/2/3]
- **Personal Best:** Compare to previous sessions

**Neutral Framing:** Avoid terms like "bias detected" or "you struggled with..."[3][4]

### Backend Data Exported (CSV for Researchers)

**File 1: `trial_data_[sessionID].csv`**
```
trial, word, category, color_cue, expected_tilt, actual_tilt, RT_ms, angle_deg, velocity_deg_s, correct, pipe_cleared, level, timestamp_unix
```

**File 2: `passive_metrics_[sessionID].csv`**
```
session_id, total_retries, avg_bump_frequency, RT_variance, risk_score, post_error_spike, impulsivity_score, persistence_score
```

**Analysis potential:**
- Compare RT across categories to identify implicit biases[5][6]
- Tilt intensity differences reveal hesitation patterns[8]
- Passive metrics provide personality profile independent of IAT[10]

***

## VIII. Implementation Checklist

- [ ] Arduino: Gesture detection with threshold tuning
- [ ] Arduino: Serial communication protocol tested
- [ ] p5.js: Serial port connection established[14][15]
- [ ] p5.js: Tutorial stage with clear instructions
- [ ] p5.js: 3-level progressive difficulty implemented
- [ ] p5.js: Word overlay system (centered, static text)[16][5]
- [ ] p5.js: Color border pipe highlighting (green/red)
- [ ] p5.js: Life system (3 hearts HUD)
- [ ] p5.js: Dual feedback (red flash for tilt errors, gray for collisions)[12][13]
- [ ] p5.js: Timestamp logging for RT calculation
- [ ] p5.js: CSV export functionality
- [ ] Testing: 40-trial session completes in 2-3 minutes[5]
- [ ] Testing: Passive metrics logged correctly
- [ ] Testing: Results screen displays neutral, engaging feedback[4]