# Architecture

```
src/
  config.js            default config (presets, owner name, time zone, order)  ← override in config.local.js
  scene3d/             everything 3D + the simulation
    world.js layout.js pure data: rooms, floors, stair, POIs, obstacles, camera views
    grid.js            nav grid + A* (8-neighbour, string-pulled) with portals (the stair between floors)
    brain.js           pure state machine: desk ↔ idle activities, spar choreography, chats, genin
    talk.js            curated idle-chat bank (templates + safe aggregate facts only)
    office.js          three.js renderer: camera/orbit, cutaway walls, laptop focus, overlay tags, fps budget
    room.js rooms3d.js hq2f.js village.js character.js toon.js bake.js   procedural meshes/textures
  live/
    model.js           pure live-status model: events/polls → per-profile status with TTLs (unit-tested)
    missions.js        Kanban parsing (bodies dropped) → mission scrolls / ranks
  plugin/              Hermes Desktop glue (the only SDK-dependent code)
    index.js           registers route /office, sidebar entry, palette command
    live.js            subscribes to events, polls profiles.list / session.active_list / kanban
    page.js            React page: header, tabs, inspector, feed, settings
    appearance.js      profile → look/archetype/voice
web/                   static self-hosted demo (sample data) → web/app.js
harness/               mock SDK + pages used by Playwright QA
```

## Status pipeline

1. `plugin/live.js` receives Hermes Desktop events (`message.*`, `tool.*`, `reasoning.*`, `subagent.*`,
   `approval.*`, `session.info`). It also polls `profiles.list` (roster plus last-activity watermarks),
   `session.active_list` (runtime session → stored session key) and `kanban list --json` through `cli.exec`.
2. Events are attributed to the profile that **owns the session**, never to Desktop's active profile:
   - Runtime `session_id` → `session.active_list` → stored key → `profiles.list` (`last_session`,
     `canonical_session`) or `session.list`.
   - Events with no resolved owner are parked for a few seconds. After that, a connection hint is used as
     a fallback.
3. `live/model.js` turns these signals into one status per profile: `working`, `thinking`, `approval`,
   `error`, `done`, `idle`, `stale` or `unknown`. TTLs keep a status from sticking forever.
4. `scene3d/brain.js` receives the statuses. Any non-idle status sends the agent to its desk. Urgent ones
   (`working`, `thinking`, `approval`, `error`, `unknown`) use shunshin, and the agent arrives in ≤0.4 s.
   Idle agents pick weighted activities.

## Navigation between floors

The navigation stays 2D:

- Floor 2 lives in *nav space* at `z + F2DZ` (`layout.js`). It is a region that no straight line can reach.
- A portal edge in `grid.js` joins the foot and the top of the stair.
- `world.toWorld()` and `world.stairPoint()` map nav coordinates to 3D, including the climb itself.
- Tests assert that paths only change floor through the stair.

## Performance

- Static geometry is merged per material (`bake.js`), and vegetation is instanced and outline-free.
- The village view is around 585 draw calls and 61k triangles.
- Rendering is capped at 30 fps (8 fps when the window is unfocused) and stops entirely when the page is
  hidden.
- **Auto quality:** if the achieved frame rate stays below 60 % of the cap for about 6 s, the village switches
  to **Eco**. Eco uses 45 % of the vegetation and turns off village shadows and fireflies.
