import { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView,
  Animated, Vibration, StatusBar, Dimensions, TextInput,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';

const { width: W } = Dimensions.get('window');

// ─── STORAGE SNACK (remplace AsyncStorage) ───────────────────────────────────
const storage = {
  _data: {},
  getItem: async (key) => storage._data[key] ?? null,
  setItem: async (key, val) => { storage._data[key] = val; },
};

// ─── GÉNÉRATEURS DE QUESTIONS ────────────────────────────────────────────────

const generateMath = (level = 1) => {
  const ops = level < 2 ? ['+', '-'] : ['+', '-', '×'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  const r = 10 + level * 12;
  let a, b, answer;
  if (op === '+') { a = Math.floor(Math.random() * r) + 1; b = Math.floor(Math.random() * r) + 1; answer = a + b; }
  else if (op === '-') { a = Math.floor(Math.random() * r) + r / 2; b = Math.floor(Math.random() * (r / 2)) + 1; answer = a - b; }
  else { a = Math.floor(Math.random() * (3 + level)) + 2; b = Math.floor(Math.random() * (3 + level)) + 2; answer = a * b; }
  const wrong = new Set([answer]);
  const choices = [answer];
  while (choices.length < 4) {
    const w = answer + (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 15) + 1);
    if (!wrong.has(w) && w > 0) { wrong.add(w); choices.push(w); }
  }
  return { type: 'math', question: `${a} ${op} ${b} = ?`, answer, choices: choices.sort(() => Math.random() - 0.5) };
};

const EMOJI_COLORS = [
  { emoji: '🔴', name: 'ROUGE' }, { emoji: '🟢', name: 'VERT' },
  { emoji: '🔵', name: 'BLEU' },  { emoji: '🟡', name: 'JAUNE' },
  { emoji: '🟠', name: 'ORANGE' },{ emoji: '🟣', name: 'VIOLET' },
];
const generateReflex = (level = 1) => {
  const pool = EMOJI_COLORS.slice(0, Math.min(4 + level, 6));
  const target = pool[Math.floor(Math.random() * pool.length)];
  const size = 9 + level * 2;
  const grid = Array.from({ length: size }, () => pool[Math.floor(Math.random() * pool.length)]);
  return { type: 'reflex', target, grid };
};

const generateMemory = (level = 1) => {
  const len = 3 + level;
  const seq = Array.from({ length: len }, () => Math.floor(Math.random() * 9) + 1);
  return { type: 'memory', sequence: seq };
};

const STROOP_COLORS = [
  { label: 'ROUGE', color: '#ff006e' },
  { label: 'BLEU',  color: '#00f5ff' },
  { label: 'VERT',  color: '#00ff9f' },
  { label: 'JAUNE', color: '#ffd600' },
];
const generateStroop = () => {
  const word  = STROOP_COLORS[Math.floor(Math.random() * STROOP_COLORS.length)];
  let color   = STROOP_COLORS[Math.floor(Math.random() * STROOP_COLORS.length)];
  while (color.label === word.label) color = STROOP_COLORS[Math.floor(Math.random() * STROOP_COLORS.length)];
  const choices = STROOP_COLORS.map(c => c.label).sort(() => Math.random() - 0.5);
  return { type: 'stroop', word: word.label, color: color.color, answer: color.label, choices };
};

const SEQUENCES = [
  { hint: '2, 4, 6, 8, ?',     answer: 10, choices: [10, 9, 12, 11]  },
  { hint: '1, 3, 6, 10, ?',    answer: 15, choices: [15, 14, 13, 16] },
  { hint: '3, 6, 12, 24, ?',   answer: 48, choices: [48, 36, 42, 50] },
  { hint: '5, 10, 15, 20, ?',  answer: 25, choices: [25, 22, 28, 30] },
  { hint: '1, 1, 2, 3, 5, ?',  answer: 8,  choices: [8, 7, 9, 6]     },
  { hint: '100, 50, 25, ?',    answer: 12, choices: [12, 10, 13, 15] },
  { hint: '2, 3, 5, 7, 11, ?', answer: 13, choices: [13, 12, 14, 15] },
  { hint: '81, 27, 9, 3, ?',   answer: 1,  choices: [1, 2, 0, 3]     },
  { hint: '10, 9, 7, 4, ?',    answer: 0,  choices: [0, 1, -1, 2]    },
  { hint: '1, 4, 9, 16, ?',    answer: 25, choices: [25, 20, 24, 30] },
];
const generateLogic = () => {
  const s = SEQUENCES[Math.floor(Math.random() * SEQUENCES.length)];
  return { type: 'logic', hint: s.hint, answer: s.answer, choices: [...s.choices].sort(() => Math.random() - 0.5) };
};

const CAPITALS = [
  { country: '🇫🇷 France',    answer: 'Paris',     choices: ['Paris', 'Lyon', 'Marseille', 'Bordeaux']      },
  { country: '🇯🇵 Japon',     answer: 'Tokyo',     choices: ['Tokyo', 'Osaka', 'Kyoto', 'Hiroshima']        },
  { country: '🇧🇷 Brésil',    answer: 'Brasília',  choices: ['Brasília', 'São Paulo', 'Rio', 'Salvador']    },
  { country: '🇦🇺 Australie', answer: 'Canberra',  choices: ['Canberra', 'Sydney', 'Melbourne', 'Perth']    },
  { country: '🇨🇦 Canada',    answer: 'Ottawa',    choices: ['Ottawa', 'Toronto', 'Montréal', 'Vancouver']  },
  { country: '🇩🇪 Allemagne', answer: 'Berlin',    choices: ['Berlin', 'Munich', 'Hambourg', 'Cologne']     },
  { country: '🇲🇦 Maroc',     answer: 'Rabat',     choices: ['Rabat', 'Casablanca', 'Fès', 'Marrakech']     },
  { country: '🇩🇿 Algérie',   answer: 'Alger',     choices: ['Alger', 'Oran', 'Constantine', 'Annaba']      },
  { country: '🇹🇳 Tunisie',   answer: 'Tunis',     choices: ['Tunis', 'Sfax', 'Sousse', 'Bizerte']          },
  { country: '🇸🇳 Sénégal',   answer: 'Dakar',     choices: ['Dakar', 'Thiès', 'Ziguinchor', 'Saint-Louis'] },
];
const generateCapital = () => {
  const c = CAPITALS[Math.floor(Math.random() * CAPITALS.length)];
  return { type: 'capital', country: c.country, answer: c.answer, choices: [...c.choices].sort(() => Math.random() - 0.5) };
};

const GAMES = [
  { id: 'math',    icon: '🧮', label: 'CALCUL',    color: '#00f5ff', desc: 'Opérations rapides', time: 6 },
  { id: 'reflex',  icon: '⚡', label: 'RÉFLEXE',   color: '#ff006e', desc: 'Trouve la couleur',  time: 5 },
  { id: 'memory',  icon: '🧠', label: 'MÉMOIRE',   color: '#bf00ff', desc: 'Retiens la séquence',time: 8 },
  { id: 'stroop',  icon: '🎨', label: 'STROOP',    color: '#ffd600', desc: 'Couleur du mot',     time: 5 },
  { id: 'logic',   icon: '🔢', label: 'LOGIQUE',   color: '#00ff9f', desc: 'Complète la suite',  time: 7 },
  { id: 'capital', icon: '🌍', label: 'CAPITALES', color: '#ff8800', desc: 'Capitale du pays',   time: 6 },
];

const ROUNDS = 8;
const BOT_NAMES  = ['NeuralX', 'BrainBot', 'CyberMind', 'AlphaIQ', 'QuantumQ'];
const BOT_AVATARS = ['🤖', '👾', '🦾', '🧬', '⚙️'];

export default function App() {
  const [screen, setScreen]             = useState('pseudo');
  const [pseudo, setPseudo]             = useState('');
  const [pseudoInput, setPseudoInput]   = useState('');
  const [leaderboard, setLeaderboard]   = useState({});
  const [globalStats, setGlobalStats]   = useState({ wins: 0, losses: 0, totalGames: 0, bestStreak: 0 });
  const [lbTab, setLbTab]               = useState('math');

  const [gameType, setGameType]         = useState('math');
  const [level, setLevel]               = useState(1);
  const [score, setScore]               = useState(0);
  const [botScore, setBotScore]         = useState(0);
  const [round, setRound]               = useState(0);
  const [timeLeft, setTimeLeft]         = useState(6);
  const [question, setQuestion]         = useState(null);
  const [feedback, setFeedback]         = useState(null);
  const [streak, setStreak]             = useState(0);
  const [bestStreak, setBestStreak]     = useState(0);
  const [memInput, setMemInput]         = useState([]);
  const [showSeq, setShowSeq]           = useState(true);
  const [countdown, setCountdown]       = useState(3);
  const [highScores, setHighScores]     = useState({});
  const [correctCount, setCorrectCount] = useState(0);
  const [bot, setBot]                   = useState({ name: 'NeuralX', avatar: '🤖' });

  const timerRef  = useRef(null);
  const botRef    = useRef(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const cdAnim    = useRef(new Animated.Value(1)).current;

  const game = GAMES.find(g => g.id === gameType) || GAMES[0];
  const TIME = Math.max(3, game.time - Math.floor((level - 1) * 0.5));

  const savePseudo = () => {
    const name = pseudoInput.trim();
    if (name.length < 2) return;
    setPseudo(name);
    setScreen('home');
  };

  const saveScore = (gameId, pts, won) => {
    const entry = { name: pseudo, score: pts, date: new Date().toLocaleDateString('fr-FR') };
    const updated = { ...leaderboard };
    if (!updated[gameId]) updated[gameId] = [];
    updated[gameId] = [...updated[gameId], entry].sort((a, b) => b.score - a.score).slice(0, 10);
    setLeaderboard(updated);
    const newStats = {
      wins:       globalStats.wins + (won ? 1 : 0),
      losses:     globalStats.losses + (won ? 0 : 1),
      totalGames: globalStats.totalGames + 1,
      bestStreak: Math.max(globalStats.bestStreak, bestStreak),
    };
    setGlobalStats(newStats);
  };

  const animCorrect = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.05, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 60,  useNativeDriver: false }),
      Animated.timing(flashAnim, { toValue: 0, duration: 280, useNativeDriver: false }),
    ]).start();
  };

  const animWrong = () => {
    Vibration.vibrate(140);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 7,   duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 45, useNativeDriver: true }),
    ]).start();
  };

  const scheduleBotAnswer = useCallback(() => {
    clearTimeout(botRef.current);
    const delay = Math.max(900, 5500 - level * 600 + Math.random() * 2000);
    botRef.current = setTimeout(() => {
      const correct = Math.random() < (0.35 + level * 0.07);
      if (correct) setBotScore(s => s + 80 + Math.floor(Math.random() * 50));
    }, delay);
  }, [level]);

  const nextQuestion = useCallback(() => {
    setFeedback(null);
    setMemInput([]);
    let q;
    if      (gameType === 'math')   q = generateMath(level);
    else if (gameType === 'reflex') q = generateReflex(level);
    else if (gameType === 'memory') {
      q = generateMemory(level);
      setShowSeq(true);
      setTimeout(() => setShowSeq(false), 2200);
    }
    else if (gameType === 'stroop') q = generateStroop();
    else if (gameType === 'logic')  q = generateLogic();
    else                            q = generateCapital();
    setQuestion(q);
    setTimeLeft(TIME);
    scheduleBotAnswer();
  }, [gameType, level, TIME, scheduleBotAnswer]);

  useEffect(() => {
    if (screen !== 'game' || feedback || (gameType === 'memory' && showSeq)) return;
    if (timeLeft <= 0) { handleAnswer(null); return; }
    timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [screen, timeLeft, feedback, showSeq]);

  useEffect(() => {
    if (screen !== 'countdown') return;
    if (countdown === 0) { setScreen('game'); setTimeout(() => nextQuestion(), 80); return; }
    cdAnim.setValue(1.5);
    Animated.timing(cdAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    const t = setTimeout(() => setCountdown(c => c - 1), 950);
    return () => clearTimeout(t);
  }, [screen, countdown]);

  const handleAnswer = useCallback((ans) => {
    clearTimeout(timerRef.current);
    clearTimeout(botRef.current);
    const correct = ans !== null && (
      gameType === 'memory'
        ? JSON.stringify(ans) === JSON.stringify(question.sequence)
        : ans === question.answer
    );
    setFeedback(correct ? 'correct' : 'wrong');
    let newStreak = streak;
    let pts = 0;
    if (correct) {
      pts = 100 + Math.max(0, timeLeft - 1) * 15 + streak * 20;
      setScore(s => s + pts);
      newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
      setCorrectCount(c => c + 1);
      animCorrect();
    } else {
      setStreak(0);
      newStreak = 0;
      animWrong();
    }
    setLevel(Math.min(Math.floor(newStreak / 2) + 1, 6));
    setTimeout(() => {
      if (round + 1 >= ROUNDS) {
        const finalScore = score + pts;
        const won = finalScore >= botScore;
        setHighScores(h => ({ ...h, [gameType]: Math.max(h[gameType] || 0, finalScore) }));
        saveScore(gameType, finalScore, won);
        setScreen('result');
      } else {
        setRound(r => r + 1);
        nextQuestion();
      }
    }, 600);
  }, [gameType, question, timeLeft, streak, bestStreak, round, score, botScore, nextQuestion]);

  const startGame = (type) => {
    const bi = Math.floor(Math.random() * BOT_NAMES.length);
    setBot({ name: BOT_NAMES[bi], avatar: BOT_AVATARS[bi] });
    setGameType(type); setScore(0); setBotScore(0); setRound(0);
    setStreak(0); setBestStreak(0); setLevel(1); setCorrectCount(0);
    setCountdown(3); setQuestion(null); setFeedback(null);
    setScreen('countdown');
  };

  const timerPct   = (timeLeft / TIME) * 100;
  const timerColor = timerPct > 55 ? '#00ff9f' : timerPct > 25 ? '#ffd600' : '#ff006e';
  const flashBg    = flashAnim.interpolate({ inputRange: [0, 1], outputRange: ['#0a0a0f', '#00ff9f18'] });
  const won        = score >= botScore;
  const stars      = () => { const p = correctCount / ROUNDS; return p >= 0.85 ? '⭐⭐⭐' : p >= 0.57 ? '⭐⭐' : '⭐'; };
  const playerPct  = score + botScore > 0 ? (score / (score + botScore)) * 100 : 50;
  const botPct     = 100 - playerPct;
  const winRate    = globalStats.totalGames > 0 ? Math.round((globalStats.wins / globalStats.totalGames) * 100) : 0;

  // ─── PSEUDO ───────────────────────────────────────────────────────────────────
  if (screen === 'pseudo') return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={s.container}>
          <Text style={{ fontSize: 52, marginBottom: 16 }}>⚔️</Text>
          <Text style={s.logoTitle}>BRAIN WARS</Text>
          <Text style={[s.logoSub, { marginBottom: 40 }]}>CHOISIS TON NOM DE GUERRIER</Text>
          <View style={s.pseudoBox}>
            <TextInput
              style={s.pseudoInput}
              placeholder="Ex: NeuralKing"
              placeholderTextColor="#333355"
              value={pseudoInput}
              onChangeText={setPseudoInput}
              maxLength={14}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={savePseudo}
            />
          </View>
          <TouchableOpacity
            style={[s.btn, { borderColor: '#00f5ff', marginTop: 20, width: '80%' }, pseudoInput.trim().length < 2 && { opacity: 0.4 }]}
            onPress={savePseudo} disabled={pseudoInput.trim().length < 2} activeOpacity={0.8}>
            <Text style={[s.btnText, { color: '#00f5ff' }]}>ENTRER EN ARÈNE  ⚔️</Text>
          </TouchableOpacity>
          <Text style={s.pseudoHint}>2 à 14 caractères</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  // ─── LEADERBOARD ──────────────────────────────────────────────────────────────
  if (screen === 'leaderboard') {
    const lbGame   = GAMES.find(g => g.id === lbTab) || GAMES[0];
    const entries  = leaderboard[lbTab] || [];
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" />
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
          <View style={s.lbHeader}>
            <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}>
              <Text style={s.backBtnText}>← RETOUR</Text>
            </TouchableOpacity>
            <Text style={s.lbTitle}>🏆 CLASSEMENT</Text>
            <View style={{ width: 70 }} />
          </View>
          <View style={s.profileCard}>
            <View style={s.profileLeft}>
              <Text style={s.profileAvatar}>🧑</Text>
              <View>
                <Text style={s.profileName}>{pseudo}</Text>
                <Text style={s.profileSub}>{globalStats.totalGames} parties jouées</Text>
              </View>
            </View>
            <View style={s.profileStats}>
              <View style={s.profileStat}>
                <Text style={[s.profileStatN, { color: '#00ff9f' }]}>{globalStats.wins}</Text>
                <Text style={s.profileStatL}>Victoires</Text>
              </View>
              <View style={s.profileStat}>
                <Text style={[s.profileStatN, { color: '#ffd600' }]}>{winRate}%</Text>
                <Text style={s.profileStatL}>Win rate</Text>
              </View>
              <View style={s.profileStat}>
                <Text style={[s.profileStatN, { color: '#bf00ff' }]}>{globalStats.bestStreak}</Text>
                <Text style={s.profileStatL}>Best streak</Text>
              </View>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.lbTabs} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
            {GAMES.map(g => (
              <TouchableOpacity key={g.id} style={[s.lbTab, lbTab === g.id && { borderColor: g.color, backgroundColor: g.color + '18' }]}
                onPress={() => setLbTab(g.id)} activeOpacity={0.7}>
                <Text style={{ fontSize: 16 }}>{g.icon}</Text>
                <Text style={[s.lbTabText, lbTab === g.id && { color: g.color }]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {entries.length === 0 ? (
              <View style={s.lbEmpty}>
                <Text style={{ fontSize: 36, marginBottom: 10 }}>🎯</Text>
                <Text style={s.lbEmptyText}>Pas encore de score</Text>
                <Text style={[s.lbEmptyText, { color: '#333355', fontSize: 11, marginTop: 4 }]}>Lance une partie pour apparaître !</Text>
              </View>
            ) : entries.map((entry, i) => (
              <View key={i} style={[s.lbEntry, entry.name === pseudo && { borderColor: lbGame.color + '55', backgroundColor: lbGame.color + '0a' }]}>
                <Text style={[s.lbRank, i < 3 && { color: ['#ffd600', '#aaaaaa', '#cd7f32'][i] }]}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </Text>
                <Text style={[s.lbName, entry.name === pseudo && { color: lbGame.color }]}>
                  {entry.name}{entry.name === pseudo ? ' (toi)' : ''}
                </Text>
                <View style={{ flex: 1 }} />
                <Text style={[s.lbScore, { color: lbGame.color }]}>{entry.score}</Text>
                <Text style={s.lbDate}>{entry.date}</Text>
              </View>
            ))}
            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  // ─── HOME ─────────────────────────────────────────────────────────────────────
  if (screen === 'home') return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={s.homeWrap} showsVerticalScrollIndicator={false}>
        <View style={s.homeTopBar}>
          <View style={s.playerPill}>
            <Text style={{ fontSize: 18 }}>🧑</Text>
            <View>
              <Text style={s.playerPillName}>{pseudo}</Text>
              <Text style={s.playerPillSub}>{globalStats.wins}W · {globalStats.losses}L</Text>
            </View>
          </View>
          <TouchableOpacity style={s.lbBtn} onPress={() => setScreen('leaderboard')} activeOpacity={0.8}>
            <Text style={s.lbBtnText}>🏆 SCORES</Text>
          </TouchableOpacity>
        </View>
        <View style={s.logoBlock}>
          <Text style={s.logoIcon}>⚔️</Text>
          <Text style={s.logoTitle}>BRAIN WARS</Text>
          <Text style={s.logoSub}>BATAILLE MENTALE</Text>
        </View>
        <Text style={s.chooseLabel}>CHOISIS TON ARÈNE</Text>
        <View style={s.gameGrid}>
          {GAMES.map(g => (
            <TouchableOpacity key={g.id} style={[s.gameCard, { borderColor: g.color }]} onPress={() => startGame(g.id)} activeOpacity={0.75}>
              <Text style={s.gameIcon}>{g.icon}</Text>
              <Text style={[s.gameLabel, { color: g.color }]}>{g.label}</Text>
              <Text style={s.gameDesc}>{g.desc}</Text>
              {highScores[g.id] > 0 && (
                <View style={[s.hsBadge, { borderColor: g.color + '88' }]}>
                  <Text style={[s.hsText, { color: g.color }]}>🏆 {highScores[g.id]}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );

  // ─── COUNTDOWN ────────────────────────────────────────────────────────────────
  if (screen === 'countdown') return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" />
      <View style={s.container}>
        <Text style={[s.cdGame, { color: game.color }]}>{game.icon}  {game.label}</Text>
        <View style={s.versusRow}>
          <View style={s.playerCard}>
            <Text style={s.playerAvatar}>🧑</Text>
            <Text style={[s.playerName, { color: '#00f5ff' }]}>{pseudo}</Text>
          </View>
          <Text style={s.vsText}>VS</Text>
          <View style={s.playerCard}>
            <Text style={s.playerAvatar}>{bot.avatar}</Text>
            <Text style={[s.playerName, { color: '#ff006e' }]}>{bot.name}</Text>
          </View>
        </View>
        <Animated.Text style={[s.cdNum, { color: game.color, transform: [{ scale: cdAnim }] }]}>
          {countdown === 0 ? 'GO!' : countdown}
        </Animated.Text>
      </View>
    </SafeAreaView>
  );

  // ─── RESULT ───────────────────────────────────────────────────────────────────
  if (screen === 'result') return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.resultEmoji}>{won ? '🏆' : '💀'}</Text>
        <Text style={[s.resultVerdict, { color: won ? '#00ff9f' : '#ff006e' }]}>{won ? 'VICTOIRE !' : 'DÉFAITE'}</Text>
        <View style={s.scoreDuel}>
          <View style={s.scoreSide}>
            <Text style={s.scoreAvatar}>🧑</Text>
            <Text style={[s.scorePts, { color: won ? '#00ff9f' : '#e8e8ff' }]}>{score}</Text>
            <Text style={s.scoreName}>{pseudo}</Text>
          </View>
          <Text style={s.scoreDash}>–</Text>
          <View style={s.scoreSide}>
            <Text style={s.scoreAvatar}>{bot.avatar}</Text>
            <Text style={[s.scorePts, { color: !won ? '#ff006e' : '#e8e8ff' }]}>{botScore}</Text>
            <Text style={s.scoreName}>{bot.name}</Text>
          </View>
        </View>
        <Text style={s.resultStars}>{stars()}</Text>
        <View style={s.statRow}>
          <View style={s.stat}><Text style={[s.statN, { color: '#00ff9f' }]}>{correctCount}/{ROUNDS}</Text><Text style={s.statL}>Correctes</Text></View>
          <View style={s.statDiv} />
          <View style={s.stat}><Text style={[s.statN, { color: '#ffd600' }]}>{bestStreak}</Text><Text style={s.statL}>Série max</Text></View>
          <View style={s.statDiv} />
          <View style={s.stat}><Text style={[s.statN, { color: game.color }]}>Niv.{level}</Text><Text style={s.statL}>Atteint</Text></View>
        </View>
        <TouchableOpacity style={[s.btn, { borderColor: game.color }]} onPress={() => startGame(gameType)} activeOpacity={0.8}>
          <Text style={[s.btnText, { color: game.color }]}>↩  REVANCHE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, { borderColor: '#00f5ff', marginTop: 8 }]} onPress={() => setScreen('leaderboard')} activeOpacity={0.8}>
          <Text style={[s.btnText, { color: '#00f5ff' }]}>🏆 VOIR LE CLASSEMENT</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, { borderColor: '#2a2a3a', marginTop: 8 }]} onPress={() => setScreen('home')} activeOpacity={0.8}>
          <Text style={[s.btnText, { color: '#555577' }]}>CHANGER D'ARÈNE</Text>
        </TouchableOpacity>
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );

  // ─── GAME ─────────────────────────────────────────────────────────────────────
  return (
    <Animated.View style={{ flex: 1, backgroundColor: flashBg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        <Animated.View style={[s.gameWrap, { transform: [{ translateX: shakeAnim }, { scale: scaleAnim }] }]}>
          <View style={s.hpRow}>
            <View style={s.hpBlock}>
              <Text style={s.hpLabel}>🧑 {pseudo}</Text>
              <View style={s.hpBar}><View style={[s.hpFill, { width: `${playerPct}%`, backgroundColor: '#00ff9f' }]} /></View>
              <Text style={[s.hpPts, { color: '#00ff9f' }]}>{score}</Text>
            </View>
            <View style={s.hpDivider}><Text style={s.hpVS}>VS</Text></View>
            <View style={[s.hpBlock, { alignItems: 'flex-end' }]}>
              <Text style={s.hpLabel}>{bot.avatar} {bot.name}</Text>
              <View style={s.hpBar}><View style={[s.hpFill, { width: `${botPct}%`, backgroundColor: '#ff006e', alignSelf: 'flex-end' }]} /></View>
              <Text style={[s.hpPts, { color: '#ff006e' }]}>{botScore}</Text>
            </View>
          </View>
          <View style={s.header}>
            <View style={s.badge}><Text style={s.badgeText}>{round + 1}/{ROUNDS}</Text></View>
            <Text style={[s.gameTag, { color: game.color }]}>{game.icon} {game.label}</Text>
            <View style={s.badge}><Text style={s.badgeText}>{streak > 1 ? `🔥 x${streak}` : `⏱ ${timeLeft}s`}</Text></View>
          </View>
          <View style={s.timerBar}><View style={[s.timerFill, { width: `${timerPct}%`, backgroundColor: timerColor }]} /></View>

          {question && gameType === 'math' && (
            <><View style={s.qCard}><Text style={[s.qText, { color: game.color }]}>{question.question}</Text></View>
            <View style={s.choicesGrid}>{question.choices.map((c, i) => (
              <TouchableOpacity key={i} style={[s.choice, feedback && c === question.answer && s.choiceCorrect, feedback && c !== question.answer && s.choiceWrong]}
                disabled={!!feedback} onPress={() => handleAnswer(c)} activeOpacity={0.7}>
                <Text style={s.choiceText}>{c}</Text>
              </TouchableOpacity>
            ))}</View></>
          )}

          {question && gameType === 'reflex' && (
            <><View style={s.qCard}>
              <Text style={s.qSmall}>Clique sur</Text>
              <Text style={s.qTextBig}>{question.target.emoji}</Text>
              <Text style={[s.qSmall, { color: game.color, fontSize: 14 }]}>{question.target.name}</Text>
            </View>
            <View style={s.colorGrid}>{question.grid.map((c, i) => (
              <TouchableOpacity key={i} style={s.colorCell} disabled={!!feedback} onPress={() => handleAnswer(c)} activeOpacity={0.7}>
                <Text style={s.colorEmoji}>{c.emoji}</Text>
              </TouchableOpacity>
            ))}</View></>
          )}

          {question && gameType === 'memory' && (
            <><View style={s.qCard}>
              {showSeq ? (
                <><Text style={s.qSmall}>Mémorise !</Text>
                <View style={s.seqRow}>{question.sequence.map((n, i) => (
                  <View key={i} style={[s.seqNum, { borderColor: game.color }]}>
                    <Text style={[s.seqText, { color: game.color }]}>{n}</Text>
                  </View>
                ))}</View></>
              ) : (
                <><Text style={s.qSmall}>Reproduis !</Text>
                <View style={s.seqRow}>{question.sequence.map((_, i) => (
                  <View key={i} style={[s.seqDot, i < memInput.length && { backgroundColor: game.color, borderColor: game.color }]} />
                ))}</View>
                <Text style={[s.memCount, { color: game.color }]}>{memInput.length}/{question.sequence.length}</Text></>
              )}
            </View>
            {!showSeq && <View style={s.numGrid}>{[1,2,3,4,5,6,7,8,9].map(n => (
              <TouchableOpacity key={n} style={[s.numBtn, { borderColor: game.color }]} disabled={!!feedback}
                onPress={() => { const next = [...memInput, n]; setMemInput(next); if (next.length === question.sequence.length) handleAnswer(next); }}
                activeOpacity={0.7}>
                <Text style={[s.numText, { color: game.color }]}>{n}</Text>
              </TouchableOpacity>
            ))}</View>}</>
          )}

          {question && gameType === 'stroop' && (
            <><View style={s.qCard}>
              <Text style={s.qSmall}>Quelle est la COULEUR de ce mot ?</Text>
              <Text style={[s.stroopWord, { color: question.color }]}>{question.word}</Text>
            </View>
            <View style={s.choicesGrid}>{question.choices.map((c, i) => {
              const col = STROOP_COLORS.find(x => x.label === c);
              return (<TouchableOpacity key={i}
                style={[s.choice, { borderColor: col?.color + '55' }, feedback && c === question.answer && s.choiceCorrect, feedback && c !== question.answer && s.choiceWrong]}
                disabled={!!feedback} onPress={() => handleAnswer(c)} activeOpacity={0.7}>
                <Text style={[s.choiceText, { color: col?.color }]}>{c}</Text>
              </TouchableOpacity>);
            })}</View></>
          )}

          {question && gameType === 'logic' && (
            <><View style={s.qCard}>
              <Text style={s.qSmall}>Quelle est la suite ?</Text>
              <Text style={[s.qText, { color: game.color, fontSize: 26 }]}>{question.hint}</Text>
            </View>
            <View style={s.choicesGrid}>{question.choices.map((c, i) => (
              <TouchableOpacity key={i} style={[s.choice, feedback && c === question.answer && s.choiceCorrect, feedback && c !== question.answer && s.choiceWrong]}
                disabled={!!feedback} onPress={() => handleAnswer(c)} activeOpacity={0.7}>
                <Text style={s.choiceText}>{c}</Text>
              </TouchableOpacity>
            ))}</View></>
          )}

          {question && gameType === 'capital' && (
            <><View style={s.qCard}>
              <Text style={s.qSmall}>Capitale de</Text>
              <Text style={[s.qText, { color: game.color, fontSize: 24 }]}>{question.country}</Text>
            </View>
            <View style={s.choicesGrid}>{question.choices.map((c, i) => (
              <TouchableOpacity key={i} style={[s.choice, feedback && c === question.answer && s.choiceCorrect, feedback && c !== question.answer && s.choiceWrong]}
                disabled={!!feedback} onPress={() => handleAnswer(c)} activeOpacity={0.7}>
                <Text style={[s.choiceText, { fontSize: 15 }]}>{c}</Text>
              </TouchableOpacity>
            ))}</View></>
          )}

          {feedback && (
            <Text style={[s.feedback, { color: feedback === 'correct' ? '#00ff9f' : '#ff006e' }]}>
              {feedback === 'correct' ? (streak > 1 ? `🔥 COMBO x${streak}!` : '✓ CORRECT!') : '✗ RATÉ!'}
            </Text>
          )}
        </Animated.View>
      </SafeAreaView>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#0a0a0f' },
  container:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  gameWrap:     { flex: 1, padding: 16, paddingTop: 10 },
  homeWrap:     { alignItems: 'center', paddingTop: 20, paddingHorizontal: 14 },
  homeTopBar:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 20 },
  playerPill:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#12121a', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  playerPillName:{ color: '#e8e8ff', fontSize: 13, fontWeight: '700' },
  playerPillSub: { color: '#555577', fontSize: 9, letterSpacing: 1, marginTop: 1 },
  lbBtn:        { backgroundColor: '#12121a', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#ffd60044' },
  lbBtnText:    { color: '#ffd600', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  logoBlock:    { alignItems: 'center', marginBottom: 24 },
  logoIcon:     { fontSize: 38, marginBottom: 6 },
  logoTitle:    { fontSize: 36, fontWeight: '900', color: '#00f5ff', letterSpacing: 5 },
  logoSub:      { fontSize: 10, color: '#555577', letterSpacing: 6, marginTop: 5 },
  chooseLabel:  { fontSize: 10, color: '#333355', letterSpacing: 5, marginBottom: 14 },
  gameGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  gameCard:     { width: W / 2 - 22, paddingVertical: 16, paddingHorizontal: 10, borderWidth: 2, borderRadius: 18, alignItems: 'center', backgroundColor: '#12121a' },
  gameIcon:     { fontSize: 28, marginBottom: 6 },
  gameLabel:    { fontSize: 11, fontWeight: '700', letterSpacing: 3 },
  gameDesc:     { fontSize: 10, color: '#555577', textAlign: 'center', marginTop: 3 },
  hsBadge:      { marginTop: 7, borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  hsText:       { fontSize: 10, fontWeight: '700' },
  pseudoBox:    { width: '80%', borderWidth: 2, borderColor: '#00f5ff44', borderRadius: 14, backgroundColor: '#12121a', paddingHorizontal: 16 },
  pseudoInput:  { color: '#e8e8ff', fontSize: 22, fontWeight: '700', paddingVertical: 16, textAlign: 'center', letterSpacing: 2 },
  pseudoHint:   { color: '#333355', fontSize: 10, marginTop: 12, letterSpacing: 2 },
  lbHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  backBtn:      { paddingVertical: 6, paddingHorizontal: 2 },
  backBtnText:  { color: '#555577', fontSize: 10, letterSpacing: 2, fontWeight: '700' },
  lbTitle:      { fontSize: 16, fontWeight: '900', color: '#ffd600', letterSpacing: 3 },
  profileCard:  { backgroundColor: '#12121a', borderRadius: 16, padding: 14, marginBottom: 14 },
  profileLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  profileAvatar:{ fontSize: 36 },
  profileName:  { color: '#e8e8ff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  profileSub:   { color: '#555577', fontSize: 10, marginTop: 2, letterSpacing: 1 },
  profileStats: { flexDirection: 'row', justifyContent: 'space-around' },
  profileStat:  { alignItems: 'center' },
  profileStatN: { fontSize: 20, fontWeight: '900' },
  profileStatL: { color: '#555577', fontSize: 9, marginTop: 2, letterSpacing: 1 },
  lbTabs:       { marginBottom: 12, flexGrow: 0 },
  lbTab:        { borderWidth: 1.5, borderColor: '#1e1e2e', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', flexDirection: 'row', gap: 6, backgroundColor: '#12121a' },
  lbTabText:    { color: '#555577', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  lbEntry:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#12121a', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#1e1e2e', gap: 10 },
  lbRank:       { fontSize: 16, fontWeight: '900', color: '#555577', width: 28 },
  lbName:       { fontSize: 14, fontWeight: '700', color: '#e8e8ff' },
  lbScore:      { fontSize: 16, fontWeight: '900' },
  lbDate:       { fontSize: 9, color: '#333355', marginLeft: 6 },
  lbEmpty:      { alignItems: 'center', paddingTop: 60 },
  lbEmptyText:  { color: '#555577', fontSize: 13, letterSpacing: 1 },
  cdGame:       { fontSize: 14, letterSpacing: 4, fontWeight: '700', marginBottom: 28 },
  versusRow:    { flexDirection: 'row', alignItems: 'center', gap: 24, marginBottom: 32 },
  playerCard:   { alignItems: 'center' },
  playerAvatar: { fontSize: 42 },
  playerName:   { fontSize: 11, fontWeight: '700', letterSpacing: 2, marginTop: 6 },
  vsText:       { fontSize: 24, fontWeight: '900', color: '#333355' },
  cdNum:        { fontSize: 100, fontWeight: '900', lineHeight: 110 },
  hpRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 2 },
  hpBlock:      { flex: 1 },
  hpLabel:      { fontSize: 9, color: '#555577', letterSpacing: 1, marginBottom: 3 },
  hpBar:        { height: 5, backgroundColor: '#1e1e2e', borderRadius: 3, overflow: 'hidden' },
  hpFill:       { height: '100%', borderRadius: 3 },
  hpPts:        { fontSize: 11, fontWeight: '700', marginTop: 2 },
  hpDivider:    { width: 26, alignItems: 'center' },
  hpVS:         { fontSize: 9, color: '#333355', fontWeight: '700' },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge:        { backgroundColor: '#12121a', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, minWidth: 58, alignItems: 'center' },
  badgeText:    { color: '#e8e8ff', fontSize: 12, fontWeight: '600' },
  gameTag:      { fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  timerBar:     { height: 4, backgroundColor: '#1e1e2e', borderRadius: 2, overflow: 'hidden', marginBottom: 14 },
  timerFill:    { height: '100%', borderRadius: 2 },
  qCard:        { backgroundColor: '#12121a', borderRadius: 20, padding: 22, alignItems: 'center', marginBottom: 14 },
  qSmall:       { fontSize: 11, color: '#555577', letterSpacing: 2, marginBottom: 6 },
  qText:        { fontSize: 38, fontWeight: '900', textAlign: 'center' },
  qTextBig:     { fontSize: 58 },
  choicesGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choice:       { width: '47%', backgroundColor: '#12121a', borderWidth: 2, borderColor: '#1e1e2e', borderRadius: 14, padding: 18, alignItems: 'center' },
  choiceCorrect:{ borderColor: '#00ff9f', backgroundColor: '#00ff9f12' },
  choiceWrong:  { borderColor: '#1e1e2e', opacity: 0.3 },
  choiceText:   { fontSize: 22, fontWeight: '900', color: '#e8e8ff' },
  colorGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorCell:    { width: W / 4 - 14, aspectRatio: 1, backgroundColor: '#12121a', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  colorEmoji:   { fontSize: 30 },
  seqRow:       { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' },
  seqNum:       { backgroundColor: '#1e1e2e', borderWidth: 2, borderRadius: 10, padding: 10 },
  seqText:      { fontSize: 20, fontWeight: '700' },
  seqDot:       { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#333355' },
  memCount:     { fontSize: 11, marginTop: 10, letterSpacing: 2 },
  numGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 6 },
  numBtn:       { width: W / 4 - 12, height: 52, backgroundColor: '#12121a', borderWidth: 2, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  numText:      { fontSize: 22, fontWeight: '700' },
  stroopWord:   { fontSize: 50, fontWeight: '900', marginVertical: 8, letterSpacing: 4 },
  feedback:     { textAlign: 'center', marginTop: 12, fontSize: 18, fontWeight: '900', letterSpacing: 3 },
  resultEmoji:  { fontSize: 52, marginBottom: 8 },
  resultVerdict:{ fontSize: 30, fontWeight: '900', marginBottom: 20 },
  scoreDuel:    { flexDirection: 'row', alignItems: 'center', gap: 24, marginBottom: 14 },
  scoreSide:    { alignItems: 'center' },
  scoreAvatar:  { fontSize: 36, marginBottom: 6 },
  scorePts:     { fontSize: 44, fontWeight: '900' },
  scoreName:    { fontSize: 10, color: '#555577', letterSpacing: 2, marginTop: 2 },
  scoreDash:    { fontSize: 22, color: '#333355' },
  resultStars:  { fontSize: 30, marginBottom: 18 },
  statRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 10, backgroundColor: '#12121a', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18, width: '100%' },
  stat:         { flex: 1, alignItems: 'center' },
  statN:        { fontSize: 20, fontWeight: '900' },
  statL:        { fontSize: 9, color: '#555577', marginTop: 3, letterSpacing: 1 },
  statDiv:      { width: 1, height: 30, backgroundColor: '#1e1e2e' },
  btn:          { borderWidth: 2, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, width: '85%', alignItems: 'center' },
  btnText:      { fontSize: 12, fontWeight: '700', letterSpacing: 4 },
});
