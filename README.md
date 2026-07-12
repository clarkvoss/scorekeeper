# Scorekeeper

A browser-based game scorekeeper. No build step — plain HTML/CSS/JS, static files only.

## Run locally

    python3 -m http.server 8000

Then open http://localhost:8000

## Run tests

    npm test

## Deploy to GitHub Pages

1. Push this repo to GitHub (e.g. `clarkvoss/scorekeeper`).
2. In the repo's Settings -> Pages, set the source to the `main` branch, root folder.
3. The site will be published at `https://clarkvoss.github.io/scorekeeper/`.

No build step is required — GitHub Pages serves the static files directly.
