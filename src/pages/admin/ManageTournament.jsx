import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';

// קומפוננטה לבחירת מנצחים בתיקו
function TiebreakerSelection({ tiebreakers, onResolve }) {
  const [selectedPlayers, setSelectedPlayers] = useState({});

  const togglePlayer = (tiebreakerIndex, playerId) => {
    setSelectedPlayers(prev => {
      const key = `tie_${tiebreakerIndex}`;
      const current = prev[key] || [];
      const tiebreaker = tiebreakers[tiebreakerIndex];
      
      if (current.includes(playerId)) {
        // הסר את השחקן
        return {
          ...prev,
          [key]: current.filter(id => id !== playerId)
        };
      } else {
        // הוסף את השחקן אם לא הגענו למקסימום
        if (current.length < tiebreaker.numToQualify) {
          return {
            ...prev,
            [key]: [...current, playerId]
          };
        }
        return prev;
      }
    });
  };

  return (
    <div>
      {tiebreakers.map((tiebreaker, index) => {
        if (tiebreaker.resolved) return null;
        
        const key = `tie_${index}`;
        const selected = selectedPlayers[key] || [];
        const numPlayers = tiebreaker.players.length;

        return (
          <div key={index} style={{
            background: '#d1ecf1',
            border: '3px solid #17a2b8',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <h3 style={{ fontSize: '20px', color: '#0c5460', marginBottom: '15px', textAlign: 'center' }}>
              ⚠️ יש תיקו! יש לבחור מי עולה לשלב הנוקאאוט
            </h3>
            
            <div style={{ 
              background: 'white', 
              padding: '15px', 
              borderRadius: '8px', 
              marginBottom: '15px',
              textAlign: 'center'
            }}>
              <p style={{ margin: '5px 0', fontSize: '16px' }}>
                <strong>סטטיסטיקות זהות:</strong> הפרש {tiebreaker.diff > 0 ? '+' : ''}{tiebreaker.diff}, 
                סה"כ נקודות: {tiebreaker.totalPoints}
              </p>
              <p style={{ margin: '5px 0', fontSize: '16px', color: '#17a2b8', fontWeight: 'bold' }}>
                יש לבחור {tiebreaker.numToQualify} מתוך {numPlayers} שחקנים
              </p>
              {numPlayers === 2 && (
                <p style={{ margin: '5px 0', fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
                  💡 מומלץ לשחק משחק אחד מכריע בין השניים
                </p>
              )}
              {numPlayers > 2 && (
                <p style={{ margin: '5px 0', fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
                  💡 מומלץ לשחק מיני ליגה (משחק אחד בין כל שחקן לשחקן)
                </p>
              )}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              marginBottom: '15px'
            }}>
              {tiebreaker.players.map(player => {
                const isSelected = selected.includes(player.id);
                
                return (
                  <button
                    key={player.id}
                    onClick={() => togglePlayer(index, player.id)}
                    style={{
                      padding: '15px',
                      background: isSelected ? '#28a745' : 'white',
                      color: isSelected ? 'white' : '#333',
                      border: `3px solid ${isSelected ? '#28a745' : '#dee2e6'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                  >
                    {isSelected && <span style={{ marginLeft: '8px' }}>✓</span>}
                    {player.name}
                  </button>
                );
              })}
            </div>

            <div style={{ textAlign: 'center' }}>
              <p style={{ 
                margin: '10px 0', 
                fontSize: '14px', 
                color: selected.length === tiebreaker.numToQualify ? '#28a745' : '#666'
              }}>
                נבחרו: {selected.length} / {tiebreaker.numToQualify}
              </p>
              
              <button
                onClick={() => onResolve(index, selected)}
                disabled={selected.length !== tiebreaker.numToQualify}
                style={{
                  padding: '12px 30px',
                  background: selected.length === tiebreaker.numToQualify ? '#28a745' : '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: selected.length === tiebreaker.numToQualify ? 'pointer' : 'not-allowed',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  opacity: selected.length === tiebreaker.numToQualify ? 1 : 0.6
                }}
              >
                ✓ אשר בחירה
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ManageTournament() {
  const [tournament, setTournament] = useState(null);
  const [players, setPlayers] = useState([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewGroups, setPreviewGroups] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'tournament', 'current'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setTournament(data);
        setPlayers(data.players || []);
      } else {
        setTournament(null);
        setPlayers([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const addPlayer = async () => {
    if (!newPlayerName.trim()) {
      alert('אנא הכנס שם שחקן');
      return;
    }

    // בדיקה אם יש מספר שורות (הדבקה מאקסל)
    const lines = newPlayerName.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length > 1) {
      // הדבקה של מספר שמות
      const availableSlots = 30 - players.length;
      
      if (lines.length > availableSlots) {
        alert(`ניתן להוסיף רק ${availableSlots} שחקנים נוספים`);
        return;
      }

      // סינון שמות כפולים
      const newNames = lines.filter(name => !players.find(p => p.name === name));
      
      if (newNames.length === 0) {
        alert('כל השמות כבר קיימים במערכת');
        setNewPlayerName('');
        return;
      }

      if (newNames.length < lines.length) {
        const skipped = lines.length - newNames.length;
        alert(`${skipped} שמות דומים דולגו כי הם כבר קיימים`);
      }

      const newPlayers = [
        ...players, 
        ...newNames.map((name, idx) => ({ 
          id: Date.now() + idx, 
          name: name 
        }))
      ];
      
      setPlayers(newPlayers);
      setNewPlayerName('');

      await setDoc(doc(db, 'tournament', 'current'), {
        players: newPlayers,
        status: 'setup'
      }, { merge: true });

      alert(`נוספו ${newNames.length} שחקנים בהצלחה!`);
    } else {
      // הוספת שחקן בודד
      if (players.length >= 30) {
        alert('הגעת למקסימום של 30 שחקנים');
        return;
      }

      if (players.find(p => p.name === newPlayerName.trim())) {
        alert('שחקן זה כבר קיים');
        return;
      }

      const newPlayers = [...players, { id: Date.now(), name: newPlayerName.trim() }];
      setPlayers(newPlayers);
      setNewPlayerName('');

      await setDoc(doc(db, 'tournament', 'current'), {
        players: newPlayers,
        status: 'setup'
      }, { merge: true });
    }
  };

  const removePlayer = async (id) => {
    const newPlayers = players.filter(p => p.id !== id);
    setPlayers(newPlayers);
    setPreviewGroups([]); // איפוס תצוגת בתים

    await setDoc(doc(db, 'tournament', 'current'), {
      players: newPlayers,
      status: 'setup'
    }, { merge: true });
  };

  const generateRandomGroups = (manualNumGroups = null) => {
    const numPlayers = players.length;

    if (numPlayers < 20 || numPlayers > 30) {
      alert('דרושים בין 20 ל-30 שחקנים');
      return;
    }

    // ערבוב שחקנים
    const shuffled = [...players].sort(() => Math.random() - 0.5);

    // קביעת מספר הבתים - ברירת מחדל או ידני
    let numGroups;
    if (manualNumGroups) {
      numGroups = manualNumGroups;
    } else {
      // ברירת מחדל חכמה
      if (numPlayers >= 20 && numPlayers <= 23) {
        numGroups = 5;
      } else {
        numGroups = 6;
      }
    }

    // חלוקה גמישה של שחקנים לבתים
    const baseSize = Math.floor(numPlayers / numGroups);
    const remainder = numPlayers % numGroups;
    
    const playersPerGroup = [];
    for (let i = 0; i < numGroups; i++) {
      // הבתים הראשונים מקבלים שחקן נוסף אם יש שארית
      playersPerGroup.push(i < remainder ? baseSize + 1 : baseSize);
    }

    // יצירת הבתים
    const groups = [];
    let playerIndex = 0;

    for (let i = 0; i < numGroups; i++) {
      const groupSize = playersPerGroup[i];
      const groupPlayers = shuffled.slice(playerIndex, playerIndex + groupSize);
      playerIndex += groupSize;

      groups.push({
        id: i + 1,
        name: `בית ${i + 1}`,
        players: groupPlayers
      });
    }

    setPreviewGroups(groups);
  };

  const addGroup = () => {
    if (previewGroups.length >= 6) {
      alert('מקסימום 6 בתים');
      return;
    }

    const allPlayers = [];
    previewGroups.forEach(g => allPlayers.push(...g.players));

    const newNumGroups = previewGroups.length + 1;
    const baseSize = Math.floor(allPlayers.length / newNumGroups);
    const remainder = allPlayers.length % newNumGroups;

    const newGroups = [];
    let playerIndex = 0;

    for (let i = 0; i < newNumGroups; i++) {
      const groupSize = i < remainder ? baseSize + 1 : baseSize;
      const groupPlayers = allPlayers.slice(playerIndex, playerIndex + groupSize);
      playerIndex += groupSize;

      newGroups.push({
        id: i + 1,
        name: `בית ${i + 1}`,
        players: groupPlayers
      });
    }

    setPreviewGroups(newGroups);
  };

  const removeGroup = () => {
    if (previewGroups.length <= 4) {
      alert('מינימום 4 בתים');
      return;
    }

    const allPlayers = [];
    previewGroups.forEach(g => allPlayers.push(...g.players));

    const newNumGroups = previewGroups.length - 1;
    const baseSize = Math.floor(allPlayers.length / newNumGroups);
    const remainder = allPlayers.length % newNumGroups;

    const newGroups = [];
    let playerIndex = 0;

    for (let i = 0; i < newNumGroups; i++) {
      const groupSize = i < remainder ? baseSize + 1 : baseSize;
      const groupPlayers = allPlayers.slice(playerIndex, playerIndex + groupSize);
      playerIndex += groupSize;

      newGroups.push({
        id: i + 1,
        name: `בית ${i + 1}`,
        players: groupPlayers
      });
    }

    setPreviewGroups(newGroups);
  };

  const movePlayerToGroup = (playerId, fromGroupId, toGroupId) => {
    if (fromGroupId === toGroupId) return;

    const newGroups = [...previewGroups];
    const fromGroup = newGroups.find(g => g.id === fromGroupId);
    const toGroup = newGroups.find(g => g.id === toGroupId);

    const playerIndex = fromGroup.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return;

    const player = fromGroup.players[playerIndex];
    fromGroup.players.splice(playerIndex, 1);
    toGroup.players.push(player);

    setPreviewGroups(newGroups);
  };

  const startTournament = async () => {
    if (previewGroups.length === 0) {
      alert('יש ליצור חלוקה לבתים לפני תחילת הטורניר');
      return;
    }

    setLoading(true);

    try {
      // יצירת משחקים לכל בית
      const groups = previewGroups.map(group => {
        const matches = [];
        for (let j = 0; j < group.players.length; j++) {
          for (let k = j + 1; k < group.players.length; k++) {
            matches.push({
              id: Date.now() + group.id * 10000 + j * 100 + k + Math.random() * 100,
              player1: group.players[j],
              player2: group.players[k],
              score1: 0,
              score2: 0,
              completed: false
            });
          }
        }

        return {
          ...group,
          matches: matches
        };
      });

      await setDoc(doc(db, 'tournament', 'current'), {
        players: players,
        groups: groups,
        status: 'groups'
      });

      setPreviewGroups([]);
      alert('הטורניר התחיל! 🎉');
    } catch (error) {
      console.error('Error starting tournament:', error);
      alert('שגיאה בהתחלת הטורניר');
    } finally {
      setLoading(false);
    }
  };

  const updateScore = async (groupId, matchId, score1, score2) => {
    const groups = [...tournament.groups];
    const group = groups.find(g => g.id === groupId);
    const match = group.matches.find(m => m.id === matchId);

    match.score1 = parseInt(score1) || 0;
    match.score2 = parseInt(score2) || 0;
    match.completed = match.score1 > 0 || match.score2 > 0;

    await updateDoc(doc(db, 'tournament', 'current'), {
      groups: groups
    });
  };

  const calculateStandings = (group) => {
    const standings = group.players.map(player => ({
      player: player,
      totalPoints: 0,
      diff: 0,
      played: 0,
      matchResults: []
    }));

    group.matches.forEach(match => {
      if (!match.completed) return;

      const p1 = standings.find(s => s.player.id === match.player1.id);
      const p2 = standings.find(s => s.player.id === match.player2.id);

      p1.played++;
      p2.played++;

      p1.totalPoints += match.score1;
      p2.totalPoints += match.score2;
      
      const p1Diff = match.score1 - match.score2;
      const p2Diff = match.score2 - match.score1;
      
      p1.diff += p1Diff;
      p2.diff += p2Diff;
      
      p1.matchResults.push({ diff: p1Diff, points: match.score1 });
      p2.matchResults.push({ diff: p2Diff, points: match.score2 });
    });

    standings.sort((a, b) => {
      if (b.diff !== a.diff) return b.diff - a.diff;
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return 0;
    });

    return standings;
  };

  const calculateSecondPlaceStatsForComparison = (player, group) => {
    if (group.players.length === 5) {
      const standings = calculateStandings(group);
      const playerStanding = standings.find(s => s.player.id === player.id);
      
      if (!playerStanding || playerStanding.matchResults.length < 3) {
        return { diff: playerStanding.diff, totalPoints: playerStanding.totalPoints };
      }
      
      const sortedMatches = [...playerStanding.matchResults].sort((a, b) => b.diff - a.diff);
      const best3Matches = sortedMatches.slice(0, 3);
      
      const best3Diff = best3Matches.reduce((sum, match) => sum + match.diff, 0);
      const best3Points = best3Matches.reduce((sum, match) => sum + match.points, 0);
      
      return { diff: best3Diff, totalPoints: best3Points };
    } else {
      const standings = calculateStandings(group);
      const playerStanding = standings.find(s => s.player.id === player.id);
      return { diff: playerStanding.diff, totalPoints: playerStanding.totalPoints };
    }
  };

  const resolveTiebreaker = async (tiebreakerIndex, selectedPlayerIds) => {
    const tiebreaker = tournament.tiebreakers[tiebreakerIndex];
    
    if (selectedPlayerIds.length !== tiebreaker.numToQualify) {
      alert(`יש לבחור בדיוק ${tiebreaker.numToQualify} שחקנים`);
      return;
    }

    // עדכון התיקו כפתור
    const updatedTiebreakers = [...tournament.tiebreakers];
    updatedTiebreakers[tiebreakerIndex] = {
      ...tiebreaker,
      resolved: true,
      selectedWinners: selectedPlayerIds
    };

    await updateDoc(doc(db, 'tournament', 'current'), {
      tiebreakers: updatedTiebreakers
    });

    // אם כל התיקויים נפתרו, התחל את הנוקאאוט
    if (updatedTiebreakers.every(tb => tb.resolved)) {
      await finalizeKnockoutStart();
    }
  };

  const finalizeKnockoutStart = async () => {
    setLoading(true);
    
    try {
      const firstPlaces = tournament.firstPlaces;
      let secondPlaces = [...tournament.secondPlaces];

      // אם היו תיקויים, סנן לפי השחקנים שנבחרו
      if (tournament.tiebreakers && tournament.tiebreakers.length > 0) {
        tournament.tiebreakers.forEach(tb => {
          if (tb.resolved) {
            // הסר שחקנים שלא נבחרו
            secondPlaces = secondPlaces.filter(sp => {
              const isInTie = tb.players.find(p => p.id === sp.player.id);
              if (isInTie) {
                return tb.selectedWinners.includes(sp.player.id);
              }
              return true;
            });
          }
        });
      }

      const numFirstPlaces = firstPlaces.length;
      const numSecondPlacesNeeded = 8 - numFirstPlaces;
      const bestSecondPlaces = secondPlaces.slice(0, numSecondPlacesNeeded);

      const rankedQualifiers = [
        ...firstPlaces.map((fp, idx) => ({ ...fp, overallRank: idx + 1 })),
        ...bestSecondPlaces.map((sp, idx) => ({ ...sp, overallRank: firstPlaces.length + idx + 1 }))
      ];

      const knockoutMatches = {
        quarterFinals: [],
        semiFinals: [],
        final: [],
        tiebreakers: []
      };

      const matchups = [
        [0, 7], [3, 4], [2, 5], [1, 6]
      ];

      matchups.forEach(([idx1, idx2], matchIdx) => {
        if (rankedQualifiers[idx1] && rankedQualifiers[idx2]) {
          knockoutMatches.quarterFinals.push({
            id: Date.now() + matchIdx,
            player1: rankedQualifiers[idx1].player,
            player2: rankedQualifiers[idx2].player,
            rank1: rankedQualifiers[idx1].overallRank,
            rank2: rankedQualifiers[idx2].overallRank,
            score1: 0,
            score2: 0,
            completed: false
          });
        }
      });

      for (let i = 0; i < 2; i++) {
        knockoutMatches.semiFinals.push({
          id: Date.now() + 1000 + i,
          player1: null,
          player2: null,
          score1: 0,
          score2: 0,
          completed: false
        });
      }

      knockoutMatches.final.push({
        id: Date.now() + 2000,
        player1: null,
        player2: null,
        score1: 0,
        score2: 0,
        completed: false
      });

      const qualifiers = rankedQualifiers.map(q => q.player);

      await updateDoc(doc(db, 'tournament', 'current'), {
        status: 'knockout',
        knockoutMatches: knockoutMatches,
        qualifiers: qualifiers,
        rankedQualifiers: rankedQualifiers,
        tiebreakers: null,
        firstPlaces: null,
        secondPlaces: null
      });

      alert('שלב הנוקאאוט התחיל! 🎉\n\nזיווגי רבע גמר:\n1 נגד 8\n4 נגד 5\n3 נגד 6\n2 נגד 7');
    } catch (error) {
      console.error('Error finalizing knockout:', error);
      alert('שגיאה בהתחלת שלב הנוקאאוט');
    } finally {
      setLoading(false);
    }
  };

  const startKnockout = async () => {
    setLoading(true);

    try {
      const firstPlaces = [];
      const secondPlaces = [];

      tournament.groups.forEach(group => {
        const standings = calculateStandings(group);
        
        if (standings[0]) {
          firstPlaces.push({
            player: standings[0].player,
            groupId: group.id,
            diff: standings[0].diff,
            totalPoints: standings[0].totalPoints,
            position: 1
          });
        }
        
        if (standings[1]) {
          // חישוב מיוחד למקום שני בבית של 5
          const stats = calculateSecondPlaceStatsForComparison(standings[1].player, group);
          
          secondPlaces.push({
            player: standings[1].player,
            groupId: group.id,
            diff: stats.diff,
            totalPoints: stats.totalPoints,
            position: 2
          });
        }
      });

      // דירוג המקומות הראשונים
      firstPlaces.sort((a, b) => {
        if (b.diff !== a.diff) return b.diff - a.diff;
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        return 0;
      });

      // דירוג המקומות השניים
      secondPlaces.sort((a, b) => {
        if (b.diff !== a.diff) return b.diff - a.diff;
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        return 0;
      });

      const numFirstPlaces = firstPlaces.length;
      const numSecondPlacesNeeded = 8 - numFirstPlaces;
      const bestSecondPlaces = secondPlaces.slice(0, numSecondPlacesNeeded);

      // בדיקת שוויון - זיהוי כל השחקנים בתיקו
      const tiebreakers = [];
      if (numSecondPlacesNeeded > 0 && numSecondPlacesNeeded < secondPlaces.length) {
        const cutoffIndex = numSecondPlacesNeeded - 1;
        const cutoffPlayer = secondPlaces[cutoffIndex];
        
        // מצא את כל השחקנים עם אותם מספרים כמו שחקן הגבול
        const tiedPlayers = secondPlaces.filter(p => 
          p.diff === cutoffPlayer.diff && 
          p.totalPoints === cutoffPlayer.totalPoints
        );
        
        // אם יש יותר מאשר מספר המקומות הפנויים - יש תיקו
        const numQualifyingFromTie = tiedPlayers.filter((p, idx) => 
          secondPlaces.indexOf(p) < numSecondPlacesNeeded
        ).length;
        const numNotQualifyingFromTie = tiedPlayers.length - numQualifyingFromTie;
        
        if (numNotQualifyingFromTie > 0) {
          tiebreakers.push({
            players: tiedPlayers.map(p => p.player),
            numToQualify: numQualifyingFromTie,
            diff: cutoffPlayer.diff,
            totalPoints: cutoffPlayer.totalPoints,
            resolved: false,
            selectedWinners: []
          });
        }
      }

      // יצירת רשימת 8 המעפילים עם דירוג
      // ראשונים בדירוג שלהם + שניים בדירוג שלהם
      const rankedQualifiers = [
        ...firstPlaces.map((fp, idx) => ({ ...fp, overallRank: idx + 1 })),
        ...bestSecondPlaces.map((sp, idx) => ({ ...sp, overallRank: firstPlaces.length + idx + 1 }))
      ];

      // זיווגים לרבע גמר לפי דירוג:
      // 1 נגד 8, 2 נגד 7, 3 נגד 6, 4 נגד 5
      // כך 1 ו-2 יפגשו רק בגמר, 3 ו-4 יפגשו רק בגמר
      const knockoutMatches = {
        quarterFinals: [],
        semiFinals: [],
        final: [],
        tiebreakers: tiebreakers
      };

      // יצירת זיווגי רבע גמר
      const matchups = [
        [0, 7], // 1 נגד 8
        [3, 4], // 4 נגד 5
        [2, 5], // 3 נגד 6
        [1, 6]  // 2 נגד 7
      ];

      matchups.forEach(([idx1, idx2], matchIdx) => {
        if (rankedQualifiers[idx1] && rankedQualifiers[idx2]) {
          knockoutMatches.quarterFinals.push({
            id: Date.now() + matchIdx,
            player1: rankedQualifiers[idx1].player,
            player2: rankedQualifiers[idx2].player,
            rank1: rankedQualifiers[idx1].overallRank,
            rank2: rankedQualifiers[idx2].overallRank,
            score1: 0,
            score2: 0,
            completed: false
          });
        }
      });

      // יצירת חצי גמר
      for (let i = 0; i < 2; i++) {
        knockoutMatches.semiFinals.push({
          id: Date.now() + 1000 + i,
          player1: null,
          player2: null,
          score1: 0,
          score2: 0,
          completed: false
        });
      }

      // יצירת גמר
      knockoutMatches.final.push({
        id: Date.now() + 2000,
        player1: null,
        player2: null,
        score1: 0,
        score2: 0,
        completed: false
      });

      const qualifiers = rankedQualifiers.map(q => q.player);

      // אם יש תיקו, לא מתחילים את הנוקאאוט - רק שומרים את הנתונים
      if (tiebreakers.length > 0) {
        await updateDoc(doc(db, 'tournament', 'current'), {
          status: 'groups', // נשאר בשלב הבתים
          knockoutMatches: knockoutMatches,
          qualifiers: qualifiers,
          rankedQualifiers: rankedQualifiers,
          tiebreakers: tiebreakers, // שמירת התיקו
          firstPlaces: firstPlaces,
          secondPlaces: secondPlaces
        });
        alert('יש תיקו! המנהל צריך לבחור מי עולה לשלב הנוקאאוט.');
      } else {
        // אין תיקו - מתחילים נוקאאוט רגיל
        await updateDoc(doc(db, 'tournament', 'current'), {
          status: 'knockout',
          knockoutMatches: knockoutMatches,
          qualifiers: qualifiers,
          rankedQualifiers: rankedQualifiers
        });
        alert('שלב הנוקאאוט התחיל! 🎉\n\nזיווגי רבע גמר:\n1 נגד 8\n4 נגד 5\n3 נגד 6\n2 נגד 7');
      }
    } catch (error) {
      console.error('Error starting knockout:', error);
      alert('שגיאה בהתחלת שלב הנוקאאוט');
    } finally {
      setLoading(false);
    }
  };

  const updateKnockoutScore = async (stage, matchId, score1, score2) => {
    const knockoutMatches = { ...tournament.knockoutMatches };
    const match = knockoutMatches[stage].find(m => m.id === matchId);

    match.score1 = parseInt(score1) || 0;
    match.score2 = parseInt(score2) || 0;
    match.completed = match.score1 > 0 || match.score2 > 0;

    if (match.completed) {
      const winner = match.score1 > match.score2 ? match.player1 : match.player2;

      if (stage === 'quarterFinals') {
        // מיפוי זיווגים לחצי גמר:
        // משחק 0 (1 נגד 8) → חצי גמר 0 (משחק 1)
        // משחק 1 (4 נגד 5) → חצי גמר 1 (משחק 2)
        // משחק 2 (3 נגד 6) → חצי גמר 0 (משחק 2)
        // משחק 3 (2 נגד 7) → חצי גמר 1 (משחק 1)
        const qfIndex = knockoutMatches.quarterFinals.findIndex(m => m.id === matchId);

        if (qfIndex === 0) {
          // משחק 1: 1 נגד 8 → מנצח לחצי גמר 1 מיקום 1
          knockoutMatches.semiFinals[0].player1 = winner;
        } else if (qfIndex === 1) {
          // משחק 2: 4 נגד 5 → מנצח לחצי גמר 2 מיקום 1
          knockoutMatches.semiFinals[1].player1 = winner;
        } else if (qfIndex === 2) {
          // משחק 3: 3 נגד 6 → מנצח לחצי גמר 1 מיקום 2
          knockoutMatches.semiFinals[0].player2 = winner;
        } else if (qfIndex === 3) {
          // משחק 4: 2 נגד 7 → מנצח לחצי גמר 2 מיקום 2
          knockoutMatches.semiFinals[1].player2 = winner;
        }
      } else if (stage === 'semiFinals') {
        const sfIndex = knockoutMatches.semiFinals.findIndex(m => m.id === matchId);

        if (sfIndex === 0) {
          knockoutMatches.final[0].player1 = winner;
        } else {
          knockoutMatches.final[0].player2 = winner;
        }
      }
    }

    await updateDoc(doc(db, 'tournament', 'current'), {
      knockoutMatches: knockoutMatches
    });
  };

  const declareWinner = async () => {
    const finalMatch = tournament.knockoutMatches.final[0];
    if (!finalMatch.completed) {
      alert('המשחק עדיין לא הסתיים');
      return;
    }

    const winner = finalMatch.score1 > finalMatch.score2 ? finalMatch.player1 : finalMatch.player2;

    await updateDoc(doc(db, 'tournament', 'current'), {
      status: 'finished',
      winner: winner
    });

    alert(`🏆 ${winner.name} זכה בטורניר! 🏆`);
  };

  const resetCurrentStage = async () => {
    if (!confirm('האם אתה בטוח שברצונך לאפס את השלב הנוכחי?')) return;

    const updates = {};

    if (tournament.status === 'groups') {
      const resetGroups = tournament.groups.map(group => ({
        ...group,
        matches: group.matches.map(match => ({
          ...match,
          score1: 0,
          score2: 0,
          completed: false
        }))
      }));
      updates.groups = resetGroups;
    } else if (tournament.status === 'knockout') {
      const resetKnockout = { ...tournament.knockoutMatches };
      
      ['quarterFinals', 'semiFinals', 'final'].forEach(stage => {
        if (resetKnockout[stage]) {
          resetKnockout[stage] = resetKnockout[stage].map(match => ({
            ...match,
            score1: 0,
            score2: 0,
            completed: false
          }));
        }
      });

      updates.knockoutMatches = resetKnockout;
    }

    await updateDoc(doc(db, 'tournament', 'current'), updates);
    alert('השלב הנוכחי אופס בהצלחה');
  };

  const goToPreviousStage = async () => {
    if (!confirm('האם אתה בטוח שברצונך לחזור לשלב הקודם?')) return;

    if (tournament.status === 'knockout') {
      await updateDoc(doc(db, 'tournament', 'current'), {
        status: 'groups',
        knockoutMatches: null,
        qualifiers: null
      });
      alert('חזרת לשלב הבתים');
    } else if (tournament.status === 'finished') {
      await updateDoc(doc(db, 'tournament', 'current'), {
        status: 'knockout',
        winner: null
      });
      alert('חזרת לשלב הנוקאאוט');
    }
  };

  const resetTournament = async () => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את כל הטורניר? פעולה זו בלתי הפיכה!')) return;
    if (!confirm('בטוח בטוח? כל המידע יימחק!')) return;

    await setDoc(doc(db, 'tournament', 'current'), {
      players: [],
      status: 'setup'
    });

    setPreviewGroups([]);
    alert('הטורניר אופס במלואו');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', paddingBottom: '40px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          padding: '30px',
          marginBottom: '30px',
          color: 'white',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '32px', margin: 0 }}>🎲 ניהול טורניר שש בש 🎲</h1>
          <p style={{ marginTop: '10px', opacity: 0.9 }}>
            {!tournament || tournament.status === 'setup' ? 'הוספת שחקנים' : 
             tournament.status === 'groups' ? 'שלב הבתים' :
             tournament.status === 'knockout' ? 'שלב הנוקאאוט' : 'הטורניר הסתיים'}
          </p>
        </div>

        {(!tournament || tournament.status === 'setup') && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginBottom: '20px'
          }}>
            <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>הוספת שחקנים (20-30)</h2>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'flex-start' }}>
              <textarea
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="שם שחקן (או הדבק רשימה מאקסל)"
                rows={3}
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: '16px',
                  border: '2px solid var(--border-color)',
                  borderRadius: '8px',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
              <button
                onClick={addPlayer}
                style={{
                  padding: '12px 24px',
                  background: 'var(--primary-color)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  height: '72px'
                }}
              >
                הוסף
              </button>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '15px' }}>
              💡 ניתן להדביק רשימת שמות מאקסל (שם בכל שורה)
            </p>

            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>
                שחקנים רשומים: {players.length} / 30
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '10px'
            }}>
              {players.map(player => (
                <div key={player.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px'
                }}>
                  <span>{player.name}</span>
                  <button
                    onClick={() => removePlayer(player.id)}
                    style={{
                      padding: '4px 8px',
                      background: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {players.length >= 20 && players.length <= 30 && (
              <>
                <button
                  onClick={() => generateRandomGroups()}
                  style={{
                    marginTop: '20px',
                    padding: '12px 24px',
                    background: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    width: '100%'
                  }}
                >
                  🔀 חלוקה אקראית לבתים
                </button>

                {previewGroups.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h3 style={{ fontSize: '20px', margin: 0, color: 'var(--primary-color)' }}>
                        תצוגת חלוקת בתים ({previewGroups.length} בתים)
                      </h3>
                      
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          onClick={removeGroup}
                          disabled={previewGroups.length <= 4}
                          style={{
                            padding: '8px 16px',
                            background: previewGroups.length <= 4 ? '#95a5a6' : '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: previewGroups.length <= 4 ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            opacity: previewGroups.length <= 4 ? 0.5 : 1
                          }}
                        >
                          ➖ הסר בית
                        </button>
                        
                        <button
                          onClick={addGroup}
                          disabled={previewGroups.length >= 6}
                          style={{
                            padding: '8px 16px',
                            background: previewGroups.length >= 6 ? '#95a5a6' : '#27ae60',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: previewGroups.length >= 6 ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            opacity: previewGroups.length >= 6 ? 0.5 : 1
                          }}
                        >
                          ➕ הוסף בית
                        </button>
                      </div>
                    </div>
                    
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '15px' }}>
                      💡 ניתן לשנות שחקן לבית אחר על ידי בחירת בית יעד מהתפריט הנפתח
                    </p>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: '15px',
                      marginBottom: '20px'
                    }}>
                      {previewGroups.map(group => (
                        <div key={group.id} style={{
                          background: 'var(--bg-secondary)',
                          borderRadius: '8px',
                          padding: '15px',
                          border: '2px solid var(--primary-color)'
                        }}>
                          <h4 style={{
                            fontSize: '16px',
                            color: 'var(--primary-color)',
                            marginBottom: '10px',
                            textAlign: 'center',
                            paddingBottom: '8px',
                            borderBottom: '2px solid var(--border-color)'
                          }}>
                            {group.name} ({group.players.length} שחקנים)
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {group.players.map(player => (
                              <div key={player.id} style={{
                                background: 'white',
                                padding: '10px',
                                borderRadius: '6px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '10px'
                              }}>
                                <span style={{ fontWeight: '500', flex: 1 }}>{player.name}</span>
                                <select
                                  value={group.id}
                                  onChange={(e) => movePlayerToGroup(player.id, group.id, parseInt(e.target.value))}
                                  style={{
                                    padding: '5px 8px',
                                    fontSize: '12px',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    background: 'white'
                                  }}
                                >
                                  {previewGroups.map(g => (
                                    <option key={g.id} value={g.id}>
                                      {g.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={startTournament}
                      disabled={loading}
                      style={{
                        padding: '15px 30px',
                        background: loading ? '#95a5a6' : '#2ecc71',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        width: '100%'
                      }}
                    >
                      {loading ? 'מתחיל...' : '🚀 התחל טורניר'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tournament && tournament.status === 'groups' && (
          <div>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px'
            }}>
              <h2 style={{ fontSize: '24px', marginBottom: '20px', color: 'var(--primary-color)' }}>
                שלב הבתים
              </h2>

              <div style={{
                background: '#e8f4f8',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '2px solid #3498db'
              }}>
                <h3 style={{ fontSize: '18px', marginBottom: '10px', color: '#2980b9' }}>
                  💡 הוראות משחק
                </h3>
                <ul style={{ margin: 0, paddingRight: '20px', color: '#34495e', lineHeight: '1.8' }}>
                  <li><strong>משחק:</strong> כל משחק מורכב מ-3 משחקונים</li>
                  <li><strong>ניקוד:</strong> ניצחון רגיל = 1 נקודה | מארס = 2 נקודות | מארס טורקי = 3 נקודות</li>
                  <li><strong>תוצאה סופית:</strong> סכום הנקודות מכל המשחקונים (0-9 לכל שחקן)</li>
                  <li><strong>דירוג:</strong> לפי הפרש נקודות, ובמקרה של שוויון - לפי סה"כ נקודות</li>
                </ul>
                
                <div style={{ 
                  background: 'white', 
                  padding: '12px', 
                  borderRadius: '6px', 
                  marginTop: '12px',
                  border: '1px solid #3498db'
                }}>
                  <h4 style={{ fontSize: '16px', marginBottom: '8px', color: '#2980b9' }}>
                    🎯 עליה לרבע גמר (סה"כ 8 שחקנים):
                  </h4>
                  <ul style={{ margin: 0, paddingRight: '20px', color: '#34495e', lineHeight: '1.8' }}>
                    <li><strong>20-23 שחקנים (5 בתים):</strong> כל המקומות הראשונים (5) + 3 המקומות השניים הטובים ביותר</li>
                    <li><strong>24-30 שחקנים (6 בתים):</strong> כל המקומות הראשונים (6) + 2 המקומות השניים הטובים ביותר</li>
                    <li><strong>בבתים של 5 שחקנים:</strong> למקומות שניים נספרים רק 3 המשחקים הטובים ביותר</li>
                    <li><strong>תיקו:</strong> במקרה של שוויון בין מקומות שניים על הקו הגבול, יתקיים משחק/משחקון מכריע</li>
                  </ul>
                </div>
              </div>

              {tournament.groups.every(g => g.matches.every(m => m.completed)) && (
                <>
                  {/* תצוגת תיקו אם יש */}
                  {tournament.tiebreakers && tournament.tiebreakers.length > 0 && (
                    <TiebreakerSelection 
                      tiebreakers={tournament.tiebreakers}
                      onResolve={resolveTiebreaker}
                    />
                  )}

                  {/* כפתור להתחלת נוקאאוט - רק אם אין תיקו או שכולם נפתרו */}
                  {(!tournament.tiebreakers || tournament.tiebreakers.length === 0 || 
                    tournament.tiebreakers.every(tb => tb.resolved)) && (
                    <div style={{
                      background: '#d4edda',
                      border: '2px solid #27ae60',
                      borderRadius: '12px',
                      padding: '20px',
                      marginBottom: '20px',
                      textAlign: 'center'
                    }}>
                      <h3 style={{ fontSize: '20px', color: '#155724', marginBottom: '10px' }}>
                        ✓ כל המשחקים בשלב הבתים הסתיימו!
                      </h3>
                      <button
                        onClick={tournament.tiebreakers ? finalizeKnockoutStart : startKnockout}
                        disabled={loading}
                        style={{
                          padding: '15px 30px',
                          background: loading ? '#95a5a6' : '#2ecc71',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '18px',
                          fontWeight: 'bold',
                          marginTop: '10px'
                        }}
                      >
                        {loading ? 'מתחיל...' : '▶️ התחל שלב נוקאאוט'}
                      </button>
                    </div>
                  )}
                </>
              )}

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: '20px'
              }}>
                {tournament.groups.map(group => {
                  const standings = calculateStandings(group);
                  
                  return (
                    <div key={group.id} style={{
                      background: 'var(--bg-secondary)',
                      borderRadius: '12px',
                      padding: '20px',
                      border: '2px solid var(--primary-color)'
                    }}>
                      <h3 style={{
                        fontSize: '20px',
                        color: 'var(--primary-color)',
                        marginBottom: '15px',
                        textAlign: 'center',
                        paddingBottom: '10px',
                        borderBottom: '2px solid var(--border-color)'
                      }}>
                        {group.name}
                      </h3>

                      <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ fontSize: '16px', marginBottom: '10px', color: 'var(--text-secondary)' }}>
                          דירוג:
                        </h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'white' }}>
                              <th style={{ padding: '8px', textAlign: 'right', fontSize: '14px' }}>#</th>
                              <th style={{ padding: '8px', textAlign: 'right', fontSize: '14px' }}>שם</th>
                              <th style={{ padding: '8px', textAlign: 'center', fontSize: '14px' }}>הפרש</th>
                              <th style={{ padding: '8px', textAlign: 'center', fontSize: '14px' }}>נק׳ זכות</th>
                            </tr>
                          </thead>
                          <tbody>
                            {standings.map((standing, idx) => (
                              <tr key={standing.player.id} style={{
                                background: idx === 0 ? '#d4edda' : idx === 1 ? '#fff3cd' : 'white',
                                borderBottom: '1px solid var(--border-color)'
                              }}>
                                <td style={{ padding: '8px', fontWeight: 'bold' }}>
                                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx + 1}
                                </td>
                                <td style={{ padding: '8px' }}>{standing.player.name}</td>
                                <td style={{ 
                                  padding: '8px', 
                                  textAlign: 'center', 
                                  fontWeight: 'bold',
                                  color: standing.diff > 0 ? '#27ae60' : standing.diff < 0 ? '#e74c3c' : 'inherit'
                                }}>
                                  {standing.diff > 0 ? '+' : ''}{standing.diff}
                                </td>
                                <td style={{ padding: '8px', textAlign: 'center' }}>{standing.totalPoints}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div>
                        <h4 style={{ fontSize: '16px', marginBottom: '10px', color: 'var(--text-secondary)' }}>
                          משחקים:
                        </h4>
                        {group.matches.map(match => (
                          <div key={match.id} style={{
                            background: 'white',
                            padding: '15px',
                            borderRadius: '8px',
                            marginBottom: '10px',
                            border: match.completed ? '2px solid #27ae60' : '2px solid var(--border-color)'
                          }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '12px', textAlign: 'center' }}>
                              {match.player1.name} נגד {match.player2.name}
                              {match.completed && ' ✓'}
                            </div>
                            
                            <div style={{
                              display: 'flex',
                              gap: '15px',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                                  {match.completed ? match.score1 : '-'}
                                </div>
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(score => (
                                    <button
                                      key={score}
                                      onClick={() => updateScore(group.id, match.id, score, match.score2)}
                                      style={{
                                        padding: '6px 10px',
                                        background: match.score1 === score && match.completed ? 'var(--primary-color)' : 'white',
                                        color: match.score1 === score && match.completed ? 'white' : '#333',
                                        border: '2px solid var(--primary-color)',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        minWidth: '35px'
                                      }}
                                    >
                                      {score}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <span style={{ fontSize: '24px', fontWeight: 'bold' }}>:</span>

                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                                  {match.completed ? match.score2 : '-'}
                                </div>
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(score => (
                                    <button
                                      key={score}
                                      onClick={() => updateScore(group.id, match.id, match.score1, score)}
                                      style={{
                                        padding: '6px 10px',
                                        background: match.score2 === score && match.completed ? 'var(--primary-color)' : 'white',
                                        color: match.score2 === score && match.completed ? 'white' : '#333',
                                        border: '2px solid var(--primary-color)',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        minWidth: '35px'
                                      }}
                                    >
                                      {score}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tournament && tournament.status === 'knockout' && tournament.knockoutMatches && (
          <div>
            <h2 style={{ fontSize: '24px', marginBottom: '20px', color: 'var(--primary-color)' }}>
              שלב הנוקאאוט
            </h2>

            {tournament.knockoutMatches.tiebreakers && tournament.knockoutMatches.tiebreakers.length > 0 && (
              <div style={{
                background: '#fff3cd',
                border: '2px solid #ffc107',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px'
              }}>
                <h3 style={{ fontSize: '20px', marginBottom: '15px', color: '#856404' }}>
                  ⚠️ משחקי הכרעה נדרשים
                </h3>
                {tournament.knockoutMatches.tiebreakers.map((tie, idx) => (
                  <div key={idx} style={{
                    background: 'white',
                    padding: '15px',
                    borderRadius: '8px',
                    marginBottom: '10px'
                  }}>
                    <div style={{ fontWeight: 'bold', textAlign: 'center' }}>
                      {tie.player1.name} נגד {tie.player2.name}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)', marginTop: '5px' }}>
                      סיבה: {tie.reason}
                    </div>
                  </div>
                ))}
                <p style={{ marginTop: '15px', color: '#856404', textAlign: 'center' }}>
                  יש לשחק את המשחקים האלה ולסמן המנצחים לפני המשך הטורניר
                </p>
              </div>
            )}

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '30px'
            }}>
              {tournament.knockoutMatches.quarterFinals && tournament.knockoutMatches.quarterFinals.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '20px', marginBottom: '15px', textAlign: 'center', color: '#e67e22' }}>
                    🥉 רבע גמר
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '15px'
                  }}>
                    {tournament.knockoutMatches.quarterFinals.map((match, idx) => (
                      <div key={match.id} style={{
                        background: 'white',
                        border: '2px solid var(--primary-color)',
                        borderRadius: '12px',
                        padding: '20px'
                      }}>
                        <div style={{ textAlign: 'center', marginBottom: '15px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                          רבע גמר {idx + 1}
                        </div>
                        {match.player1 && match.player2 ? (
                          <>
                            <div style={{ fontWeight: 'bold', marginBottom: '15px', textAlign: 'center', fontSize: '16px' }}>
                              {match.player1.name} נגד {match.player2.name}
                              {match.completed && ' ✓'}
                            </div>
                            
                            <div style={{
                              display: 'flex',
                              gap: '15px',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                                  {match.completed ? match.score1 : '-'}
                                </div>
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(score => (
                                    <button
                                      key={score}
                                      onClick={() => updateKnockoutScore('quarterFinals', match.id, score, match.score2)}
                                      style={{
                                        padding: '8px 12px',
                                        background: match.score1 === score && match.completed ? 'var(--primary-color)' : 'white',
                                        color: match.score1 === score && match.completed ? 'white' : '#333',
                                        border: '2px solid var(--primary-color)',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        minWidth: '35px'
                                      }}
                                    >
                                      {score}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <span style={{ fontSize: '24px', fontWeight: 'bold' }}>:</span>

                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                                  {match.completed ? match.score2 : '-'}
                                </div>
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(score => (
                                    <button
                                      key={score}
                                      onClick={() => updateKnockoutScore('quarterFinals', match.id, match.score1, score)}
                                      style={{
                                        padding: '8px 12px',
                                        background: match.score2 === score && match.completed ? 'var(--primary-color)' : 'white',
                                        color: match.score2 === score && match.completed ? 'white' : '#333',
                                        border: '2px solid var(--primary-color)',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        minWidth: '35px'
                                      }}
                                    >
                                      {score}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                            ממתין לשחקנים
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tournament.knockoutMatches.semiFinals && tournament.knockoutMatches.semiFinals.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '20px', marginBottom: '15px', textAlign: 'center', color: '#9b59b6' }}>
                    🥈 חצי גמר
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '15px',
                    maxWidth: '700px',
                    margin: '0 auto'
                  }}>
                    {tournament.knockoutMatches.semiFinals.map((match, idx) => (
                      <div key={match.id} style={{
                        background: 'white',
                        border: '2px solid var(--primary-color)',
                        borderRadius: '12px',
                        padding: '20px'
                      }}>
                        <div style={{ textAlign: 'center', marginBottom: '15px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                          חצי גמר {idx + 1}
                        </div>
                        {match.player1 && match.player2 ? (
                          <>
                            <div style={{ fontWeight: 'bold', marginBottom: '15px', textAlign: 'center', fontSize: '16px' }}>
                              {match.player1.name} נגד {match.player2.name}
                              {match.completed && ' ✓'}
                            </div>
                            
                            <div style={{
                              display: 'flex',
                              gap: '15px',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                                  {match.completed ? match.score1 : '-'}
                                </div>
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(score => (
                                    <button
                                      key={score}
                                      onClick={() => updateKnockoutScore('semiFinals', match.id, score, match.score2)}
                                      style={{
                                        padding: '8px 12px',
                                        background: match.score1 === score && match.completed ? 'var(--primary-color)' : 'white',
                                        color: match.score1 === score && match.completed ? 'white' : '#333',
                                        border: '2px solid var(--primary-color)',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        minWidth: '35px'
                                      }}
                                    >
                                      {score}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <span style={{ fontSize: '24px', fontWeight: 'bold' }}>:</span>

                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                                  {match.completed ? match.score2 : '-'}
                                </div>
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(score => (
                                    <button
                                      key={score}
                                      onClick={() => updateKnockoutScore('semiFinals', match.id, match.score1, score)}
                                      style={{
                                        padding: '8px 12px',
                                        background: match.score2 === score && match.completed ? 'var(--primary-color)' : 'white',
                                        color: match.score2 === score && match.completed ? 'white' : '#333',
                                        border: '2px solid var(--primary-color)',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 'bold',
                                        minWidth: '35px'
                                      }}
                                    >
                                      {score}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                            ממתין לשחקנים
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tournament.knockoutMatches.final && (
                <div>
                  <h3 style={{ fontSize: '24px', marginBottom: '15px', textAlign: 'center', color: '#FFD700' }}>
                    🏆 גמר
                  </h3>
                  <div style={{ maxWidth: '500px', margin: '0 auto' }}>
                    {tournament.knockoutMatches.final.map(match => (
                      <div key={match.id} style={{
                        background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
                        padding: '25px',
                        borderRadius: '12px',
                        border: '3px solid #FFD700'
                      }}>
                        {match.player1 && match.player2 ? (
                          <>
                            <div style={{ fontWeight: 'bold', marginBottom: '20px', textAlign: 'center', fontSize: '20px', color: 'white' }}>
                              {match.player1.name} נגד {match.player2.name}
                              {match.completed && ' ✓'}
                            </div>
                            
                            <div style={{
                              display: 'flex',
                              gap: '15px',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ fontSize: '36px', fontWeight: 'bold', color: 'white' }}>
                                  {match.completed ? match.score1 : '-'}
                                </div>
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(score => (
                                    <button
                                      key={score}
                                      onClick={() => updateKnockoutScore('final', match.id, score, match.score2)}
                                      style={{
                                        padding: '10px 14px',
                                        background: match.score1 === score && match.completed ? '#FFD700' : 'white',
                                        color: match.score1 === score && match.completed ? 'black' : '#333',
                                        border: '2px solid #FFD700',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '16px',
                                        fontWeight: 'bold',
                                        minWidth: '40px'
                                      }}
                                    >
                                      {score}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <span style={{ fontSize: '28px', fontWeight: 'bold', color: 'white' }}>:</span>

                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ fontSize: '36px', fontWeight: 'bold', color: 'white' }}>
                                  {match.completed ? match.score2 : '-'}
                                </div>
                                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(score => (
                                    <button
                                      key={score}
                                      onClick={() => updateKnockoutScore('final', match.id, match.score1, score)}
                                      style={{
                                        padding: '10px 14px',
                                        background: match.score2 === score && match.completed ? '#FFD700' : 'white',
                                        color: match.score2 === score && match.completed ? 'black' : '#333',
                                        border: '2px solid #FFD700',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '16px',
                                        fontWeight: 'bold',
                                        minWidth: '40px'
                                      }}
                                    >
                                      {score}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                            
                            {match.completed && match.score1 !== match.score2 && (
                              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                                <button
                                  onClick={declareWinner}
                                  style={{
                                    padding: '15px 30px',
                                    background: '#2ecc71',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
                                  }}
                                >
                                  🏆 הכרז על הזוכה בטורניר 🏆
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ textAlign: 'center', color: 'white', fontSize: '18px' }}>
                            ממתין לשחקנים
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tournament && tournament.status === 'finished' && tournament.winner && (
          <div style={{
            background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
            padding: '40px',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <h3 style={{ fontSize: '24px', color: 'white', marginBottom: '15px' }}>
              🏆 הזוכה בטורניר 🏆
            </h3>
            <h2 style={{ fontSize: '36px', color: 'white', fontWeight: 'bold' }}>
              {tournament.winner.name}
            </h2>
          </div>
        )}

        {tournament && tournament.status !== 'setup' && (
          <div style={{ marginTop: '30px', display: 'flex', gap: '10px', flexDirection: 'column' }}>
            <button
              onClick={resetCurrentStage}
              style={{
                padding: '12px 24px',
                background: '#f39c12',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                width: '100%'
              }}
            >
              🔄 אפס שלב נוכחי
            </button>
            
            <button
              onClick={goToPreviousStage}
              style={{
                padding: '12px 24px',
                background: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                width: '100%'
              }}
            >
              ⬅️ חזור לשלב הקודם
            </button>

            <button
              onClick={resetTournament}
              style={{
                padding: '12px 24px',
                background: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                width: '100%'
              }}
            >
              🗑️ איפוס טורניר מלא (מחיקת הכל)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ManageTournament;