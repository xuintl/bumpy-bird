# Complete Game Design Document: Flappy Bird IAT

## I. Game Workflow & Stage Structure

### Stage 0: Name Entry (Pre-Game)
**Objective:** Capture participant identity for data export

- **Screen Display:** "Enter Your Name" prompt
- **Input:** Keyboard entry captured on canvas (Enter to submit)
- **Submit:** Press Enter (optional on-screen input can be added later)
- **Data stored:** `participantName` attached to session CSV export

### Stage 1: Tutorial/Learning (not time-limited, practice until ready)
**Objective:** Learn controls and GREEN=Good / RED=Bad association

- **Screen Display:** "Tutorial Mode - Practice" header
- **Instructions overlay (live panel):**
  - "BUMP to flap"
  - "GREEN = GOOD → LEFT"
  - "RED = BAD → RIGHT"
- **Practice words (explicit good/bad cues):**
  - Good/green: Happy, Kind, Brave, Honest, Cheerful
  - Bad/red: Sad, Mean, Cruel, Dishonest, Angry
- **Mechanics:** 
  - 8 practice passes target, 5-second intervals, extra-wide gaps (220px)
  - Color legend panel + tutorial feedback messages on correctness
  - "Skip Tutorial" button available during play
- **Scoring:** Points always on: +10 pass, -5 collision, -2 incorrect tilt
- **Transition:** After 8 successful tilts OR "Skip Tutorial" click → advance to Stage 2

### Stage 2: Main Game - Level 1 (Trials 1-15, ~60 seconds)
**Objective:** Collect baseline data with moderate difficulty

- **Pipe interval:** 4 seconds
- **Gap size:** 180 pixels
- **Stimuli:** Mix of simple attributes (60%) + category pairs (40%)
  - Category words: "Female Doctor," "Male Nurse," "Gay Teacher," "Old Coder"
- **Point system:** Start with 0 points, accumulate throughout session
- **Scoring:** +10 per pipe pass, -5 per collision, -2 per incorrect tilt

### Stage 3: Main Game - Level 2 (Trials 16-30, ~55 seconds)
**Objective:** Increase pressure for authentic implicit responses

- **Pipe interval:** 3.5 seconds
- **Gap size:** 160 pixels  
- **Stimuli:** 80% category pairs, 20% simple attributes
- **Points:** Continue accumulating (can go negative if many errors)
- **Speed increase notification:** Brief "LEVEL UP!" flash (~0.9s) between stages

### Stage 4: Main Game - Level 3 (Trials 31-40, ~35 seconds)
**Objective:** Maximum challenge, flow state testing

- **Pipe interval:** 3 seconds
- **Gap size:** 140 pixels
- **Stimuli:** 100% category pairs (most stereotype-challenging)
  - "Female Engineer," "Disabled Genius," "Black CEO," "Homeless Veteran"
- **Points:** Continue accumulating (penalty pressure maintains engagement)

### Stage 5: Results Screen (indefinite)
**Objective:** Show performance without labeling bias

- **Display metrics:**
  - Participant name
  - Final score (can be negative)
  - Pipes cleared (out of 40)
  - Accuracy percentage
  - Average reaction time
  - Total collisions
  - Tilt errors
- **Actions:** "Replay" button (restarts from name entry) | "Export Data" (downloads CSV)

***

## II. Detection Mechanisms

### A. Active Detection: IAT Tilt Responses

**What we measure:**
| Metric                 | Collection Method                                | Interpretation                                          |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| **Reaction Time (RT)** | Timestamp from word display → tilt detection [5] | Slower RT on stereotype-incongruent = implicit bias [6] |
| **Tilt Angle**         | X-axis accelerometer reading in degrees [7]      | Lower angle (<35°) = hesitation/uncertainty [8]         |
| **Tilt Speed**         | Angular velocity (degrees/second) [8][9]         | Slower velocity = cognitive conflict [10]               |
| **Error Rate**         | Incorrect tilt direction per category [6]        | Higher errors = stronger implicit associations          |

**Data logged per trial (CSV format):**
```
participant_name, session_id, trial, word, category, color_cue, expected_tilt, actual_tilt, RT_ms, angle_deg, velocity_deg_s, correct, pipe_cleared, points_at_trial, level, timestamp_unix
```

### B. Passive Detection: Personality & Behavioral Traits

**What we track in background (no user awareness):**

| Trait                       | Detection Pattern                                        | Data Source                           |
| --------------------------- | -------------------------------------------------------- | ------------------------------------- |
| **Impulsivity**             | Premature bumps during "no-bump" calibration phases [11] | Z-axis spikes before pipe in range    |
| **Risk-Taking**             | Choosing tight vertical gaps vs. waiting [10]            | Y-position choices when gap varies    |
| **Persistence**             | Retry count after death, time between retries            | Session restart timestamps            |
| **Consistency**             | Reaction time variance (SD of RTs) [10]                  | Statistical measure across trials     |
| **Emotional Regulation**    | Bump frequency increase after errors [12]                | Input frequency spikes post-collision |
| **Cognitive Load Handling** | Performance delta Level 1 vs. Level 3                    | Score/accuracy drop rate              |

**Passive data logged (separate file):**
```
participant_name, session_id, total_collisions, avg_bump_frequency, RT_variance, tilt_error_rate, post_error_bump_spike, final_score
```
Currently not implemented.

***

## III. Feedback & Error Handling

### A. Incorrect Tilt Response (Wrong Category)

**Immediate feedback (happens in <200ms):**
1. **Full-screen red flash** (200ms duration, 50% opacity overlay)
2. **Error sound:** Short buzz (200ms, low tone)
3. **Visual indicator:** Red "X" appears at tilt location (fades over 500ms)
4. **Scoring:** **-2 points** (shown briefly as "-2" floating text)
5. **Data logged:** `correct = FALSE`, trial still counts for bias calculation

**Rationale:** Small penalty maintains engagement and mimics real-world consequence, but not severe enough to cause avoidance behavior.

### B. Collision with Pipe (Failed Flight)

**Collision sequence:**
1. **Bird animation:** Rotation + fall (500ms)
2. **Screen effect:** Subtle gray vignette (not full red—reserve red for tilt errors)
3. **Point deduction:** -5 points (shown as floating "-5" text)
4. **Sound:** Different tone from tilt error (distinct feedback types)

**After collision:**
- **Respawn:** Bird reappears at center after 1-second pause
- **Pipe reset:** Current pipe disappears, new pipe spawns at normal interval
- **Trial continues:** Same word/category reappears (gives second chance at IAT response)
- **No game over:** Game continues until all 40+ pipes attempted (tutorial + 40 trials)

### C. Successful Pipe Pass

**Positive feedback (subtle, not distracting):**
1. **Score increment:** +10 points, number animates briefly[2]
2. **Sound:** Light chime (50ms)
3. **No visual flash:** Keeps focus on next pipe
4. **If tilt was correct:** Small green checkmark (200ms) at tilt location[13]

***

## IV. Point System

### Point Mechanics

**Why points over lives:**
- **Continuous play:** No premature game-overs; ensures full 40-trial data collection
- **Mild consequences:** Small penalties maintain engagement without excessive stress
- **Cumulative measure:** Final score reflects overall performance (flight + tilt accuracy)

### Point Awards & Deductions

| Action                          | Points | Rationale                                           |
| ------------------------------- | ------ | --------------------------------------------------- |
| Pass pipe successfully          | +10    | Reward for sustained flight                         |
| Correct tilt response           | +0     | No bonus—keeps focus on flight, not gaming the tilt |
| Incorrect tilt response         | -2     | Small penalty for categorization error              |
| Collision (pipe/ground/ceiling) | -5     | Moderate penalty for flight failure                 |

**Score display:** Top-center, large font, updates with animated +/- indicators

**Score range:** Can go negative if many errors early on; typical good performance: 200-350 points

**High score tracking:** Local storage saves personal best by participant name

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
   Renders: Bird, Pipes, Score, Points, Word overlay
   Detects: Pipe center crossing → Display new word + color border
   Updates: Physics, positions
   ↓
   ↓
Results Screen
   ↓
   Calculate: Total score, avg RT by category, accuracy %
   Generate CSV: Download trial_data_[name]_[session].csv & session_summary.csv
```

***

## VI. Visual Feedback Summary Table

| Event | Visual | Audio | Duration | Score Impact |
| ----- | ------ | ----- | -------- | ------------ ||
| **Correct tilt** | Small green ✓ at tilt position | Soft chime | 200ms | +0 |
| **Incorrect tilt** | Full-screen red flash + red X + "-2" | Error buzz | 500ms | -2 |
| **Pipe passed** | Score +10 animation (rising) | Light chime | 300ms | +10 |
| **Collision** | Gray vignette, bird falls, floating "-5" | Thud sound | 1000ms | -5 |
| **Session complete** | "Results" overlay, final score | Fanfare | — | — |
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

**File 1: `trial_data_[participantName]_[sessionID].csv`**
```
participant_name, session_id, trial, word, category, color_cue, expected_tilt, actual_tilt, RT_ms, angle_deg, velocity_deg_s, correct, pipe_cleared, points_at_trial, level, timestamp_unix
```

**File 2: `session_summary_[participantName]_[sessionID].csv`**
```
participant_name, session_id, final_score, pipes_cleared, accuracy_pct, avg_RT_ms, total_collisions, tilt_errors, timestamp_unix
```

**Analysis potential:**
- Compare RT across categories to identify implicit biases[5][6]
- Tilt intensity differences reveal hesitation patterns[8]
- Passive metrics provide personality profile independent of IAT[10]

***

## VIII. Implementation Checklist

- [x] Arduino: Gesture detection with threshold tuning
- [x] Arduino: Serial communication protocol tested
- [x] p5.js: Serial port connection established
- [x] p5.js: Name entry screen at game start
- [x] p5.js: Tutorial stage with GREEN=Good / RED=Bad reinforcement
- [x] p5.js: 3-level progressive difficulty implemented
- [x] p5.js: Word overlay system (centered, static text)
- [x] p5.js: Color border pipe highlighting (green/red)
- [x] p5.js: Point system with +10/-5/-2 scoring and visual indicators
- [x] p5.js: Dual feedback (red flash for tilt errors, gray for collisions)
- [x] p5.js: Timestamp logging for RT calculation
- [x] p5.js: CSV export functionality with participant name + session summary CSV
- [x] Testing: Tutorial explicitly teaches green=good, red=bad (overlay + feedback + skip)
- [x] Testing: 40-trial session completes without game-over interruption (no lives)
- [x] Testing: Results screen displays participant name and neutral feedback with collision/tilt stats