import type { Side } from '../analysis.ts';
import type { Notes } from '../notes.ts';

export type DemoGame = {
	pgn: string;
	side: Side;
	notes: Record<number, Partial<Notes>>;
};

export const DEMO_GAMES: DemoGame[] = [
	{
		side: 'w',
		notes: {},
		pgn: `[Event "London"]
[Site "London ENG"]
[Date "1851.06.21"]
[White "Anderssen, Adolf"]
[Black "Kieseritzky, Lionel"]
[Result "1-0"]
[ECO "C33"]
[Opening "King's Gambit Accepted: Bishop's Gambit"]

1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7# 1-0
`
	},
	{
		side: 'b',
		notes: {
			52: {
				candidate: 'a4',
				verdict: 'missed',
				confidence: 'sure',
				considered: 'Nxe5',
				cause: 'chance',
				answers: [
					'I wanted to push the a-pawn and open lines against the white king.',
					'It ignores what White just allowed: the e5 pawn can be taken with a tactic.',
					'Nxe5 wins a pawn, and after Rxg8 Nxc4+ the knight forks king and rook.'
				],
				lesson: 'After a surprising move by my opponent, first check what it allows.'
			}
		},
		pgn: `[Event "World Championship"]
[Site "Sochi RUS"]
[Date "2014.11.15"]
[Round "6"]
[White "Carlsen, Magnus"]
[Black "Anand, Viswanathan"]
[Result "1-0"]
[WhiteElo "2863"]
[BlackElo "2792"]
[ECO "B41"]
[Opening "Sicilian Defense: Kan Variation"]

1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 a6 5. c4 Nf6 6. Nc3 Bb4 7. Qd3 Nc6 8. Nxc6 dxc6 9. Qxd8+ Kxd8 10. e5 Nd7 11. Bf4 Bxc3+ 12. bxc3 Kc7 13. h4 b6 14. h5 h6 15. O-O-O Bb7 16. Rd3 c5 17. Rg3 Rag8 18. Bd3 Nf8 19. Be3 g6 20. hxg6 Nxg6 21. Rh5 Bc6 22. Bc2 Kb7 23. Rg4 a5 24. Bd1 Rd8 25. Bc2 Rdg8 26. Kd2 a4 27. Ke2 a3 28. f3 Rd8 29. Ke1 Rd7 30. Bc1 Ra8 31. Ke2 Ba4 32. Be4+ Bc6 33. Bxg6 fxg6 34. Rxg6 Ba4 35. Rxe6 Rd1 36. Bxa3 Ra1 37. Ke3 Bc2 38. Re7+ 1-0
`
	},
	{
		side: 'w',
		notes: {
			35: {
				candidate: 'Bxb6',
				verdict: 'missed',
				confidence: 'sure',
				cause: 'evaluation',
				answers: [
					'Taking the queen looked like it simply wins.',
					'After Bxc4+ Black gets far more than the queen back and the checks never stop.',
					'Qxc3 removes the strong knight and keeps my position together.'
				],
				lesson: 'Before taking a queen, count what the opponent gets for it.'
			}
		},
		pgn: `[Event "Third Rosenwald Trophy"]
[Site "New York, NY USA"]
[Date "1956.10.17"]
[Round "8"]
[White "Byrne, Donald"]
[Black "Fischer, Robert James"]
[Result "0-1"]
[ECO "D92"]
[Opening "Gruenfeld Defense"]

1. Nf3 Nf6 2. c4 g6 3. Nc3 Bg7 4. d4 O-O 5. Bf4 d5 6. Qb3 dxc4 7. Qxc4 c6 8. e4 Nbd7 9. Rd1 Nb6 10. Qc5 Bg4 11. Bg5 Na4 12. Qa3 Nxc3 13. bxc3 Nxe4 14. Bxe7 Qb6 15. Bc4 Nxc3 16. Bc5 Rfe8+ 17. Kf1 Be6 18. Bxb6 Bxc4+ 19. Kg1 Ne2+ 20. Kf1 Nxd4+ 21. Kg1 Ne2+ 22. Kf1 Nc3+ 23. Kg1 axb6 24. Qb4 Ra4 25. Qxb6 Nxd1 26. h3 Rxa2 27. Kh2 Nxf2 28. Re1 Rxe1 29. Qd8+ Bf8 30. Nxe1 Bd5 31. Nf3 Ne4 32. Qb8 b5 33. h4 h5 34. Ne5 Kg7 35. Kg1 Bc5+ 36. Kf1 Ng3+ 37. Ke1 Bb4+ 38. Kd1 Bb3+ 39. Kc1 Ne2+ 40. Kb1 Nc3+ 41. Kc1 Rc2# 0-1
`
	},
	{
		side: 'b',
		notes: {
			30: {
				candidate: 'Qh5',
				verdict: 'missed',
				confidence: 'unsure',
				cause: 'chance',
				answers: [
					'I wanted to keep the queen active near the white king.',
					'It gives White time to take the d3 pawn and finish development.',
					'd2 hits the rook on e1 and keeps White busy.'
				],
				lesson: 'Look for my own forcing moves before moving the queen again.'
			},
			38: {
				candidate: 'Qxf3',
				verdict: 'missed',
				confidence: 'sure',
				cause: 'threat',
				answers: [
					'Taking the knight wins material and attacks g2.',
					'It opens the e-file, and Rxe7+ starts a forced mate.',
					'Qh3 keeps the threats without opening lines to my king.'
				],
				lesson: 'Check every check and capture my opponent has before grabbing material.'
			},
			40: {
				candidate: 'Kd8',
				verdict: 'found',
				confidence: 'sure',
				answers: ['', 'Nxe7 allows Qxd7+ and a mate with the bishops.', '']
			}
		},
		pgn: `[Event "Berlin"]
[Site "Berlin GER"]
[Date "1852.??.??"]
[White "Anderssen, Adolf"]
[Black "Dufresne, Jean"]
[Result "1-0"]
[ECO "C52"]
[Opening "Italian Game: Evans Gambit"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O d3 8. Qb3 Qf6 9. e5 Qg6 10. Re1 Nge7 11. Ba3 b5 12. Qxb5 Rb8 13. Qa4 Bb6 14. Nbd2 Bb7 15. Ne4 Qf5 16. Bxd3 Qh5 17. Nf6+ gxf6 18. exf6 Rg8 19. Rad1 Qxf3 20. Rxe7+ Nxe7 21. Qxd7+ Kxd7 22. Bf5+ Ke8 23. Bd7+ Kf8 24. Bxe7# 1-0
`
	},
	{
		side: 'w',
		notes: {
			37: {
				candidate: 'e5',
				verdict: 'missed',
				confidence: 'unsure',
				cause: 'plan',
				answers: [
					'I wanted to gain space and push the bishop away.',
					'It opens the diagonals of the black bishops towards my king.',
					'Kh1 takes the king off the diagonal before anything else.'
				],
				lesson: 'Before pushing pawns, count the enemy pieces aiming at my king.'
			}
		},
		pgn: `[Event "Lodz"]
[Site "Lodz POL"]
[Date "1907.12.26"]
[White "Rotlewi, Georg"]
[Black "Rubinstein, Akiba"]
[Result "0-1"]
[ECO "D02"]
[Opening "Queen's Gambit Declined: Tarrasch Defense"]

1. d4 d5 2. Nf3 e6 3. e3 c5 4. c4 Nc6 5. Nc3 Nf6 6. dxc5 Bxc5 7. a3 a6 8. b4 Bd6 9. Bb2 O-O 10. Qd2 Qe7 11. Bd3 dxc4 12. Bxc4 b5 13. Bd3 Rd8 14. Qe2 Bb7 15. O-O Ne5 16. Nxe5 Bxe5 17. f4 Bc7 18. e4 Rac8 19. e5 Bb6+ 20. Kh1 Ng4 21. Be4 Qh4 22. g3 Rxc3 23. gxh4 Rd2 24. Qxd2 Bxe4+ 25. Qg2 Rh3 0-1
`
	},
	{
		side: 'w',
		notes: {
			39: {
				candidate: 'Qe4',
				verdict: 'found',
				confidence: 'unsure',
				answers: ['', 'The queen leaves the centre and the e-file.', '']
			}
		},
		pgn: `[Event "Breslau"]
[Site "Breslau GER"]
[Date "1912.07.20"]
[White "Levitsky, Stepan"]
[Black "Marshall, Frank James"]
[Result "0-1"]
[ECO "C10"]
[Opening "French Defense"]

1. d4 e6 2. e4 d5 3. Nc3 c5 4. Nf3 Nc6 5. exd5 exd5 6. Be2 Nf6 7. O-O Be7 8. Bg5 O-O 9. dxc5 Be6 10. Nd4 Bxc5 11. Nxe6 fxe6 12. Bg4 Qd6 13. Bh3 Rae8 14. Qd2 Bb4 15. Bxf6 Rxf6 16. Rad1 Qc5 17. Qe2 Bxc3 18. bxc3 Qxc3 19. Rxd5 Nd4 20. Qh5 Ref8 21. Re5 Rh6 22. Qg5 Rxh3 23. Rc5 Qg3 0-1
`
	},
	{
		side: 'b',
		notes: {
			16: {
				candidate: 'Nxe4',
				verdict: 'missed',
				confidence: 'sure',
				cause: 'rushed',
				answers: [
					'Winning a piece in the centre looked free.',
					'Qd8+ Kxd8 Bg5+ is mate in two more moves.',
					'Be7 develops and covers d8.'
				],
				lesson: 'When my king is still in the centre, check every queen sacrifice.'
			}
		},
		pgn: `[Event "Vienna"]
[Site "Vienna AUT"]
[Date "1910.??.??"]
[White "Reti, Richard"]
[Black "Tartakower, Savielly"]
[Result "1-0"]
[ECO "B15"]
[Opening "Caro-Kann Defense"]

1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Nf6 5. Qd3 e5 6. dxe5 Qa5+ 7. Bd2 Qxe5 8. O-O-O Nxe4 9. Qd8+ Kxd8 10. Bg5+ Kc7 11. Bd8# 1-0
`
	}
];
