/**
 * board.js
 * Owns the canonical 8×8 board-state array and renders it to the DOM.
 */

import { posToIndex } from './utils.js';

// ─── Board State ─────────────────────────────────────────────────────────────

/** Live 8×8 grid. null = empty; strings like 'white-pawn' for pieces. */
export const boardState = [
    ['black-rook', 'black-knight', 'black-bishop', 'black-queen', 'black-king', 'black-bishop', 'black-knight', 'black-rook'],
    ['black-pawn', 'black-pawn',   'black-pawn',   'black-pawn',  'black-pawn', 'black-pawn',   'black-pawn',   'black-pawn'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['white-pawn', 'white-pawn',   'white-pawn',   'white-pawn',  'white-pawn', 'white-pawn',   'white-pawn',   'white-pawn'],
    ['white-rook', 'white-knight', 'white-bishop',  'white-queen', 'white-king', 'white-bishop', 'white-knight', 'white-rook'],
];

const files = ['a','b','c','d','e','f','g','h'];
const ranks = ['8','7','6','5','4','3','2','1'];

// ─── Render ───────────────────────────────────────────────────────────────────

/**
 * Re-renders the entire board from `boardState`.
 * Preserves the click listeners that main.js attaches to each square.
 */
export function renderBoard() {
    const boardElement = document.getElementById('chess-board');
    boardElement.innerHTML = '';

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.classList.add('square');
            square.classList.add((row + col) % 2 === 0 ? 'light' : 'dark');
            square.dataset.row = row;
            square.dataset.col = col;

            // Piece image
            const pieceName = boardState[row][col];
            if (pieceName) {
                const pieceImg = document.createElement('img');
                pieceImg.src = `assets/${pieceName}.png`;
                pieceImg.classList.add('piece');
                pieceImg.draggable = false; // clicks only; prevents browser drag ghost
                square.appendChild(pieceImg);
            }

            // Rank label (left edge)
            if (col === 0) {
                const rankLabel = document.createElement('span');
                rankLabel.innerText = ranks[row];
                rankLabel.className = 'coordinate rank';
                square.appendChild(rankLabel);
            }

            // File label (bottom edge)
            if (row === 7) {
                const fileLabel = document.createElement('span');
                fileLabel.innerText = files[col];
                fileLabel.className = 'coordinate file';
                square.appendChild(fileLabel);
            }

            boardElement.appendChild(square);
        }
    }
}

/** Convenience alias used on first load. */
export function createBoard() {
    renderBoard();
}

const INITIAL_LAYOUT = [
    ['black-rook', 'black-knight', 'black-bishop', 'black-queen', 'black-king', 'black-bishop', 'black-knight', 'black-rook'],
    ['black-pawn', 'black-pawn',   'black-pawn',   'black-pawn',  'black-pawn', 'black-pawn',   'black-pawn',   'black-pawn'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['white-pawn', 'white-pawn',   'white-pawn',   'white-pawn',  'white-pawn', 'white-pawn',   'white-pawn',   'white-pawn'],
    ['white-rook', 'white-knight', 'white-bishop',  'white-queen', 'white-king', 'white-bishop', 'white-knight', 'white-rook'],
];

/** Mutates boardState back to the starting position in-place. */
export function resetBoardState() {
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
            boardState[r][c] = INITIAL_LAYOUT[r][c];
}
