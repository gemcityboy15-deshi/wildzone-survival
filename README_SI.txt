WILDZONE: THE LOST ISLAND — 3D CO-OP SURVIVAL
================================================

Run locally:
1. Install Node.js LTS: https://nodejs.org/
2. Extract ZIP.
3. Open the WildzoneSurvival folder.
4. Click the address bar, type cmd, press Enter.
5. Run:
   npm install
   npm start
6. Open http://localhost:3000

Online multiplayer:
1. Upload project to GitHub.
2. Create a Node.js Web Service on Render.com and connect repository.
3. Build command: npm install
4. Start command: npm start
5. Share the deployed HTTPS URL with up to 3 friends.

Controls:
- WASD: move
- Mouse: look around (click game screen for mouse lock)
- Shift: sprint
- E: gather nearest resource
- Left click / ATTACK: melee attack
- Q / EAT BERRY: heal
- REPAIR BOAT: stand near boat marker on the beach; team needs 12 wood + 5 scrap
- ESCAPE: after boss key obtained, return to boat and press ESCAPE

Story progression:
1. Explore island and gather wood, berries, metal scrap.
2. Repair wrecked boat (team resources are pooled for requirement).
3. Go to the temple marker and defeat the boss.
4. The boss drops the escape key.
5. Return to repaired boat and escape.

Notes:
- Early playable prototype; not a finished commercial game.
- Three.js is loaded from a public CDN, so players need internet access.
- For deployment, make sure the service uses npm install and npm start.
- Movement and combat are prototype-grade and not production anti-cheat.
- Current prototype has simplified models and basic monster AI; audio, advanced animations,
  persistent saves, sophisticated crafting/inventory and polished boss phases are not included.


අලුත් Character abilities:
- Medic: down වුණු teammate කෙනෙක්ව 5m ඇතුළතදී එක් වතාවක් revive කරයි.
- Scout: වේගයෙන් දුවයි, stamina ඉක්මනින් නැවත පිරේ.
- Warrior: monster/boss damage වැඩියි.
- Support: 12m ඇතුළත teammates ලාගේ stamina full කරන ability එකක් (30s cooldown).
- Health 0 වුණාම player down වෙනවා. Medic revive කළොත් නැවත ක්‍රීඩා කරන්න පුළුවන්.
