# Implementation To-Do List

## Priority 1: Core Gameplay Changes

### 1. Name Entry Screen (Pre-Game)
- [x] Create `nameEntry` game state (before `start`)
- [x] Add name capture (canvas typing, Enter to submit)
- [x] Validate name (non-empty, alphanumeric + spaces, max 20 chars)
- [x] Store `participantName` in session variable
- [x] Enter key handler to continue
- [ ] (Optional) Add HTML input + Start button for accessibility
- [x] Transition to tutorial after name entry

**Files to modify:**
- `index.html`: Add hidden input field container
- `sketch.js`: Add `nameEntry` state, input handling, validation

---

### 2. Point-Based System (Replace Lives)
- [x] Remove `lives` variable and tracking
- [x] Initialize `score = 0` (can go negative)
- [x] Add point penalties:
  - Collision: `-5` points
  - Incorrect tilt: `-2` points
- [x] Add visual floating text for point changes:
  - `+10` (green, rises) on pipe pass
  - `-5` (red, falls) on collision
  - `-2` (orange, horizontal) on tilt error
- [x] Update HUD to show score prominently (top-center, large font)
- [x] Remove "Lives: X" from HUD
- [x] Update `handleCollision()` to deduct points instead of lives
- [x] Remove game-over condition (game always continues)
- [x] Update `recordTiltForActivePipe()` to deduct -2 for incorrect tilts
- [x] Track `totalCollisions` and `tiltErrors` for analytics

**Files to modify:**
- `sketch.js`: Score system overhaul, feedback animations, HUD updates

---

### 3. Tutorial GREEN=Good / RED=Bad Reinforcement
- [x] Expand tutorial word list with explicit good/bad examples (10 words)
- [x] Update tutorial instructions overlay with color legend
- [x] Add tutorial feedback messages for correctness
- [x] Increase tutorial target to 8 successful tilts
- [x] Add "Skip Tutorial" button for repeat players
- [x] Update tutorial gap size to 220px (extra forgiving)

**Files to modify:**
- `sketch.js`: Tutorial word list, instructions text, feedback messages, skip button

---

## Priority 2: Data Export & Analytics

### 4. Update CSV Export with Participant Name
- [x] Add `participantName` to trial data logging
- [x] Update CSV filename: `FlappyIAT_[participant]_[sessionID].csv`
- [x] Update CSV header to include `participant_name` column
- [x] Add `points_at_trial` column (score snapshot at each trial)
- [x] Create session summary export:
  - Filename: `session_summary_[participantName]_[sessionID].csv`
  - Columns: name, session_id, final_score, pipes_cleared, accuracy_pct, avg_RT_ms, total_collisions, tilt_errors, timestamp
- [ ] Update results screen export action UI/label (currently press `E`)

**Files to modify:**
- `sketch.js`: CSV export functions, data logging

---

### 5. Results Screen Updates
- [x] Display participant name at top
- [x] Show final score (highlight if negative in red)
- [x] Remove "Lives remaining" display
- [x] Add "Total Collisions: X" metric
- [x] Add "Tilt Errors: X" metric
- [x] Restart from name entry on replay (clears session)
- [ ] Update export action UI/label (currently press `E`)

**Files to modify:**
- `sketch.js`: Results screen rendering

---

## Priority 3: Visual & UX Polish

### 6. Floating Point Indicators
- [x] Create `FloatingText` class with position/text/color/velocity/alpha/lifetime
- [x] Spawn floating text on pass/collision/tilt error
- [x] Render floating texts with fade-out animation
- [x] Clean up expired texts each frame

**Files to modify:**
- `sketch.js`: Add FloatingText class, spawn/render logic

---

### 7. Tutorial Enhancement
- [x] Add persistent instruction box during tutorial (legend: bump/green-left/red-right)
- [x] Add color legend (GOOD=green, BAD=red)
- [x] Pulse/highlight cue when word appears (feedback panel)
- [x] Add trial counter: "Tutorial: X/8 correct"

**Files to modify:**
- `sketch.js`: Tutorial overlay rendering

---

### 8. Stage Transition Flash
- [x] Implement "LEVEL UP!" screen between stages (~0.9s)
- [x] Center-screen overlay
- [ ] Large text animation/polish (scale-in effect) (optional)
- [ ] Add ascending notes sound (optional)
- [x] Pause gameplay during transition

**Files to modify:**
- `sketch.js`: Stage transition logic, overlay rendering

---

## Priority 4: Testing & Validation

### 9. End-to-End Testing
- [ ] Test name entry validation (empty name, special chars)
- [ ] Verify tutorial completes after 8+ correct tilts
- [ ] Test point accumulation (positive and negative scores)
- [ ] Verify collision penalties (-5) apply correctly
- [ ] Verify tilt error penalties (-2) apply correctly
- [ ] Test game continues after score goes negative
- [ ] Complete full 40-trial session (tutorial + 40 pipes)
- [ ] Verify CSV export includes all required columns (trial + summary)
- [ ] Test replay functionality (clears name, resets score)

---

### 10. Arduino-P5 Integration Testing
- [ ] Connect Arduino and verify calibration output
- [ ] Test bump detection triggers flap consistently
- [ ] Test left tilt detection (angle/velocity logged)
- [ ] Test right tilt detection (angle/velocity logged)
- [ ] Verify tilt debouncing (no double-counts within 300ms)
- [ ] Test serial reconnect after disconnect
- [ ] Verify RT calculation (word display → tilt event)

---

## Optional Enhancements (Post-Launch)

### 11. Passive Metrics (Low Priority)
- [ ] Track bump frequency per second
- [ ] Calculate RT variance (consistency measure)
- [ ] Detect post-error bump spikes (emotional regulation)
- [ ] Export passive metrics to separate CSV

### 12. High Score System
- [ ] Save high scores to localStorage by participant name
- [ ] Display top 5 scores on results screen
- [ ] Show personal best comparison

### 13. Accessibility
- [ ] Add keyboard alternative to serial input (for testing without hardware)
- [ ] Add sound toggle button
- [ ] Add color-blind mode (shape cues instead of green/red)

---

## Current Status (as of last update)

✅ **Completed:**
- Arduino calibration and gesture detection
- Serial communication protocol
- Basic stage progression
- Stimulus assignment and logging
- Tilt debouncing and expiration
- Name entry state with validation and canvas input
- Point-based scoring with floating text feedback
- CSV export with participant name and points_at_trial
- Results screen with participant name, collisions, and tilt errors

✅ **Newly Completed:**
- Tutorial overlay with legend, feedback, skip button, counter
- Session summary CSV export
- Stage transition flash (gameplay paused)

❌ **Not Started:**
- End-to-end testing
- Arduino integration testing

🔶 **Partially Complete:**
- Tutorial (exists but needs expanded word list and instructions)
- Export UI polish (on-screen button/label)
- Optional tutorial accessibility input (HTML field)
- Optional stage transition polish (animation/sound)
