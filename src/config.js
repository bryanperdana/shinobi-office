// Shinobi Office — default configuration (safe to publish).
// Customise WITHOUT editing tracked files: copy this file to `src/config.local.js` (git-ignored) and
// change it there. `npm run build` picks up config.local.js automatically when it exists.
//
// presets: per Hermes profile name → look + role + idle-chat voice + activity likes.
//   style: 'kage' | 'spiky' | 'long' | 'messy' | 'bun' | 'cat'   (cat also needs species: 'cat', fur, stripe, muzzle)
//   props: any of 'kage' 'dual' 'palette' 'megaphone' 'abacus' 'bird' 'clapper'
//   voice: 'kage' | 'coder' | 'artist' | 'herald' | 'cat' | 'editor' | 'messenger' | 'generic'
//   likes: multipliers for idle activities (tea, ramen, board, balcony, window, shelf, train, throw,
//          meditate, browse, read, koi, sakura, torii, paddy, river, nap, wander, spar, chat)
// Profiles without a preset get a deterministic archetype (look + props + voice) from their name.
export const CONFIG = {
  /** Who the ninja team serves — used in idle chatter and on laptop screens ("waiting for <owner>"). */
  ownerName: 'Boss',
  /** IANA timezone for the day/night cycle, greetings and laptop clocks. */
  timeZone: 'Asia/Jakarta',
  presets: {
    // the default Hermes profile is the Kage (village leader) and always takes the floor-2 desk
    default: { name: 'Hermes', role: 'Kage · Chief of Staff', hair: '#E8E6F0', jacket: '#F4F1EA', trim: '#D6334C', style: 'kage', props: ['kage'], cushion: '#D6334C', voice: 'kage', likes: { board: 1.6, read: 1.5, browse: 1.4, tea: 1.2, spar: 0.6 } },
  },
  /** Desk order (first = Kage desk). Profiles not listed follow alphabetically. */
  order: ['default'],
  /** Give profiles without a preset a random-but-stable archetype (ninja coder, artist, ninja cat, …). */
  archetypes: true,
}
