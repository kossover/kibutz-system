// src/pages/Tournament.jsx
import { useState, useEffect } from 'react';
import { db, auth } from '../firebase/config';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Dice1 } from 'lucide-react';

function Tournament() {
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'tournament', 'current'), (doc) => {
      if (doc.exists()) {
        setTournament(doc.data());
      } else {
        setTournament(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const calculateStandings = (group) => {
    const standings = group.players.map(player => ({
      player: player,
      totalPoints: 0,
      diff: 0,
      played: 0,
      matchResults: [] // נשמור את תוצאות המשחקים הבודדים
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
      
      // שמירת תוצאות בודדות לצורך חישוב 3 הטובים
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
    // אם הבית הוא של 5 שחקנים (4 משחקים), נחשב רק את 3 הטובים
    if (group.players.length === 5) {
      const standings = calculateStandings(group);
      const playerStanding = standings.find(s => s.player.id === player.id);
      
      if (!playerStanding || playerStanding.matchResults.length < 3) {
        return { diff: playerStanding.diff, totalPoints: playerStanding.totalPoints };
      }
      
      // מיון המשחקים לפי הפרש (מהגבוה לנמוך)
      const sortedMatches = [...playerStanding.matchResults].sort((a, b) => b.diff - a.diff);
      
      // לקיחת 3 המשחקים הטובים
      const best3Matches = sortedMatches.slice(0, 3);
      
      const best3Diff = best3Matches.reduce((sum, match) => sum + match.diff, 0);
      const best3Points = best3Matches.reduce((sum, match) => sum + match.points, 0);
      
      return { diff: best3Diff, totalPoints: best3Points };
    } else {
      // בית של 4 - משתמשים בכל המשחקים
      const standings = calculateStandings(group);
      const playerStanding = standings.find(s => s.player.id === player.id);
      return { diff: playerStanding.diff, totalPoints: playerStanding.totalPoints };
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>טוען...</div>
      </div>
    );
  }

  if (!tournament || tournament.status === 'setup' || !tournament.status) {
    return (
      <div style={{ 
        padding: '40px 20px', 
        textAlign: 'center',
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Dice1 size={80} color="var(--primary-color)" style={{ marginBottom: '20px' }} />
        <h2 style={{ fontSize: '28px', marginBottom: '12px' }}>טורניר שש בש</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '18px' }}>
          {!tournament ? 'אין טורניר פעיל כרגע' : 'הטורניר בהכנה, נתחיל בקרוב!'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '50px' }}>
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '12px 20px',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <span>🎲</span>
          <span>טורניר שש בש</span>
          <span style={{ fontSize: '16px', opacity: 0.9, marginLeft: '10px' }}>
            {tournament.status === 'groups' && '• שלב הבתים'}
            {tournament.status === 'knockout' && '• שלב הנוקאאוט'}
            {tournament.status === 'finished' && '• 🏆 הסתיים'}
          </span>
        </h1>
      </div>

      {tournament.status === 'groups' && tournament.groups && (
        <div style={{ padding: '15px', paddingBottom: '60px' }}>
          
          {tournament.groups.every(g => g.matches.every(m => m.completed)) && (
            <>
              {/* הודעה על סיום או תיקו */}
              {tournament.tiebreakers && tournament.tiebreakers.length > 0 && !tournament.tiebreakers.every(tb => tb.resolved) ? (
                <div style={{
                  background: '#d1ecf1',
                  border: '3px solid #17a2b8',
                  borderRadius: '12px',
                  padding: '15px',
                  marginBottom: '15px'
                }}>
                  <h3 style={{ fontSize: '18px', color: '#0c5460', margin: 0, marginBottom: '12px', textAlign: 'center' }}>
                    ⚠️ יש תיקו! המנהל בוחר את המעפילים
                  </h3>
                  
                  {tournament.tiebreakers.map((tb, idx) => (
                    <div key={idx} style={{
                      background: 'white',
                      borderRadius: '8px',
                      padding: '12px',
                      marginTop: idx > 0 ? '10px' : 0
                    }}>
                      <p style={{ fontSize: '15px', color: '#0c5460', margin: '0 0 10px 0', fontWeight: 'bold', textAlign: 'center' }}>
                        תיקו בין {tb.players.length} שחקנים - המנהל בוחר {tb.numToQualify}
                      </p>
                      
                      <div style={{
                        background: '#f8f9fa',
                        borderRadius: '6px',
                        padding: '10px',
                        marginBottom: '8px'
                      }}>
                        <p style={{ fontSize: '13px', color: '#666', margin: '0 0 6px 0', textAlign: 'center' }}>
                          <strong>סטטיסטיקות זהות:</strong> הפרש {tb.diff > 0 ? '+' : ''}{tb.diff}, נקודות: {tb.totalPoints}
                        </p>
                        <p style={{ fontSize: '14px', color: '#0c5460', margin: 0, textAlign: 'center', fontWeight: 'bold' }}>
                          השחקנים בתיקו:
                        </p>
                      </div>
                      
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        justifyContent: 'center'
                      }}>
                        {tb.players.map(player => (
                          <div key={player.id} style={{
                            background: '#17a2b8',
                            color: 'white',
                            padding: '8px 15px',
                            borderRadius: '20px',
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}>
                            {player.name}
                          </div>
                        ))}
                      </div>
                      
                      {tb.players.length === 2 && (
                        <p style={{ fontSize: '12px', color: '#666', margin: '10px 0 0 0', textAlign: 'center', fontStyle: 'italic' }}>
                          💡 מומלץ משחק אחד מכריע
                        </p>
                      )}
                      {tb.players.length > 2 && (
                        <p style={{ fontSize: '12px', color: '#666', margin: '10px 0 0 0', textAlign: 'center', fontStyle: 'italic' }}>
                          💡 מומלץ מיני ליגה בין השחקנים
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  background: '#d4edda',
                  border: '2px solid #27ae60',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '15px',
                  textAlign: 'center'
                }}>
                  <h3 style={{ fontSize: '16px', color: '#155724', margin: 0 }}>
                    ✓ כל המשחקים הסתיימו! המנהל יתחיל את שלב הנוקאאוט
                  </h3>
                </div>
              )}

              {/* תצוגת המעפילים */}
              {(() => {
                const firstPlaces = [];
                const secondPlaces = [];

                tournament.groups.forEach(group => {
                  const standings = calculateStandings(group);
                  
                  if (standings[0]) {
                    firstPlaces.push({
                      player: standings[0].player,
                      groupName: group.name,
                      diff: standings[0].diff,
                      totalPoints: standings[0].totalPoints
                    });
                  }
                  
                  if (standings[1]) {
                    // חישוב מיוחד למקום שני בבית של 5
                    const stats = calculateSecondPlaceStatsForComparison(standings[1].player, group);
                    
                    secondPlaces.push({
                      player: standings[1].player,
                      groupName: group.name,
                      diff: stats.diff,
                      totalPoints: stats.totalPoints,
                      isFivePlayerGroup: group.players.length === 5,
                      originalDiff: standings[1].diff,
                      originalPoints: standings[1].totalPoints
                    });
                  }
                });

                secondPlaces.sort((a, b) => {
                  if (b.diff !== a.diff) return b.diff - a.diff;
                  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
                  return 0;
                });

                const numSecondPlacesNeeded = 8 - firstPlaces.length;
                const qualifyingSecondPlaces = secondPlaces.slice(0, numSecondPlacesNeeded);
                const nonQualifyingSecondPlaces = secondPlaces.slice(numSecondPlacesNeeded);

                return (
                  <div style={{
                    background: 'white',
                    borderRadius: '8px',
                    padding: '15px',
                    marginBottom: '15px',
                    border: '2px solid #3498db'
                  }}>
                    <h3 style={{ fontSize: '16px', color: '#2980b9', marginBottom: '12px', textAlign: 'center' }}>
                      🎯 מעפילים לרבע גמר
                    </h3>

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', fontSize: '12px' }}>
                      <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
                        <h4 style={{ fontSize: '13px', color: '#27ae60', marginBottom: '6px', fontWeight: 'bold' }}>
                          🥇 ראשונים ({firstPlaces.length}):
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {firstPlaces.map((q, idx) => (
                            <div key={idx} style={{
                              background: '#d4edda',
                              padding: '5px 8px',
                              borderRadius: '4px',
                              border: '1px solid #27ae60'
                            }}>
                              <strong>{q.player.name}</strong> ({q.groupName}) {q.diff > 0 ? '+' : ''}{q.diff}
                            </div>
                          ))}
                        </div>
                      </div>

                      {qualifyingSecondPlaces.length > 0 && (
                        <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
                          <h4 style={{ fontSize: '13px', color: '#f39c12', marginBottom: '6px', fontWeight: 'bold' }}>
                            🥈 שניים עולים ({qualifyingSecondPlaces.length}):
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {qualifyingSecondPlaces.map((q, idx) => (
                              <div key={idx} style={{
                                background: '#fff3cd',
                                padding: '5px 8px',
                                borderRadius: '4px',
                                border: '1px solid #f39c12'
                              }}>
                                <strong>{q.player.name}</strong> ({q.groupName}) {q.diff > 0 ? '+' : ''}{q.diff}
                                {q.isFivePlayerGroup && <span style={{ fontSize: '10px', marginLeft: '3px' }}>*</span>}
                              </div>
                            ))}
                          </div>
                          {qualifyingSecondPlaces.some(q => q.isFivePlayerGroup) && (
                            <div style={{ fontSize: '10px', color: '#856404', marginTop: '4px', fontStyle: 'italic' }}>
                              * 3 משחקים טובים בלבד
                            </div>
                          )}
                        </div>
                      )}

                      {nonQualifyingSecondPlaces.length > 0 && (
                        <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
                          <h4 style={{ fontSize: '13px', color: '#95a5a6', marginBottom: '6px', fontWeight: 'bold' }}>
                            ❌ שניים לא עולים:
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {nonQualifyingSecondPlaces.map((q, idx) => (
                              <div key={idx} style={{
                                background: '#f8f9fa',
                                padding: '5px 8px',
                                borderRadius: '4px',
                                border: '1px solid #dee2e6',
                                opacity: 0.7
                              }}>
                                <span style={{ color: '#6c757d' }}>
                                  <strong>{q.player.name}</strong> ({q.groupName}) {q.diff > 0 ? '+' : ''}{q.diff}
                                  {q.isFivePlayerGroup && <span style={{ fontSize: '10px', marginLeft: '3px' }}>*</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '12px'
          }}>
            {tournament.groups.map(group => {
              const standings = calculateStandings(group);
              const allMatchesCompleted = group.matches.every(m => m.completed);
              
              let isSecondPlaceQualifying = null;
              if (allMatchesCompleted) {
                const allSecondPlaces = tournament.groups.map(g => {
                  const s = calculateStandings(g);
                  if (!s[1]) return null;
                  
                  // חישוב מיוחד למקום שני בבית של 5
                  const stats = calculateSecondPlaceStatsForComparison(s[1].player, g);
                  
                  return {
                    player: s[1].player,
                    diff: stats.diff,
                    totalPoints: stats.totalPoints,
                    groupId: g.id
                  };
                }).filter(Boolean);

                allSecondPlaces.sort((a, b) => {
                  if (b.diff !== a.diff) return b.diff - a.diff;
                  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
                  return 0;
                });

                const numSecondPlacesNeeded = 8 - tournament.groups.length;
                const qualifyingIds = allSecondPlaces.slice(0, numSecondPlacesNeeded).map(s => s.groupId);
                
                isSecondPlaceQualifying = qualifyingIds.includes(group.id);
              }
              
              return (
                <div key={group.id} style={{
                  background: 'white',
                  borderRadius: '8px',
                  padding: '12px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                  border: '2px solid var(--primary-color)'
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    color: 'var(--primary-color)',
                    marginBottom: '10px',
                    textAlign: 'center',
                    paddingBottom: '6px',
                    borderBottom: '2px solid var(--border-color)'
                  }}>
                    {group.name}
                  </h3>

                  <div style={{ marginBottom: '12px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-secondary)' }}>
                          <th style={{ padding: '5px', textAlign: 'right' }}>#</th>
                          <th style={{ padding: '5px', textAlign: 'right' }}>שם</th>
                          <th style={{ padding: '5px', textAlign: 'center' }}>הפרש</th>
                          <th style={{ padding: '5px', textAlign: 'center' }}>נק׳ זכות</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((standing, idx) => {
                          let bgColor = 'white';
                          let statusIcon = '';
                          
                          if (idx === 0) {
                            bgColor = '#d4edda';
                            statusIcon = '✓';
                          } else if (idx === 1) {
                            if (isSecondPlaceQualifying === true) {
                              bgColor = '#fff3cd';
                              statusIcon = '✓';
                            } else if (isSecondPlaceQualifying === false) {
                              bgColor = '#e9ecef';
                              statusIcon = '✗';
                            } else {
                              bgColor = '#fff3cd';
                            }
                          }
                          
                          return (
                            <tr key={standing.player.id} style={{
                              background: bgColor,
                              borderBottom: '1px solid var(--border-color)'
                            }}>
                              <td style={{ 
                                padding: '6px 5px', 
                                fontWeight: 'bold',
                                color: idx === 0 ? '#27ae60' : idx === 1 ? (isSecondPlaceQualifying === false ? '#6c757d' : '#f39c12') : 'inherit'
                              }}>
                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx + 1}
                                {statusIcon && <span style={{ marginLeft: '3px', fontSize: '11px' }}>{statusIcon}</span>}
                              </td>
                              <td style={{ 
                                padding: '6px 5px', 
                                fontWeight: idx < 2 ? 'bold' : 'normal'
                              }}>
                                {standing.player.name}
                              </td>
                              <td style={{ 
                                padding: '6px 5px', 
                                textAlign: 'center', 
                                fontWeight: 'bold',
                                color: standing.diff > 0 ? '#27ae60' : standing.diff < 0 ? '#e74c3c' : 'inherit'
                              }}>
                                {standing.diff > 0 ? '+' : ''}{standing.diff}
                              </td>
                              <td style={{ padding: '6px 5px', textAlign: 'center' }}>
                                {standing.totalPoints}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {/* 2 משחקים בכל שורה */}
                    {(() => {
                      const matchesPerRow = 2;
                      const rows = [];
                      for (let i = 0; i < group.matches.length; i += matchesPerRow) {
                        rows.push(group.matches.slice(i, i + matchesPerRow));
                      }
                      
                      return rows.map((row, rowIdx) => (
                        <div key={rowIdx} style={{ 
                          display: 'grid', 
                          gridTemplateColumns: `repeat(${row.length}, 1fr)`,
                          gap: '6px'
                        }}>
                          {row.map(match => {
                            const isWinner1 = match.completed && match.score1 > match.score2;
                            const isWinner2 = match.completed && match.score2 > match.score1;
                            
                            return (
                              <div key={match.id} style={{
                                background: 'var(--bg-secondary)',
                                padding: '6px',
                                borderRadius: '6px',
                                border: match.completed ? '1px solid #27ae60' : '1px solid var(--border-color)'
                              }}>
                                <div style={{ 
                                  fontSize: '10px',
                                  marginBottom: '4px', 
                                  textAlign: 'center',
                                  lineHeight: '1.2'
                                }}>
                                  {match.player1.name.split(' ')[0]} - {match.player2.name.split(' ')[0]}
                                  {match.completed && ' ✓'}
                                </div>
                                
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  background: 'white',
                                  padding: '4px',
                                  borderRadius: '4px'
                                }}>
                                  <div style={{ 
                                    fontSize: '16px', 
                                    fontWeight: 'bold',
                                    color: isWinner1 ? '#27ae60' : 'var(--primary-color)',
                                    minWidth: '20px',
                                    textAlign: 'center'
                                  }}>
                                    {match.completed ? match.score1 : '-'}
                                  </div>
                                  
                                  <span style={{ fontSize: '12px', fontWeight: 'bold' }}>:</span>
                                  
                                  <div style={{ 
                                    fontSize: '16px', 
                                    fontWeight: 'bold',
                                    color: isWinner2 ? '#27ae60' : 'var(--primary-color)',
                                    minWidth: '20px',
                                    textAlign: 'center'
                                  }}>
                                    {match.completed ? match.score2 : '-'}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* קופסת חוקים */}
          <div style={{
            background: 'linear-gradient(135deg, #e8f4f8 0%, #d4e9f7 100%)',
            borderRadius: '8px',
            padding: '12px',
            marginTop: '15px',
            border: '2px solid #3498db',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ 
              fontSize: '15px', 
              color: '#2980b9', 
              marginBottom: '10px',
              textAlign: 'center',
              fontWeight: 'bold',
              margin: '0 0 10px 0'
            }}>
              💡 חוקי שלב הבתים
            </h3>

            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              fontSize: '12px',
              color: '#34495e',
              lineHeight: '1.5'
            }}>
              {/* עמודה 1: מבנה המשחק */}
              <div>
                <strong style={{ color: '#2980b9', display: 'block', marginBottom: '4px' }}>🎯 מבנה:</strong>
                <div style={{ fontSize: '11px' }}>
                  • כל משחק = 3 משחקונים<br/>
                  • ניצחון=1 | מארס=2 | מארס טורקי=3<br/>
                  • תוצאה: 0-9 נק׳ זכות<br/>
                  • כולם נגד כולם בבית<br/>
                  • (בית של 4 שחקנים: 3 משחקים,<br/>
                  בית של 5 שחקנים: 4 משחקים)
                </div>
              </div>

              {/* עמודה 2: דירוג */}
              <div>
                <strong style={{ color: '#2980b9', display: 'block', marginBottom: '4px' }}>📊 דירוג:</strong>
                <div style={{ fontSize: '11px' }}>
                  • לפי הפרש נקודות<br/>
                  • בשוויון: סה״כ נקודות<br/>
                  • חישוב: נק׳ זכות שלי − נק׳ זכות יריב
                </div>
              </div>

              {/* עמודה 3: עלייה */}
              <div>
                <strong style={{ color: '#2980b9', display: 'block', marginBottom: '4px' }}>🏆 עלייה לרבע גמר:</strong>
                <div style={{ fontSize: '11px' }}>
                  • <strong>5 בתים:</strong> כל הראשונים (5) + 3 השניים הטובים<br/>
                  • <strong>6 בתים:</strong> כל הראשונים (6) + 2 השניים הטובים<br/>
                  • ⭐ שני בבית של 5: רק 3 משחקים טובים נחשבים<br/>
                  • 🎲 תיקו במקום 2: משחק/משחקון מכריע
                </div>
              </div>

              {/* עמודה 4: נוקאאוט */}
              <div>
                <strong style={{ color: '#2980b9', display: 'block', marginBottom: '4px' }}>🎮 נוקאאוט:</strong>
                <div style={{ fontSize: '11px' }}>
                  • 8→4 (רבע גמר)<br/>
                  • 4→2 (חצי גמר)<br/>
                  • 2→1 (גמר) 🏆
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* גמר - תצוגה מיוחדת וענקית - מסתיר הכל אחר */}
      {tournament.status === 'knockout' && tournament.knockoutMatches?.final?.[0]?.player1 && tournament.knockoutMatches?.final?.[0]?.player2 ? (
        <div style={{ 
          padding: '30px 20px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ maxWidth: '900px', width: '100%' }}>
            {(() => {
              const match = tournament.knockoutMatches.final[0];
              const isWinner1 = match.completed && match.score1 > match.score2;
              const isWinner2 = match.completed && match.score2 > match.score1;
              
              return (
                <div style={{
                  background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
                  border: '4px solid #FFD700',
                  borderRadius: '20px',
                  padding: '40px',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '60px', marginBottom: '20px' }}>🏆</div>
                  
                  <h1 style={{ 
                    fontSize: '36px', 
                    color: 'white', 
                    marginBottom: '30px',
                    textShadow: '3px 3px 6px rgba(0,0,0,0.3)',
                    fontWeight: 'bold'
                  }}>
                    גמר הטורניר
                  </h1>

                  {match.completed ? (
                    <>
                      <div style={{
                        background: 'white',
                        padding: '20px',
                        borderRadius: '12px',
                        marginBottom: '30px',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.2)'
                      }}>
                        {match.score1 === match.score2 ? (
                          <>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e67e22', marginBottom: '15px' }}>
                              ⚡ שיוויון צמוד ⚡
                            </div>
                            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2c3e50' }}>
                              איזה מתח! 🔥
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#FFD700', marginBottom: '15px' }}>
                              {tournament.status === 'finished' ? '🎉 אלוף הטורניר 🎉' : '⭐ מוביל במשחק הגמר ⭐'}
                            </div>
                            <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#2c3e50' }}>
                              {isWinner1 ? match.player1.name : match.player2.name}
                            </div>
                          </>
                        )}
                      </div>

                      <div style={{
                        background: 'rgba(255,255,255,0.9)',
                        padding: '20px',
                        borderRadius: '12px',
                        marginBottom: '20px'
                      }}>
                        <div style={{ fontSize: '18px', marginBottom: '15px', color: '#34495e' }}>
                          תוצאת הגמר
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '30px'
                        }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '16px', marginBottom: '10px', color: '#7f8c8d' }}>
                              {match.player1.name}
                            </div>
                            <div style={{ 
                              fontSize: '56px', 
                              fontWeight: 'bold',
                              color: isWinner1 ? '#FFD700' : '#95a5a6'
                            }}>
                              {match.score1}
                            </div>
                          </div>
                          
                          <span style={{ fontSize: '40px', fontWeight: 'bold', color: '#7f8c8d' }}>:</span>
                          
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '16px', marginBottom: '10px', color: '#7f8c8d' }}>
                              {match.player2.name}
                            </div>
                            <div style={{ 
                              fontSize: '56px', 
                              fontWeight: 'bold',
                              color: isWinner2 ? '#FFD700' : '#95a5a6'
                            }}>
                              {match.score2}
                            </div>
                          </div>
                        </div>
                      </div>

                    </>
                  ) : (
                    <>
                      <div style={{ 
                        fontWeight: 'bold', 
                        marginBottom: '30px', 
                        fontSize: '28px',
                        color: 'white',
                        textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                      }}>
                        {match.player1.name}<br/>
                        🆚<br/>
                        {match.player2.name}
                      </div>
                      
                      <div style={{
                        background: 'rgba(255,255,255,0.9)',
                        padding: '30px',
                        borderRadius: '12px',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.2)'
                      }}>
                        <div style={{ fontSize: '18px', marginBottom: '20px', color: '#34495e', fontWeight: 'bold' }}>
                          התוצאה הסופית
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '30px'
                        }}>
                          <div style={{ 
                            fontSize: '72px', 
                            fontWeight: 'bold',
                            color: '#3498db',
                            minWidth: '80px',
                            textAlign: 'center'
                          }}>
                            -
                          </div>
                          
                          <span style={{ fontSize: '48px', fontWeight: 'bold', color: '#7f8c8d' }}>:</span>
                          
                          <div style={{ 
                            fontSize: '72px', 
                            fontWeight: 'bold',
                            color: '#3498db',
                            minWidth: '80px',
                            textAlign: 'center'
                          }}>
                            -
                          </div>
                        </div>
                      </div>

                      <div style={{ 
                        marginTop: '30px', 
                        fontSize: '18px', 
                        color: 'white',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
                      }}>
                        המשחק המכריע מתקיים כעת...
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      ) : tournament.status === 'knockout' && tournament.knockoutMatches && (
        <div style={{ padding: '15px', paddingBottom: '60px' }}>
          <h2 style={{ 
            fontSize: '20px', 
            marginBottom: '15px',
            color: 'var(--primary-color)',
            textAlign: 'center'
          }}>
            שלב הנוקאאוט
          </h2>

          {/* תצוגת דירוג המעפילים */}
          {tournament.rankedQualifiers && tournament.rankedQualifiers.length > 0 && (
            <div style={{
              background: 'white',
              borderRadius: '8px',
              padding: '15px',
              marginBottom: '15px',
              border: '2px solid #3498db'
            }}>
              <h3 style={{ fontSize: '16px', color: '#2980b9', marginBottom: '12px', textAlign: 'center' }}>
                📊 דירוג המעפילים לרבע גמר
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '8px',
                fontSize: '12px'
              }}>
                {tournament.rankedQualifiers.map((q, idx) => (
                  <div key={idx} style={{
                    background: q.position === 1 ? '#d4edda' : '#fff3cd',
                    padding: '8px',
                    borderRadius: '6px',
                    border: q.position === 1 ? '2px solid #27ae60' : '2px solid #f39c12',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                      #{q.overallRank} {q.player.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6c757d' }}>
                      {q.position === 1 ? '🥇' : '🥈'} הפרש: {q.diff > 0 ? '+' : ''}{q.diff}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tournament.knockoutMatches.tiebreakers && tournament.knockoutMatches.tiebreakers.length > 0 && (
            <div style={{
              background: '#fff3cd',
              border: '2px solid #ffc107',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '15px',
              fontSize: '13px'
            }}>
              <h3 style={{ fontSize: '15px', marginBottom: '10px', color: '#856404', textAlign: 'center' }}>
                ⚠️ משחקי הכרעה נדרשים
              </h3>
              {tournament.knockoutMatches.tiebreakers.map((tie, idx) => (
                <div key={idx} style={{
                  background: 'white',
                  padding: '8px',
                  borderRadius: '6px',
                  marginBottom: '6px',
                  textAlign: 'center'
                }}>
                  <strong>{tie.player1.name} 🆚 {tie.player2.name}</strong>
                </div>
              ))}
            </div>
          )}

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '25px'
          }}>
            {tournament.knockoutMatches.quarterFinals && tournament.knockoutMatches.quarterFinals.length > 0 && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '12px', textAlign: 'center', color: '#e67e22' }}>
                  🥉 רבע גמר
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '12px'
                }}>
                  {tournament.knockoutMatches.quarterFinals.map((match, idx) => {
                    const isWinner1 = match.completed && match.score1 > match.score2;
                    const isWinner2 = match.completed && match.score2 > match.score1;
                    
                    return (
                      <div key={match.id} style={{
                        background: 'white',
                        border: '2px solid #e67e22',
                        borderRadius: '8px',
                        padding: '12px'
                      }}>
                        <div style={{ textAlign: 'center', marginBottom: '10px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                          רבע גמר {idx + 1}
                          {match.rank1 && match.rank2 && (
                            <span style={{ display: 'block', fontSize: '11px', marginTop: '2px' }}>
                              #{match.rank1} 🆚 #{match.rank2}
                            </span>
                          )}
                        </div>
                        {match.player1 && match.player2 ? (
                          <>
                            <div style={{ 
                              fontWeight: 'bold', 
                              marginBottom: '10px', 
                              textAlign: 'center', 
                              fontSize: '14px'
                            }}>
                              {match.player1.name} 🆚 {match.player2.name}
                            </div>
                            
                            
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '15px',
                              background: 'var(--bg-secondary)',
                              padding: '10px',
                              borderRadius: '6px'
                            }}>
                              <div style={{ 
                                fontSize: '28px', 
                                fontWeight: 'bold',
                                color: isWinner1 ? '#27ae60' : 'var(--primary-color)',
                                minWidth: '40px',
                                textAlign: 'center'
                              }}>
                                {match.completed ? match.score1 : '-'}
                              </div>
                              
                              <span style={{ fontSize: '20px', fontWeight: 'bold' }}>:</span>
                              
                              <div style={{ 
                                fontSize: '28px', 
                                fontWeight: 'bold',
                                color: isWinner2 ? '#27ae60' : 'var(--primary-color)',
                                minWidth: '40px',
                                textAlign: 'center'
                              }}>
                                {match.completed ? match.score2 : '-'}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '15px', fontSize: '13px' }}>
                            ממתין לשחקנים
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tournament.knockoutMatches.semiFinals && tournament.knockoutMatches.semiFinals.length > 0 && (
              <div>
                <h3 style={{ fontSize: '18px', marginBottom: '12px', textAlign: 'center', color: '#9b59b6' }}>
                  🥈 חצי גמר
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '12px',
                  maxWidth: '600px',
                  margin: '0 auto'
                }}>
                  {tournament.knockoutMatches.semiFinals.map((match, idx) => {
                    const isWinner1 = match.completed && match.score1 > match.score2;
                    const isWinner2 = match.completed && match.score2 > match.score1;
                    
                    return (
                      <div key={match.id} style={{
                        background: 'white',
                        border: '2px solid #9b59b6',
                        borderRadius: '8px',
                        padding: '12px'
                      }}>
                        <div style={{ textAlign: 'center', marginBottom: '10px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                          חצי גמר {idx + 1}
                        </div>
                        {match.player1 && match.player2 ? (
                          <>
                            <div style={{ 
                              fontWeight: 'bold', 
                              marginBottom: '10px', 
                              textAlign: 'center', 
                              fontSize: '14px'
                            }}>
                              {match.player1.name} 🆚 {match.player2.name}
                            </div>
                            
                            
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '15px',
                              background: 'var(--bg-secondary)',
                              padding: '10px',
                              borderRadius: '6px'
                            }}>
                              <div style={{ 
                                fontSize: '28px', 
                                fontWeight: 'bold',
                                color: isWinner1 ? '#27ae60' : 'var(--primary-color)',
                                minWidth: '40px',
                                textAlign: 'center'
                              }}>
                                {match.completed ? match.score1 : '-'}
                              </div>
                              
                              <span style={{ fontSize: '20px', fontWeight: 'bold' }}>:</span>
                              
                              <div style={{ 
                                fontSize: '28px', 
                                fontWeight: 'bold',
                                color: isWinner2 ? '#27ae60' : 'var(--primary-color)',
                                minWidth: '40px',
                                textAlign: 'center'
                              }}>
                                {match.completed ? match.score2 : '-'}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '15px', fontSize: '13px' }}>
                            ממתין לשחקנים
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tournament.status === 'finished' && tournament.winner && (
        <div style={{ padding: '30px 20px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
            borderRadius: '16px',
            padding: '40px',
            textAlign: 'center',
            boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
            border: '4px solid #FFD700'
          }}>
            <div style={{ fontSize: '50px', marginBottom: '15px' }}>🏆</div>
            <h2 style={{ fontSize: '28px', color: 'white', marginBottom: '15px', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
              אלוף הטורניר
            </h2>
            <h1 style={{ fontSize: '42px', color: 'white', fontWeight: 'bold', textShadow: '3px 3px 6px rgba(0,0,0,0.4)' }}>
              {tournament.winner.name}
            </h1>
            <div style={{ fontSize: '36px', marginTop: '15px' }}>🎉🎊</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Tournament;