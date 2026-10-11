# Neon Club — landing page

Plain HTML / CSS / JS. No build step.

## Structure
- `index.html` — markup
- `css/styles.css` — all styles (day/night via `body.is-night`)
- `js/main.js` — three.js scene, scroll camera, day/night cycle, floodlights, weather, nav

## Run
ES modules need a local server (opening the file directly won't work):

    npx serve .
    # or
    python3 -m http.server

Three.js r160 loads from esm.sh — needs an internet connection.

## Settings
Edit `CONFIG` at the top of `js/main.js`: timeOverride, timeLapse, rallySpeed, parallax.

## Camera stops
`SHOTS` in main.js — one [position, lookAt] pair per section, in order.
