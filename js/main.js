/**
 * main.js — Entry point. Owns all mutable game state and wires up the UI.
 *
 * Responsibilities:
 *  • Splash screen / start button
 *  • Turn management
 *  • Check / checkmate / stalemate detection
 *  • Castling rights tracking
 *  • En-passant target tracking
 *  • Pawn promotion modal
 *  • Square click → select → highlight → move flow
 */

import { createBoard, renderBoard, boardState, resetBoardState } from './board.js';
import { getLegalMoves }                        from './pieces.js';
import { getSquare, getSquares, pieceColour, pieceType, cloneBoard, opponent } from './utils.js';

// ─── Mutable game state ───────────────────────────────────────────────────────

let gameActive  = false;
let currentTurn = 'white';
let selectedPos = null;       // { row, col } | null
let legalMoves  = [];         // filtered legal moves for selected piece

let enPassantTarget = null;   // { row, col } square a pawn can capture into, or null

let castlingRights = {
    white: { kingSide: true, queenSide: true },
    black: { kingSide: true, queenSide: true },
};

// 'playing' | 'check' | 'checkmate' | 'stalemate'
let gameStatus = 'playing';

// Pending promotion: set while the promotion modal is open
let pendingPromotion = null;  // { row, col, colour }

// ─── Splash screen ────────────────────────────────────────────────────────────

const startBtn = document.getElementById('start-btn');
const overlay  = document.getElementById('ui-overlay');

startBtn.addEventListener('click', () => {
    gameActive = true;
    overlay.classList.add('fade-out');
    overlay.addEventListener('transitionend', () => { overlay.style.display = 'none'; }, { once: true });
    updateTurnIndicator();
});

// ─── Board init ───────────────────────────────────────────────────────────────

createBoard();

document.getElementById('chess-board').addEventListener('click', (e) => {
    if (!gameActive || pendingPromotion) return;
    const square = e.target.closest('.square');
    if (!square) return;
    handleSquareClick(+square.dataset.row, +square.dataset.col);
});

// ─── Check / attack detection ─────────────────────────────────────────────────

function findKing(board, colour) {
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
            if (board[r][c] === `${colour}-king`) return { row: r, col: c };
    return null;
}

/**
 * Returns true if (targetRow, targetCol) is attacked by any piece of byColour.
 * Uses pseudo-legal pawn attacks (diagonal only) so the king cannot step there.
 */
function isSquareAttacked(board, targetRow, targetCol, byColour) {
    // Pawn attacks — check manually since getLegalMoves only includes diagonal
    // captures when an enemy piece is present (not what we want for attack maps).
    const pawnDir = byColour === 'white' ? -1 : 1;
    const pawnRow = targetRow - pawnDir;
    for (const dc of [-1, 1]) {
        if (isInBounds(pawnRow, targetCol + dc) &&
            board[pawnRow][targetCol + dc] === `${byColour}-pawn`) return true;
    }

    // All other pieces (rook, knight, bishop, queen, king)
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece || pieceColour(piece) !== byColour || pieceType(piece) === 'pawn') continue;
            const moves = getLegalMoves(board, r, c); // no ep needed for non-pawns
            if (moves.some(m => m.row === targetRow && m.col === targetCol)) return true;
        }
    }
    return false;
}

function isInBounds(row, col) { return row >= 0 && row < 8 && col >= 0 && col < 8; }

function isInCheck(board, colour) {
    const king = findKing(board, colour);
    if (!king) return false;
    return isSquareAttacked(board, king.row, king.col, opponent(colour));
}

// ─── Move simulation ──────────────────────────────────────────────────────────

/**
 * Apply a move to a cloned board (does NOT mutate boardState).
 * Handles en passant and castling rook movement for accurate check simulation.
 */
function simulateMove(board, fromRow, fromCol, toRow, toCol, moveInfo) {
    const b = cloneBoard(board);
    b[toRow][toCol]     = b[fromRow][fromCol];
    b[fromRow][fromCol] = null;

    if (moveInfo.enPassant) b[fromRow][toCol] = null;         // remove captured pawn

    if (moveInfo.castling === 'kingSide') {
        b[fromRow][5] = b[fromRow][7]; b[fromRow][7] = null;
    } else if (moveInfo.castling === 'queenSide') {
        b[fromRow][3] = b[fromRow][0]; b[fromRow][0] = null;
    }

    return b;
}

// ─── Castling pseudo-legal generation ────────────────────────────────────────

