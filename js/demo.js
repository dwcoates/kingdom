(function ()
{
    "use strict";
    
    var main = document.getElementById("main");
    var board = document.createElement("div");

    var boardSize = 300;

    var fen = "rnbqk1nr/ppp2ppp/4p3/3p4/1b1PP3/2N5/PPP2PPP/R1BQKBNR w KQkq - 2 4";

    function createBoard(el, fen)
    {
        var board = BOARD(el);
        board.size_board(boardSize, boardSize);
        board.set_board(fen);
        board.wait();
    }

    function init()
    {
        createBoard(board, fen);

        main.appendChild(board);
    }
    
    document.addEventListener("DOMContentLoaded", init);
}());
