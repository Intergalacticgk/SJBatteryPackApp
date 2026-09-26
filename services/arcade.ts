import { supabase } from '../supabase';

export type GameKey = 'puckdrop' | 'zambonidash' | 'frenzyshot';

export async function submitHighScore(gameKey: GameKey, score: number, initials: string) {
  const cleanInitials = (initials || 'FAN').trim().toUpperCase().slice(0, 3);

  // 1. Get current logged-in user (if authenticated)
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id ?? null;

  // 2. Insert to the public arcade leaderboard
  await supabase.from('arcade_leaderboard').insert({
    game_key: gameKey,
    initials: cleanInitials,
    score,
    user_id: userId,
  });

  // 3. If logged in, update personal record in public.profiles
  if (userId) {
    const colName = `${gameKey}_high_score`;

    const { data: profile } = await supabase
      .from('profiles')
      .select(colName)
      .eq('id', userId)
      .single();

    const previousBest = profile ? (profile as any)[colName] || 0 : 0;

    if (score > previousBest) {
      await supabase
        .from('profiles')
        .update({
          [colName]: score,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    }
  }
}