/**
 * pieces.js — Pseudo-legal move generators (no check filtering).
 *
 * getLegalMoves(board, row, col, gameState)
 *   gameState: { enPassantTarget: {row,col} | null }
 *
 * Moves may carry extra metadata flags:
 *   { row, col, enPassant: true }   – en-passant pawn capture
 */

import { isInBounds, pieceColour, pieceType } from './utils.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slide(board, row, col, colour, directions) {
    const moves = [];
    for (const [dr, dc] of directions) {
        let r = row + dr, c = col + dc;
        while (isInBounds(r, c)) {
            const target = board[r][c];
            if (target === null) {
                moves.push({ row: r, col: c });
            } else {
                if (pieceColour(target) !== colour) moves.push({ row: r, col: c });
                break;
            }
            r += dr; c += dc;
        }
    }
    return moves;
}

function step(board, row, col, colour, offsets) {
    const moves = [];
    for (const [dr, dc] of offsets) {
        const r = row + dr, c = col + dc;
        if (isInBounds(r, c) && pieceColour(board[r][c]) !== colour)
            moves.push({ row: r, col: c });
    }
    return moves;
}

// ─── Per-piece generators ─────────────────────────────────────────────────────

function pawnMoves(board, row, col, colour, enPassantTarget) {
    const moves = [];
    const dir   = colour === 'white' ? -1 : 1;
    const start = colour === 'white' ? 6 : 1;

    // Forward one
    const r1 = row + dir;
    if (isInBounds(r1, col) && board[r1][col] === null) {
        moves.push({ row: r1, col });
        // Forward two from starting rank
        const r2 = row + dir * 2;
        if (row === start && isInBounds(r2, col) && board[r2][col] === null)
            moves.push({ row: r2, col });
    }

    // Diagonal captures
    for (const dc of [-1, 1]) {
        const cr = row + dir, cc = col + dc;
        if (isInBounds(cr, cc) && board[cr][cc] !== null && pieceColour(board[cr][cc]) !== colour)
            moves.push({ row: cr, col: cc });
    }

    // En passant
    if (enPassantTarget) {
        const { row: epR, col: epC } = enPassantTarget;
        if (epR === row + dir && Math.abs(epC - col) === 1)
            moves.push({ row: epR, col: epC, enPassant: true });
    }

    return moves;
}

function rookMoves(board, row, col, colour) {
    return slide(board, row, col, colour, [[-1,0],[1,0],[0,-1],[0,1]]);
}

function knightMoves(board, row, col, colour) {
    return step(board, row, col, colour, [
        [-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]
    ]);
}

function bishopMoves(board, row, col, colour) {
    return slide(board, row, col, colour, [[-1,-1],[-1,1],[1,-1],[1,1]]);
}

function queenMoves(board, row, col, colour) {
    return slide(board, row, col, colour, [
        [-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]
    ]);
}

function kingMoves(board, row, col, colour) {
    return step(board, row, col, colour, [
        [-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]
    ]);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Pseudo-legal moves for the piece at [row, col].
 * Pass gameState = { enPassantTarget } for pawns.
 */
export function getLegalMoves(board, row, col, gameState = {}) {
    const piece = board[row][col];
    if (!piece) return [];
    const colour = pieceColour(piece);
    const type   = pieceType(piece);
    const ep     = gameState.enPassantTarget ?? null;

    switch (type) {
        case 'pawn':   return pawnMoves  (board, row, col, colour, ep);
        case 'rook':   return rookMoves  (board, row, col, colour);
        case 'knight': return knightMoves(board, row, col, colour);
        case 'bishop': return bishopMoves(board, row, col, colour);
        case 'queen':  return queenMoves (board, row, col, colour);
        case 'king':   return kingMoves  (board, row, col, colour);
        default:       return [];
    }
}
