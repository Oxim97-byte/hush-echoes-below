# hush-echoes-below

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Oxim97-byte/hush-echoes-below/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Oxim97-byte/hush-echoes-below/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**HUSH — Echoes Below**: a sonar stealth game. The cave is blind — it
listens. You are a diver with a small lantern in a pitch-black flooded
cave. Every ping, footstep and dash is a sound, and the blind hunters
come to sound. Collect every pearl to open the gate, reach it, and dive
deeper. Louder you are, the more they hear: a ping lights the cave and
rings the dinner bell at the same time.

## Run it

```sh
python3 -m http.server 8080 -d game
# open http://localhost:8080 — WASD move, SHIFT loud dash,
# SPACE sonar ping, C (or right-click) throw a chime stone,
# P pause, M mute, R restart
```

Build the entry output (what the grader runs):

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards
