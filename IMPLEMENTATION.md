# Implementation Status & How It Works

## ✅ Current State (Fully Implemented)

### Arduino (Accelerometer Input)
- **Calibration on Startup**: Takes 20 samples over 1 second to establish rest position baseline (X, Y, Z in g-forces)
- **Bump Detection**: Triggers when Z-axis deviation from rest exceeds ~1.2g (relative to calibrated baseline), 200ms cooldown prevents double-triggers
- **Tilt Detection**: 
  - Calculates angle relative to calibrated rest position (not absolute)
  - LEFT tilt: angle < -30°, RIGHT tilt: angle > 30°
  - Hysteresis: requires return to <20° before detecting opposite tilt
  - Angular velocity calculated only when actively tilted (resets at center)
  - Outputs: `TILT_LEFT:<velocity>:<angle>` or `TILT_RIGHT:<velocity>:<angle>`

### P5.js (Game Logic)

#### Stage Flow
1. **Tutorial** (target 8 passes, 5s intervals, 220px gap)
   - Simple attributes only (10 words: 5 good/green, 5 bad/red)
   - Live legend panel (GOOD=LEFT, BAD=RIGHT) + tutorial feedback messages
   - Skip Tutorial button available during play
   
2. **Level 1** (15 pipes, 4s intervals, 180px gap)
   - 60% simple attributes, 40% category pairs
   
3. **Level 2** (15 pipes, 3.5s intervals, 160px gap)
   - 20% simple attributes, 80% category pairs
   
4. **Level 3** (10 pipes, 3s intervals, 140px gap)
   - 100% category pairs (hardest stereotypes)
   
5. **Results** (indefinite)
   - Score, pipes cleared, accuracy, collisions, tilt errors
   - Press 'E' to download trial CSV + session summary CSV

#### Input Processing
- **Bump → Flap**: Consumed immediately when received, applies lift to bird
- **Tilt → IAT Response**: 
  - Stored with timestamp, angle, velocity
  - Only consumed when active pipe exists
  - 300ms debounce prevents double-counting
  - 2s expiration window (stale tilts ignored)

#### Category Consistency
Each category pair has a **fixed expected tilt** throughout the session:
```javascript
'Female Doctor'     → LEFT  (counter-stereotype)
'Male Nurse'        → RIGHT (counter-stereotype)
'Gay Teacher'       → LEFT
'Old Coder'         → RIGHT
'Female Engineer'   → LEFT
'Disabled Genius'   → LEFT
'Black CEO'         → LEFT
'Homeless Veteran'  → RIGHT
```

This ensures IAT validity: same stimulus always requires same response.

#### Data Logging
Every trial logs:
- participant_name, session_id, trial, word, category, color_cue
- expected_tilt, actual_tilt, RT_ms, angle_deg, velocity_deg_s
- correct, pipe_cleared, points_at_trial, level, timestamp_unix

Exports on results screen ('E'):
- Trial CSV: `FlappyIAT_<name>_<session>.csv`
- Session summary CSV: participant, session, final score, pipes cleared, accuracy %, avg RT, collisions, tilt errors, timestamp

---

## 🔧 Recent Fixes Applied

### Arduino
1. ✅ Added `calibrateRestPosition()` function (was called but not defined)
2. ✅ Velocity calculation only active when tilted (prevents stale velocity)
3. ✅ Reset velocity tracking when returning to center
4. ✅ Bump threshold made more sensitive (≈+1.2g over baseline)

### P5.js
1. ✅ Fixed random category tilts → consistent mapping per category
2. ✅ Added 300ms tilt debounce to prevent accidental double-tilts
3. ✅ Added 2s tilt expiration to ignore stale events
4. ✅ Only consume tilt when active pipe with trial exists
5. ✅ Added tutorial overlay, feedback messages, and skip button
6. ✅ Added stage transition flash (~0.9s) between levels
7. ✅ Added session summary CSV export

---

## 🎮 How Game Determines Bump/Tilt

### On Arduino Power-On
1. **Sensor Init** (100 Hz ODR, ±2g range, high-res mode)
2. **Calibration** (1 second, 20 samples):
   - Averages X, Y, Z acceleration at rest
   - Example: If device sits flat → X≈0, Y≈0, Z≈1g
   - Example: If device tilted 15° right → X≈0.26, Y≈0, Z≈0.97
3. **Outputs "READY"** to serial → P5.js knows calibration complete

### During Gameplay
- **Bump**: Z-axis deviation from rest Z > 1.2g
  - If rest Z = 0.98g, triggers at Z > 2.18g
  - If rest Z = 1.05g, triggers at Z > 2.25g
  
- **Tilt**: X-axis angle from rest position
  - Calculates: `atan2(X-restX, sqrt((Y-restY)² + (Z-restZ)²))`
  - This means "0°" = whatever angle device was at during calibration
  - Threshold: ±30° from calibrated zero

### No Re-Calibration During Game
- Calibration happens ONCE at Arduino startup
- Remains valid until device is power-cycled or reset
- If player repositions device mid-game, must restart Arduino

---

## 📊 Data Collection Summary

### Per-Trial (Active IAT Measurement)
- Reaction time (word shown → tilt detected)
- Tilt direction correctness
- Tilt angle intensity
- Angular velocity (hesitation indicator)

### Session-Level (Passive Metrics - TODO)
- Retry count (persistence)
- Bump frequency (impulsivity)
- RT variance (consistency)
- Performance delta across levels (cognitive load)

### CSV Output Format
```
participant_name,session_id,trial,word,category,color_cue,expected_tilt,actual_tilt,RT_ms,angle_deg,velocity_deg_s,correct,pipe_cleared,points_at_trial,level,timestamp_unix
Alice,ab12cd,1,Happy,Happy,green,left,left,782,35.2,850,true,true,10,tutorial,1733702400000
Alice,ab12cd,2,Female Doctor,Female Doctor,green,left,right,1205,32.8,420,false,true,8,level1,1733702405000
...
```
### Session Summary CSV
```
participant_name,session_id,final_score,pipes_cleared,accuracy_pct,avg_RT_ms,total_collisions,tilt_errors,timestamp_unix
Alice,ab12cd,245,40,91.5,780.2,3,2,1733702600000
```

---

## 🚧 Known Limitations

1. **Passive Metrics Export Not Implemented**: RT variance, impulsivity, post-error bump spikes still TODO
2. **Browser Recalibration**: Must power-cycle Arduino to recalibrate baseline
3. **UI Buttons**: Export triggered by key ('E'); no on-screen export button yet
4. **Mic/Pitch Artifacts**: Legacy pitch variables remain (unused) but still in code

---

## 🎯 Testing Checklist

- [x] Arduino calibration completes on startup
- [x] Bump detection works from any rest orientation
- [x] Tilt detection relative to calibrated baseline
- [x] Category pairs have consistent expected tilts
- [x] Tilt debouncing prevents double-counts
- [x] Stale tilts (>2s) ignored
- [x] Trial data logs all required fields
- [x] CSV export works ('E' key in results) for trials + session summary
- [ ] Full 40-trial session completes (needs hardware validation)
- [ ] Passive metrics export (future)
