// Shared family-friendly initials filter for the arcade mini-games
// (Puck Drop, Frenzy Shot, Zamboni Dash, Cuda Catch).
//
// Previously this exact list + function was copy-pasted into all 4 game
// screens, and 3 of the 4 copies were missing the leet-speak normalization
// (1->I, 3->E, 4->A, 0->O, 5->S) that Puck Drop's copy had — meaning those
// 3 games would let a banned word through if spelled with numbers (e.g.
// "4SS"). Consolidated here with the stricter (Puck Drop) version so all
// four games filter consistently.
const BANNED_WORDS = [
  'FUCK', 'SHIT', 'DICK', 'COCK', 'PUSS', 'CUNT', 'ASS', 'BITCH',
  'SLUT', 'HELL', 'DAMN', 'PISS', 'TITS', 'CRAP', 'FAG', 'TWAT', 'WANK', 'JISM',
];

export function validateInitials(input: string): boolean {
  const clean = input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/1/g, 'I')
    .replace(/3/g, 'E')
    .replace(/4/g, 'A')
    .replace(/0/g, 'O')
    .replace(/5/g, 'S');

  for (const word of BANNED_WORDS) {
    if (clean.includes(word)) return false;
  }
  return true;
}
