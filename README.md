# promptmaxxing

A workspace for pushing prompts (and everything around them) to their limits.

## 🎮 Post Apocalyptic India — LAST STAND (v0.3)

A **stationary zombie wave shooter** in 4 acts, built from the blueprint: *a man stuck in his
house for 10 years steps out unaware if the zombies are gone.* You hold one position. One wave
per level. Ammo is finite. Dark aesthetic; gore; headshots matter.

**Play:** open `index.html` in any browser (no build step, no dependencies).

| Level | Location | Wave | Ammo (if clean) |
|---|---|---|---|
| 1 | Slum Street — dead towers, dying lamp | 10 | 24 |
| 2 | Village Road — sugarcane & runners | 16 | 24 (+leftover) |
| 3 | Old Market — shutters & echoes | 24 | 34 (+leftover) |
| 4 | The Ghats — pyre, river, boats | 30 | 46 (+leftover) |

- **FPS revolver viewmodel** — recoil kick, muzzle flash, cylinder-flip reload (R, 2s),
  chambers render your remaining rounds.
- **Zombies per the reference model** — gaunt, shirtless, dark trousers, arms low and wide,
  pale waxy skin, dark eye sockets; walkers, runners and brutes.
- **Body shots take ~2 rounds; headshots drop instantly** — leftover ammo carries forward,
  so precision is the economy.
- Backdrops are procedural canvas paintings of the 4 assigned level photos (fog, film grain,
  rain, sodium lamps, river glints).

- `GAME_DESIGN.md` — design doc
- v0.2 (top-down Days Gone-style waves) and v0.1 (open world) live in git history.

## Getting Started

1. Add your files to this repository.
2. Commit with a clear message:

   ```bash
   git add .
   git commit -m "Describe your change"
   ```

3. Push to `main`:

   ```bash
   git push origin main
   ```

## Contributing

Open an issue or a pull request with your ideas. Keep prompts sharp, tested, and documented.
