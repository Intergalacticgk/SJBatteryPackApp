import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../supabase';
import { useAppTheme } from '../../context/ThemeContext';

interface Poll {
  id: string;
  title: string;
  question: string;
  image_url?: string;
  options: string[];
  active: boolean;
  totalVotes: number;
  voteCounts: Record<string, number>;
  userVotedOption?: string;
}

export default function PollsScreen() {
  const { theme } = useAppTheme();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [votingId, setVotingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      loadPolls(session?.user?.id);
    });

    const channel = supabase
      .channel('public:poll_votes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'poll_votes' }, () => {
        loadPolls();
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const loadPolls = async (userId?: string) => {
    setLoading(true);
    const { data: pollList } = await supabase
      .from('polls')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (!pollList) {
      setLoading(false);
      return;
    }

    const currentUid = userId || session?.user?.id;
    const enrichedPolls: Poll[] = await Promise.all(
      pollList.map(async (p) => {
        const { data: votes } = await supabase
          .from('poll_votes')
          .select('user_id, selected_option')
          .eq('poll_id', p.id);

        const counts: Record<string, number> = {};
        (p.options as string[]).forEach((opt) => (counts[opt] = 0));
        let userVoted: string | undefined;

        votes?.forEach((v) => {
          counts[v.selected_option] = (counts[v.selected_option] || 0) + 1;
          if (currentUid && v.user_id === currentUid) {
            userVoted = v.selected_option;
          }
        });

        return {
          ...p,
          options: p.options as string[],
          totalVotes: votes?.length || 0,
          voteCounts: counts,
          userVotedOption: userVoted,
        };
      })
    );

    setPolls(enrichedPolls);
    setLoading(false);
  };

  const handleVote = async (pollId: string, option: string) => {
    if (!session?.user) {
      Alert.alert('Sign In Required', 'Please sign in to cast your live vote on Section 108 polls.');
      return;
    }

    try {
      setVotingId(pollId);
      const { error } = await supabase.from('poll_votes').insert([
        {
          poll_id: pollId,
          user_id: session.user.id,
          selected_option: option,
        },
      ]);

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Already Voted', 'You have already submitted your response for this poll.');
        } else {
          Alert.alert('Vote Failed', error.message);
        }
      } else {
        loadPolls(session.user.id);
      }
    } finally {
      setVotingId(null);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['left', 'right']}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />

      <ScrollView contentContainerStyle={styles.contentPadding}>
        <View style={[styles.bannerCard, { backgroundColor: theme.subCardBg, borderColor: theme.borderColor }]}>
          <Text style={[styles.bannerTitle, { color: theme.accentGold }]}>🗳️ SECTION 108 LIVE POLLS</Text>
          <Text style={[styles.bannerSub, { color: theme.subText }]}>
            Vote on matchday traditions, chants, banner designs, and fan zone events.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.accentGold} style={{ marginTop: 40 }} />
        ) : (
          polls.map((poll) => {
            const hasVoted = !!poll.userVotedOption;

            return (
              <View
                key={poll.id}
                style={[styles.pollCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                {poll.image_url ? (
                  <Image source={{ uri: poll.image_url }} style={styles.pollImage} contentFit="cover" cachePolicy="memory-disk" />
                ) : null}

                <View style={styles.pollBody}>
                  <Text style={[styles.pollTitle, { color: theme.accentGold }]}>{poll.title}</Text>
                  <Text style={[styles.pollQuestion, { color: theme.text }]}>{poll.question}</Text>
                  <Text style={[styles.pollMeta, { color: theme.subText }]}>👥 {poll.totalVotes} Total Votes</Text>

                  <View style={styles.optionsList}>
                    {poll.options.map((opt) => {
                      const count = poll.voteCounts[opt] || 0;
                      const pct = poll.totalVotes > 0 ? Math.round((count / poll.totalVotes) * 100) : 0;
                      const isMyChoice = poll.userVotedOption === opt;

                      return (
                        <TouchableOpacity
                          key={opt}
                          style={[
                            styles.optionButton,
                            { backgroundColor: theme.subCardBg, borderColor: theme.borderColor },
                            isMyChoice && { borderColor: theme.accentGold, borderWidth: 2 },
                          ]}
                          onPress={() => !hasVoted && handleVote(poll.id, opt)}
                          disabled={hasVoted || votingId === poll.id}
                          activeOpacity={0.8}
                        >
                          {hasVoted && (
                            <View
                              style={[
                                styles.progressBar,
                                {
                                  width: `${pct}%`,
                                  backgroundColor: isMyChoice
                                    ? theme.accentGold
                                    : theme.isDark
                                    ? 'rgba(0, 66, 74, 0.5)'
                                    : 'rgba(255, 184, 0, 0.2)',
                                },
                              ]}
                            />
                          )}

                          <View style={styles.optionContent}>
                            <Text
                              style={[
                                styles.optionText,
                                { color: theme.text },
                                isMyChoice && { color: isMyChoice && theme.isDark ? '#FFFFFF' : '#001417', fontWeight: '900' },
                              ]}
                            >
                              {opt} {isMyChoice ? '✓' : ''}
                            </Text>
                            {hasVoted && (
                              <Text
                                style={[
                                  styles.pctText,
                                  { color: theme.accentGold },
                                  isMyChoice && { color: isMyChoice && theme.isDark ? '#FFFFFF' : '#001417', fontWeight: '900' },
                                ]}
                              >
                                {pct}%
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentPadding: { padding: 14, paddingBottom: 40 },
  bannerCard: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 14, alignItems: 'center' },
  bannerTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  bannerSub: { fontSize: 12, textAlign: 'center', marginTop: 4 },
  pollCard: { borderRadius: 14, borderWidth: 1, marginBottom: 14, overflow: 'hidden' },
  pollImage: { width: '100%', height: 160 },
  pollBody: { padding: 14 },
  pollTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  pollQuestion: { fontSize: 16, fontWeight: '800', lineHeight: 22, marginBottom: 6 },
  pollMeta: { fontSize: 11, fontWeight: '600', marginBottom: 12 },
  optionsList: { gap: 8 },
  optionButton: { borderRadius: 10, borderWidth: 1, minHeight: 46, justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  progressBar: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 10 },
  optionContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, zIndex: 1 },
  optionText: { fontSize: 13, fontWeight: '700', flex: 1 },
  pctText: { fontSize: 13, fontWeight: '900', marginLeft: 8 },
});