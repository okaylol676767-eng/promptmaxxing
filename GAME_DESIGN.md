# POST APOCALYPTIC INDIA — Design Doc (v0.2 "WAVES")

> Blueprint: *Written by: Helpless people* — a man steps outside after **10 years** inside,
> not knowing if the zombies are gone. He must manage food, face the ones that survived,
> and help other survivors. Dark aesthetic. Gore and survival-instinct based.
>
> v0.2 pivot: **realistic, short, Days Gone-inspired**. One night. Three waves. ~8 minutes.

---

## 1. The Pitch

Ten years you kept the door shut. Tonight the food ran out. You open it with a revolver
you found sealed in the trunk of a taxi — **six shots** — a steel pipe, one flare, and no
idea if the streets are empty.

They are not. And they heard the door.

## 2. Structure — one short, sharp night (~8–10 min)

No open world. **One street, one arc, three waves.** This is a playable short story.

| Beat | Length | What happens |
|---|---|---|
| **I. THE DOOR** | ~90s | Sneak-scavenge phase. Quiet. Pick up shells/food/pipe. Learn the sound meter. Groans in the fog. |
| **WAVE 1 — THE PACK** | ~60s | 4–6 freaks trickle from the fog, staggered. Loud footsteps aggro runners. Survive until the street quiets. |
| **LULL** | ~20s | Breathing room. Scavenge fast. Prepare: flip a car (barricade), place traps. |
| **WAVE 2 — THE STALKERS** | ~75s | Faster, flanking spawns from two directions. Fewer, meaner. Revolver ammo is *not* enough — pipe work required. |
| **LULL 2** | ~20s | Last chance to loot before— |
| **WAVE 3 — THE HORDE** | ~120s | **The full horde.** 25–35 freaks, stream like water around barricades, fountain of limbs. You cannot kill them all. **Survive the timer. Run. Funnel. Burn flares.** |
| **DAWN** |  | Win screen: the horde moves on, and so do you. |

**Total: 6–8 minutes. Replayability = score, choice of route, difficulty select.**

## 3. Realism Rules (Days Gone lessons applied)

1. **Sound is the game.** Every footstep, gunshot, shout, and flare makes noise (on-screen
   noise meter). Zombies investigate noise. Sprinting is *loud*; walking is *quiet*.
   **Gunshots ring out — every zombie on the map hears the first shot.** This is your choice:
   the revolver is a life-saver that summons the next wave early.
2. **The Eye (detection states)** — zombie awareness is visible: white **?** (heard something),
   yellow **!** (investigating), **red eye** (hunting YOU). Sneak-behind and pipe them down.
3. **Resources are brutal and finite.** 6 revolver rounds at start; a handful more scattered.
   Melee is quiet but costs **stamina**. No health regen; only food and bandages heal.
4. **Weight & momentum.** Player has momentum and turn-lag. Sprinting has acceleration cost,
   hard stop, stamina bar. Getting grabbed = struggle mash (Space) or death if exhausted.
5. **One night, no base, no leveling.** Death is death. Score = kills, time, calm.

## 4. Systems

### 4.1 Noise system (core innovation)
Every action emits noise with radius:
- Walk: 40 · Sprint: 220 · Melee swing: 140 · Gunshot: **1400** (whole map) · Flare: 60 · Grab-struggle: 260
Noise events create **sound pings** zombies can hear through walls (muffled 60%). Zombies walk
to the ping, wander there, groan. This replaces AI cheats: they come because *you were loud*.

### 4.2 The Eye / awareness
`calm → suspicious (heard) → investigate → hunt`. Drains back to calm when source is lost.
Hunting freaks run (2.2× walk). Sneak-walking behind an unaware freak = **stealth kill**
(instant, quiet, no gore noise spike). This is the Days Gone "engage or sneak past" choice.

### 4.3 Combat
- **Revolver**: hitscan ray, 6-round cylinder, slow reload (R, 2.2s, loud *clack*).
  Gore: headshot = pop + skull fragments; body = spray. Blood persists.
- **Steel pipe**: arc swing, stamina cost, knockback + stagger. Stealth kill from behind when
  target calm/suspicious (instakill, silent).
- **Grab escape**: when a freak reaches you: grab (screen shake, red pulse) → mash SPACE to
  shove it off, costing stamina. At 0 stamina while grabbed → death.

### 4.4 Stamina & health
- Stamina drains on sprint/swing/struggle; regen when walking/calm. At 0: heavy breathing
  (audio), slowed, cannot swing.
- No regen on HP. Bandages (+35) and food (+15 HP, +hunger removed — hunger is ambient flavor,
  not a bar this build). Vignette tightens with damage.

### 4.5 Barricades & fire (wave engineering)
- **Flip a car**: at 2 marked wrecks, hold E to flip into a barricade segment — blocks the
  street lane, horde must stream around it. One use per run.
- **Flare wall**: dropped flares make freaks avoid the radius; burning freaks ignite others
  (small chance chain). Fire = noise, though.
- **Fuel trap** (Wave 3 only): a scooter with a fuel puddle — shoot it to explode a radius
  (Days Gone gas tanks). Loud, glorious, one-time.

### 4.6 Instinct survives (blueprint nod, simplified)
The eye system + "groan direction" audio panning is the instinct system, made diegetic.
The terminal log remains as sparse flavor ("the street drinks.") — no lies this build.

## 5. Aesthetics — "cinematic dread"

- Fog gradient (depth fade), film grain, rain streaks, wet-road reflections (light streaks under
  light sources), vignette tied to HP, camera shake on shots/hits, chromatic red pulse on grab.
- Palette: near-black blues/greys, sodium-orange firelight, blood `#7a0e14`, purple UI accents.
- Procedural audio: heartbeat at low HP, breathing at low stamina, groan panning by direction,
  gunshot crack + echo tail, horde roar = layered saw stack, rain bed, pipe *clang*.

## 6. Win / Lose
- **Win**: survive Wave 3's timer → dawn. Score = kills × 100 + calm bonus (remaining ammo × 50, HP × 10).
- **Lose**: HP 0 or grabbed at 0 stamina. One life. Restart run (2 min to get back in).

## 7. Out of scope (later builds)
Open world, survivors/quests, hordes that migrate dynamically, bikes, NERO-style factions.