function getCastlingMoves(row, col, colour) {
    const moves = [];
    const rank  = colour === 'white' ? 7 : 0;
    const opp   = opponent(colour);

    if (row !== rank || col !== 4) return moves;
    if (isInCheck(boardState, colour)) return moves;   // can't castle while in check

    const rights = castlingRights[colour];

    // Kingside: f & g empty and not attacked
    if (rights.kingSide &&
        boardState[rank][5] === null && boardState[rank][6] === null &&
        !isSquareAttacked(boardState, rank, 5, opp) &&
        !isSquareAttacked(boardState, rank, 6, opp)) {
        moves.push({ row: rank, col: 6, castling: 'kingSide' });
    }

    // Queenside: b, c, d empty; c & d not attacked
    if (rights.queenSide &&
        boardState[rank][1] === null && boardState[rank][2] === null && boardState[rank][3] === null &&
        !isSquareAttacked(boardState, rank, 2, opp) &&
        !isSquareAttacked(boardState, rank, 3, opp)) {
        moves.push({ row: rank, col: 2, castling: 'queenSide' });
    }

    return moves;
}

// ─── Filtered legal moves ─────────────────────────────────────────────────────

/**
 * Returns truly legal moves for the piece at (row,col):
 * pseudo-legal + castling, minus any move that leaves own king in check.
 */
function getFilteredLegalMoves(row, col) {
    const piece = boardState[row][col];
    if (!piece) return [];
    const colour = pieceColour(piece);

    const pseudo   = getLegalMoves(boardState, row, col, { enPassantTarget });
    const castling = getCastlingMoves(row, col, colour);
    const all      = [...pseudo, ...castling];

    return all.filter(move => {
        const sim = simulateMove(boardState, row, col, move.row, move.col, move);
        return !isInCheck(sim, colour);
    });
}

function hasAnyLegalMoves(colour) {
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
            if (boardState[r][c] && pieceColour(boardState[r][c]) === colour)
                if (getFilteredLegalMoves(r, c).length > 0) return true;
    return false;
}

// ─── Click handling ───────────────────────────────────────────────────────────

function handleSquareClick(row, col) {
    const clickedPiece  = boardState[row][col];
    const clickedColour = pieceColour(clickedPiece);

    if (selectedPos !== null) {
        const move = legalMoves.find(m => m.row === row && m.col === col);
        if (move) {
            applyMove(selectedPos.row, selectedPos.col, row, col, move);
            clearSelection();
            return;
        }
        // Re-select own piece
        if (clickedColour === currentTurn) { clearSelection(); selectPiece(row, col); return; }
        clearSelection();
        return;
    }

    if (clickedPiece && clickedColour === currentTurn) selectPiece(row, col);
}

function selectPiece(row, col) {
    selectedPos = { row, col };
    legalMoves  = getFilteredLegalMoves(row, col);

    getSquare(row, col)?.classList.add('selected');
    for (const m of legalMoves) {
        const sq = getSquare(m.row, m.col);
        if (sq) sq.classList.add(boardState[m.row][m.col] ? 'possible-capture' : 'possible-move');
    }
}

function clearSelection() {
    getSquares().forEach(sq => sq.classList.remove('selected', 'possible-move', 'possible-capture'));
    selectedPos = null;
    legalMoves  = [];
}

// ─── Move execution ───────────────────────────────────────────────────────────

function applyMove(fromRow, fromCol, toRow, toCol, moveInfo = {}) {
    const piece  = boardState[fromRow][fromCol];
    const colour = pieceColour(piece);
    const type   = pieceType(piece);

    // En passant: remove the captured pawn
    if (moveInfo.enPassant) boardState[fromRow][toCol] = null;

    // Move the piece
    boardState[toRow][toCol]     = piece;
    boardState[fromRow][fromCol] = null;

    // Castling: move the rook
    if (moveInfo.castling === 'kingSide') {
        boardState[toRow][5] = boardState[toRow][7]; boardState[toRow][7] = null;
    } else if (moveInfo.castling === 'queenSide') {
        boardState[toRow][3] = boardState[toRow][0]; boardState[toRow][0] = null;
    }

    // Update castling rights
    if (type === 'king') { castlingRights[colour].kingSide = false; castlingRights[colour].queenSide = false; }
    if (type === 'rook') {
        const rank = colour === 'white' ? 7 : 0;
        if (fromRow === rank && fromCol === 7) castlingRights[colour].kingSide  = false;
        if (fromRow === rank && fromCol === 0) castlingRights[colour].queenSide = false;
    }
    // If a rook is captured on its starting square, revoke opponent's castling right for that side
    const oppColour = opponent(colour);
    const oppRank   = oppColour === 'white' ? 7 : 0;
    if (toRow === oppRank && toCol === 7) castlingRights[oppColour].kingSide  = false;
    if (toRow === oppRank && toCol === 0) castlingRights[oppColour].queenSide = false;

    // Update en passant target
    enPassantTarget = (type === 'pawn' && Math.abs(toRow - fromRow) === 2)
        ? { row: (fromRow + toRow) / 2, col: toCol }
        : null;

    // Pawn promotion?
    if (type === 'pawn' && (toRow === 0 || toRow === 7)) {
        renderBoard();
        clearSelection();
        showPromotionModal(toRow, toCol, colour);
        return; // turn switch deferred until piece is chosen
    }

    renderBoard();
    clearSelection();
    switchTurn();
    checkGameStatus();
}

