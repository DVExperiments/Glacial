/* The roster. Traits run 0..1 (night runs -1..1: negative = morning pixel). */
(function () {
  const G = (window.G = window.G || {});
  G.PIXELS = [
    { id: 'hot-pixel', name: 'Hot Pixel', color: '#FF3B30',
      bio: 'Stuck at full brightness since the factory. Starts fast, refuses to rest, occasionally regrets it.',
      t: { pace: 1.035, grit: 0.4, stamina: 0.45, nap: 0.1, kick: 0.6, night: -0.2, heart: 0.5 } },
    { id: 'burn-in', name: 'Burn-In', color: '#FF8A1F',
      bio: 'Has run the same line so many times it is etched into the screen. Never tires.',
      t: { pace: 0.985, grit: 0.75, stamina: 1.0, nap: 0.2, kick: 0.3, night: 0.1, heart: 0.4 } },
    { id: 'gamma', name: 'Gamma', color: '#FFC6A0',
      bio: 'A morning pixel. Brightest at dawn UTC, sluggish after dark.',
      t: { pace: 1.0, grit: 0.6, stamina: 0.7, nap: 0.3, kick: 0.4, night: -0.95, heart: 0.5 } },
    { id: 'dither', name: 'Dither', color: '#F2D024',
      bio: 'Can never quite decide. Fast, slow, fast again. The most chaotic pixel on the circuit.',
      t: { pace: 1.01, grit: 0.05, stamina: 0.6, nap: 0.4, kick: 0.7, night: 0.3, heart: 0.6 } },
    { id: 'chroma', name: 'Chroma', color: '#9BE22D',
      bio: 'Lives for the sprint. Saturated, impulsive and prone to lying down afterwards.',
      t: { pace: 0.99, grit: 0.35, stamina: 0.5, nap: 0.55, kick: 0.95, night: 0.2, heart: 0.7 } },
    { id: 'vsync', name: 'Vsync', color: '#2FBF5B',
      bio: 'Waits for everyone else before committing. Lethal when it has someone to chase.',
      t: { pace: 0.975, grit: 0.7, stamina: 0.75, nap: 0.2, kick: 0.5, night: 0, heart: 1.0 } },
    { id: 'moire', name: 'Moiré', color: '#20C3AF',
      bio: 'A night owl. Comes alive when the rest of the world is asleep.',
      t: { pace: 0.995, grit: 0.55, stamina: 0.7, nap: 0.3, kick: 0.4, night: 0.95, heart: 0.5 } },
    { id: 'nibble', name: 'Nibble', color: '#23B5E8',
      bio: 'Small, even steps. Never the fastest, rarely the slowest, always there.',
      t: { pace: 1.0, grit: 0.9, stamina: 0.8, nap: 0.15, kick: 0.25, night: 0, heart: 0.4 } },
    { id: 'sub-pixel', name: 'Sub-Pixel', color: '#2F6BFF',
      bio: 'Technically one third of a pixel. Makes up for it with relentless consistency.',
      t: { pace: 0.99, grit: 0.85, stamina: 0.85, nap: 0.1, kick: 0.35, night: -0.3, heart: 0.5 } },
    { id: 'anti-alias', name: 'Anti-Alias', color: '#8B6CFF',
      bio: 'Smooth to the point of boredom. Has never stumbled in public, or so it claims.',
      t: { pace: 0.995, grit: 1.0, stamina: 0.7, nap: 0.2, kick: 0.2, night: 0.2, heart: 0.3 } },
    { id: 'jaggy', name: 'Jaggy', color: '#C43AE0',
      bio: 'All edges. Stumbles more than anyone, but its sprints are frightening.',
      t: { pace: 1.02, grit: 0.15, stamina: 0.55, nap: 0.25, kick: 0.85, night: 0.4, heart: 0.6 } },
    { id: 'off-by-one', name: 'Off-By-One', color: '#FF5FA2',
      bio: 'Always seems to be exactly one step away. Has the strongest finishing kick in the field.',
      t: { pace: 0.98, grit: 0.5, stamina: 0.6, nap: 0.3, kick: 1.0, night: -0.1, heart: 0.8 } },
    { id: 'bezel', name: 'Bezel', color: '#A47551',
      bio: 'Hugs the edge of the screen. Gritty, stubborn, unglamorous.',
      t: { pace: 0.985, grit: 0.8, stamina: 0.9, nap: 0.25, kick: 0.3, night: -0.5, heart: 0.9 } },
    { id: 'lossless', name: 'Lossless', color: '#F4F4F4',
      bio: 'Pure white, perfectly preserved. Gives nothing away over 24 hours.',
      t: { pace: 0.99, grit: 0.75, stamina: 0.95, nap: 0.15, kick: 0.4, night: 0.5, heart: 0.4 } },
    { id: 'dead-pixel', name: 'Dead Pixel', color: '#6E7681',
      bio: 'Spends most races asleep. Quicker than anyone when awake. Wins more than it should.',
      t: { pace: 1.06, grit: 0.5, stamina: 0.9, nap: 0.95, kick: 0.5, night: 0, heart: 0.3 } },
    { id: 'null-pointer', name: 'Null Pointer', color: '#5A5FD6',
      bio: 'Nobody is sure where it is going. It usually gets there eventually.',
      t: { pace: 1.0, grit: 0.3, stamina: 0.65, nap: 0.45, kick: 0.6, night: 0.6, heart: 0.7 } }
  ];
  G.PX = {};
  G.PIXELS.forEach((p) => (G.PX[p.id] = p));
  G.TRAITS = [
    ['pace', 'Pace'], ['grit', 'Consistency'], ['stamina', 'Stamina'], ['nap', 'Napping'],
    ['kick', 'Finishing kick'], ['heart', 'Chasing instinct'], ['night', 'Night owl']
  ];
})();
