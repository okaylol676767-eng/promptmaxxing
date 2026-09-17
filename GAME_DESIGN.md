# POST APOCALYPTIC INDIA — Design Doc (Prototype v0.1)

> Blueprint: *Written by: Helpless people* — a man steps outside after **10 years** inside,
> not knowing if the zombies are gone. He must manage food, face the ones that survived,
> and help other survivors. Dark aesthetic. Gore and survival-instinct based.

---

## 1. Core Fantasy

You are **The Locked Man**. Ten years of tin, rice, and silence. The doorknob is the most
terrifying object in the world. Outside, India has gone feral — monsoon-ruined apartment
blocks, overgrown flyovers, a tram bell with nobody to ring it.

The question that drives everything: **"Are they gone?"** The game never fully answers it.

## 2. Core Loop

```
LEAVE THE SHELTER → SCOUT (instinct) → SCAVENGE / AVOID / FIGHT →
EAT / TREAT / SLEEP → SURVIVORS: help or use → NIGHT falls → REPEAT → EXTRACT
```

**Session length:** 15–20 min per run. Die, and the world keeps what happened.

## 3. Systems

### 3.1 Survival Instinct (the signature system)
A visible stat **0–100**. Whispered rumors replace minimap indicators — no HUD radar.

| Instinct | Effect |
|---|---|
| High (70+) | "Something is moving near the water tank." — true within 12 tiles |
| Mid (40–69) | Rumors get vague; you *feel* watched but nothing is certain |
| Low (<40) | Rumors lie. The dark gets wider. Starvation whispers back. |

Instinct rises from kills, meals, rest, helping survivors. Falls from fear, wounds, hunger.

### 3.6 Death & Legacy ("The House Remembers")
On death you restart **in the house**, but a **memorial** (photo + candle) marks where the
previous survivor fell. If you visit and "honor" a memorial, +15 instinct, once per memorial.

### 3.2 Zombies ("The Ones That Stayed")
- **Lurker** — stands still; strikes only if you touch its 2-tile radius.
- **Rotter** — slow shamblers; audible groan when within 8 tiles (audio cue).
- **Sprinter** — rare (10%). Fast, fragile, fast gore spread. Only moves when it hears you.
- **The Patient One** (rare) — pretends to be a corpse. Only instinct > 60 reveals "It's breathing."

### The Patient One is the question "are they gone?" made flesh.

### 3.3 Gore = Ecology
Blood persists as a **fear-map**. Blood pools raise fear and attract rotters to investigate.
Meat chunks lure rotters away — you can **weaponize gore** (drop a chunk near a doorway to
bait zombies through). No gore cleanup: the world accumulates your violence.

### 3.4 Food & Healing
- Food: biscuits, rice bags, dal packets, mango pickle jars (rarer, +instinct).
- Eating: +hunger, small instinct. Starving: screen-edge vignette closes in, whispers.
- Medkits: stop bleeding; bleeding drains HP until treated.

### 3.5 Survivors
3 named survivors, each with a one-line problem. Choices matter but are cheap to implement:
- **Chotu** (kid on the flyover) — hungry. Feed him → he becomes a vendor; give him to no one → rumor engine improves.
- **Dr. Iyer** (clinic, 2nd floor) — needs 2 medkits for an outbreak; reward = free treatment forever.
  Caveat: there's a **Patient One** in the ward. Feeding him to the outbreak is possible. The game remembers.
- **The Signal Lady** (radio tower) — asks for a working **radio part**; reward = extraction call (win condition).

### 3.7 Extraction (win condition)
Find a **radio part** (rare spawn). Bring it to the Signal Lady → extraction at dawn.
Win screen: you leave, but the memorial wall lists everyone you didn't save.

## 4. Aesthetics — "dark, wet, neon rot"

| Element | Spec |
|---|---|
| Palette | `#0a0a0f` base, `#1a1030` structures, `#2d2d3a` asphalt, blood `#7a0e14`, gore `#5c0a10`, neon `#8b5cf6`, text `#c4b5fd` |
| Lighting | Radial vignette around player, wider at high instinct, closes to a slit when starving or afraid. Light sources: torch (found), flares (craftable), the moon. |
| UI | Monospace, terminal feel, uppercase micro-labels, purple accents (matches blueprint card aesthetic) |
| Audio | procedural WebAudio: groans (saw osc), heartbeat under 30 HP, rain noise, whoosh on swing |
| Particles | blood spurts, ash/monsoon drizzle, ash from burned barricade ash, dust |

## 4.1 Art pipeline (prototype)
Procedural canvas art only — no external assets. Tiles: cracked asphalt, overgrown tile, rubble,
water, puddles (reflect moonlight). Player/zombies as silhouette shapes with rim-light.

## 5. Controls
- **WASD** move · **Mouse** aim · **LMB** melee swing · **E** interact · **F** flare/torch toggle
- **Tab** inventory · **Q** eat · **H** heal · **Shift** sprint (drains hunger fast)

## 6. Prototype Scope (this build)
- One hand-built map (4 quarters: Home Quarter, Flyover, Market, Clinic + tower)
- 3 zombie types + The Patient One
- Instinct system with rumor engine (terminal-style messages)
- Gore ecology: blood map, meat-baiting
- 3 survivors with real choices
- Day counter + night danger ramp
- Win: radio part → Signal Lady → extraction. Lose: HP 0 or bleed-out.
- Death → memorial system

## 7. Out of Scope (later)
- Crafting tree, dogs, other enclaves, monsoon flood events, co-op.
