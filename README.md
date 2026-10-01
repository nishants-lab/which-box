# Which Box?

A daily 3D packing puzzle. Everyone on the same UTC day and rules version gets the same order. Rotate and stack the parcels, then find the smallest box that fits.

## Play
Choose a box and a parcel. Rotate to the desired width, depth and height. Use the placement grid or click the floor of the 3D box, then choose **Place item**. Drag to orbit, scroll to zoom, or switch to top view. Every parcel needs full support. Use **Seal & ship** when all items fit.

After finishing, choose **Show share card** to download a 1200 x 800 PNG, copy the image where supported, or use your device share menu. The card shows utilization and hint use, never the solution. Nothing posts automatically.

## Fair play and privacy
Daily puzzles reset at 00:00 UTC. Version 1.1 is single-player: no authenticated leaderboard, account, analytics or server-side score verification. Daily generation uses the device clock. Results are unverified and stored only in this browser, capped at 30 daily best records. Clearing site data removes them. Unfinished games reset when closed. GitHub Pages hosting has its own infrastructure logging.

Items have fictional cuboid dimensions. Compact puzzles have a perfect-fit solution by construction. Novelty and production difficulty calibration remain future work. Personal progression and shared leaderboards are planned separately from the identical daily order.

## Development
Requires Node 24+.

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The Pages workflow tests and deploys main. Public dependencies only: React, Three.js and Vite. No proprietary runtime or credentials required.

## Release 1.1.0
First public browser release, with spoiler-free PNG result sharing and responsive 3D gameplay. Native image sharing and clipboard access depend on browser support and permissions; PNG download is the fallback.
