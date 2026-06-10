/**
 * utils.js — Pure helpers, no DOM side-effects, no game state.
 */

export function isInBounds(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
}

export function pieceColour(pieceName) {
    if (!pieceName) return null;
    return pieceName.startsWith('white') ? 'white' : 'black';
}

export function pieceType(pieceName) {
    if (!pieceName) return null;
    return pieceName.split('-')[1];
}

export function posToIndex(row, col) {
    return row * 8 + col;
}

export function getSquare(row, col) {
    return document.querySelectorAll('.square')[posToIndex(row, col)] ?? null;
}

export function getSquares() {
    return Array.from(document.querySelectorAll('.square'));
}

/** Deep-clone the 8×8 board array. */
export function cloneBoard(board) {
    return board.map(row => [...row]);
}

export function opponent(colour) {
    return colour === 'white' ? 'black' : 'white';
}