// ─── Promotion modal ──────────────────────────────────────────────────────────

function showPromotionModal(row, col, colour) {
    pendingPromotion = { row, col, colour };
    const modal = document.getElementById('promotion-modal');
    const grid  = document.getElementById('promotion-choices');
    grid.innerHTML = '';

    for (const type of ['queen', 'rook', 'bishop', 'knight']) {
        const btn = document.createElement('button');
        btn.className = 'promo-choice';
        btn.title = type.charAt(0).toUpperCase() + type.slice(1);
        const img = document.createElement('img');
        img.src = `assets/${colour}-${type}.png`;
        img.alt = type;
        btn.appendChild(img);
        btn.addEventListener('click', () => finishPromotion(type));
        grid.appendChild(btn);
    }

    modal.classList.remove('hidden');
}

function finishPromotion(type) {
    const { row, col, colour } = pendingPromotion;
    boardState[row][col] = `${colour}-${type}`;
    pendingPromotion = null;
    document.getElementById('promotion-modal').classList.add('hidden');
    renderBoard();
    switchTurn();
    checkGameStatus();
}

// ─── Game status ──────────────────────────────────────────────────────────────

function checkGameStatus() {
    const inCheck    = isInCheck(boardState, currentTurn);
    const hasMoves   = hasAnyLegalMoves(currentTurn);
    const prevColour = opponent(currentTurn);

    if (!hasMoves) {
        gameStatus  = inCheck ? 'checkmate' : 'stalemate';
        gameActive  = false;
        showEndModal(gameStatus, inCheck ? prevColour : null);
        return;
    }

    gameStatus = inCheck ? 'check' : 'playing';
    updateTurnIndicator();
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function switchTurn() {
    currentTurn = opponent(currentTurn);
}

function updateTurnIndicator() {
    let el = document.getElementById('turn-indicator');
    if (!el) {
        el = document.createElement('div');
        el.id = 'turn-indicator';
        document.getElementById('game-container').prepend(el);
    }
    const inCheck = gameStatus === 'check';
    el.className   = currentTurn + (inCheck ? ' in-check' : '');
    el.textContent = inCheck
        ? `${cap(currentTurn)}'s turn — CHECK!`
        : `${cap(currentTurn)}'s turn`;
}

function showEndModal(type, winner) {
    let el = document.getElementById('end-modal');
    if (!el) {
        el = document.createElement('div');
        el.id = 'end-modal';
        el.innerHTML = `<div id="end-card">
            <div id="end-icon"></div>
            <h2 id="end-title"></h2>
            <p  id="end-sub"></p>
            <button id="end-restart">Play Again</button>
        </div>`;
        document.body.appendChild(el);
        document.getElementById('end-restart').addEventListener('click', () => resetGame());
    }
    const icon  = type === 'checkmate' ? '♚' : '½';
    const title = type === 'checkmate'
        ? `${cap(winner)} wins!`
        : 'Stalemate';
    const sub   = type === 'checkmate' ? 'Checkmate' : 'It\'s a draw.';
    document.getElementById('end-icon').textContent  = icon;
    document.getElementById('end-title').textContent = title;
    document.getElementById('end-sub').textContent   = sub;
    el.classList.remove('hidden');
}

function resetGame() {
    // Reset all mutable state
    gameActive       = true;   // skip the splash — game starts immediately
    currentTurn      = 'white';
    selectedPos      = null;
    legalMoves       = [];
    enPassantTarget  = null;
    castlingRights   = { white: { kingSide: true, queenSide: true }, black: { kingSide: true, queenSide: true } };
    gameStatus       = 'playing';
    pendingPromotion = null;

    // Reset board data and re-render
    resetBoardState();
    renderBoard();

    // Hide the end modal
    document.getElementById('end-modal')?.classList.add('hidden');

    // Update the turn indicator
    updateTurnIndicator();
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }