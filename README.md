# Which Box?

A daily 3D packing puzzle. Everyone on the same UTC day and rules version gets the same order. Rotate and stack every parcel into the fixed smallest solvable box.

## Play
The first parcel is selected automatically. Rotate to the desired width, depth and height. Use the placement grid or click the floor of the 3D box, then choose **Place parcel**. Drag to orbit, scroll to zoom, or switch to top view. Every parcel needs full support. Use **Seal box** when all items fit.

After finishing, choose **Share result** to download a 1200 x 800 PNG, copy the image where supported, or use your device share menu. The card shows packing time and hint use, never the solution. Nothing posts automatically.

## Fair play and privacy
Daily puzzles reset at 00:00 UTC. Version 1.3 is single-player: no authenticated leaderboard, account, analytics or server-side score verification. Daily generation uses the device clock. Results are unverified and stored only in this browser, capped at 30 daily best records. Clearing site data removes them. Unfinished games reset when closed. GitHub Pages hosting has its own infrastructure logging.

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

## Release 1.2.0
A count-up timer starts with the first parcel or hint. Two progressive starter hints cost 20 seconds each. Undo is free. Sealing stops the timer; Keep improving resumes it without clearing penalties. Reload clears the attempt time, not the stored best utilization. Timing is session-only. Parcel movement, camera transitions and the lid/tape finish respect reduced-motion settings. Share cards show elapsed time, hints and scored time. No leaderboard or points system.

## Single-box redesign (local build)
One fixed Compact box, solvable by construction. The placement grid stays visible throughout play; the next unpacked parcel is selected automatically. More contains instructions, a text arrangement and reset. The help popover is offered at most once per mounted game, after three invalid position attempts or 60 seconds of visible active play without placement progress. Dismissing is free; accepting uses one of the two +20-second hints. Reset and Keep improving preserve the clock, hint count and one-shot offer. Completion replaces the packing controls. Enlarged text and short screens reflow rather than clipping controls.
