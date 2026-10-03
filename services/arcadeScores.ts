import { supabase } from '../supabase';

export type ArcadeGameType = 'PUCK_DROP' | 'ZAMBONI_DASH' | 'FRENZY_SHOT' | 'CATCH';

export type ProfileHighScoreColumn =
  | 'puckdrop_high_score'
  | 'zambonidash_high_score'
  | 'frenzyshot_high_score'
  | 'cudacatch_high_score';

interface SubmitArcadeScoreParams {
  gameType: ArcadeGameType;
  initials: string;
  score: number;
  teamPlayed: string;
  profileHighScoreColumn: ProfileHighScoreColumn;
}

/**
 * Inserts an arcade_high_scores row for the current (or anonymous) user, and
 * — when signed in — syncs the player's profiles.<game>_high_score column if
 * this run beat their previous best. Shared by all arcade mini-games so the
 * score-persistence logic lives in exactly one place.
 */
export async function submitArcadeScore({
  gameType,
  initials,
  score,
  teamPlayed,
  profileHighScoreColumn,
}: SubmitArcadeScoreParams): Promise<void> {
  const { data: authData } = await supabase.auth.getSession();
  const currentUserId = authData?.session?.user?.id || null;

  const { error } = await supabase.from('arcade_high_scores').insert([
    {
      user_id: currentUserId,
      initials,
      score,
      team_played: teamPlayed,
      game_type: gameType,
    },
  ]);

  if (error) throw error;

  if (currentUserId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select(profileHighScoreColumn)
      .eq('id', currentUserId)
      .single();

    const currentBest = (profile as any)?.[profileHighScoreColumn] || 0;
    if (score > currentBest) {
      await supabase
        .from('profiles')
        .update({ [profileHighScoreColumn]: score, updated_at: new Date().toISOString() })
        .eq('id', currentUserId);
    }
  }
}

interface FetchLeaderboardOpts {
  limit?: number;
  /** When true, keeps only the top score per unique initials (frenzyshot's leaderboard). */
  dedupeByInitials?: boolean;
}

/**
 * Fetches the top N arcade_high_scores rows for a given game. On any error
 * (including no rows), resolves to an empty array rather than throwing, so
 * callers can render an empty leaderboard state without extra try/catch.
 */
export async function fetchArcadeLeaderboard(
  gameType: ArcadeGameType,
  opts: FetchLeaderboardOpts = {}
): Promise<any[]> {
  const { limit = 10, dedupeByInitials = false } = opts;

  try {
    const { data, error } = await supabase
      .from('arcade_high_scores')
      .select('*')
      .eq('game_type', gameType)
      .order('score', { ascending: false })
      .limit(dedupeByInitials ? 30 : limit);

    if (error || !data) return [];

    if (dedupeByInitials) {
      const unique: any[] = [];
      const seen = new Set<string>();
      for (const item of data) {
        const key = (item.initials || '').toUpperCase();
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(item);
        }
        if (unique.length === limit) break;
      }
      return unique;
    }

    return data;
  } catch {
    return [];
  }
}
