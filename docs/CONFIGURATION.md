# Configuration

Copy `src/config.js` to `src/config.local.js`, which git ignores. `npm run build` uses it automatically, and
`--generic` forces the default config.

| Key | Default | Meaning |
|---|---|---|
| `ownerName` | `'Boss'` | Who the ninja team serves. Used in idle chatter and on laptop screens ("Menunggu jawaban …"). |
| `timeZone` | `'Asia/Jakarta'` | IANA zone for day/night, greetings and laptop clocks. |
| `presets` | `{ default: Hermes Kage }` | Per Hermes **profile name** → look, role, voice and likes. |
| `order` | `['default']` | Desk order. `default` always takes the Kage desk on floor 2. Profiles not listed follow alphabetically. |
| `archetypes` | `true` | Profiles without a preset get a stable random archetype. If `false`, they get a plain ninja. |

## Preset fields

```js
{
  name: 'Kaito',                 // display name (a Hermes profile display_name / Bot Mode title wins if set)
  role: 'Dev Lab',               // subtitle (the profile's title wins if set)
  style: 'spiky',                // 'kage' | 'spiky' | 'long' | 'messy' | 'bun' | 'cat'
  hair: '#2A2438', jacket: '#E2557A', trim: '#2A2438', tips: '#F78FB3', cushion: '#E2557A',
  props: ['dual'],               // desk props: 'kage' 'dual' 'palette' 'megaphone' 'abacus' 'bird' 'clapper'
  voice: 'coder',                // chat voice: 'kage' 'coder' 'artist' 'herald' 'cat' 'editor' 'messenger' 'generic'
  likes: { train: 1.8, spar: 1.6, ramen: 1.2 },   // idle activity weights (multipliers)
  // ninja cat:
  species: 'cat', fur: '#F2A65A', stripe: '#8A4B1F', muzzle: '#FFF1DC', scale: 0.92,
}
```

The `likes` keys are: `tea ramen board balcony window shelf train throw meditate browse read koi sakura
torii paddy river nap wander spar chat`.

The HQ holds 13 desks. Profiles beyond that appear in the header as "+N tanpa meja" (+N without a desk).
