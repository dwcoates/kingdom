(function ()
{
    "use strict";
    
    var main = document.getElementById("main");
    var board_el = document.createElement("div");
    var json_output = document.getElementById("dest");
    var output;

    var boardSize = 300;

    var inputFen = "rnbqk1nr/ppp2ppp/4p3/3p4/1b1PP3/2N5/PPP2PPP/R1BQKBNR w KQkq - 2 4";

    function createBoard(el, fen)
    {
        var board = BOARD(el);
        board.size_board(boardSize, boardSize);
        board.set_board(fen);
        board.wait();
    }

    function update()
    {
        updateFen();
        updateBoard();
        updateJsonOutput();
    }

    function updateBoard()
    {
        createBoard(board_el, inputFen);

        main.appendChild(board_el);
    }

    function updateFen()
    {
        fen = document.getElementById('inputFen').value;
    }

    function updateJsonOutput()
    {
        output = formatOutput();

        json_output.replaceChild(json_output.firstChild, renderjson(output));
    }

    function formatOutput()
    {
        // long bit of test json
        return JSON.parse('{\"Board\":{\"PIECES\":{\"27\":{\"xray2 (d->e)\":9223372036854775808,\"pawns on same color\":85899345920,\"valid fork\":17180917760,\"reachable outposts\":85899345920,\"attacked king squares\":0,\"attacked squares\":18049668782227969,\"partially attacked squares\":18049668782227969}}},\"Scores\":{\"PIECES\":{\"49\":{\"close enemies\":0,\"king safety\":0},\"27\":{\"interferring pawns\":0,\"reachable outpost\":0,\"mobility\":58}},\"TRACE\":{\"Imbalance\":{\"imbalance\":-25},\"Imbalance\":{\"imbalance\":-25},\"Mobility\":{\"mobility\":58},\"Threat\":{\"threat by pawn push\":0,\"hanging threats\":54,\"threat by weak minor\":33},\"Passed\":null,\"Space\":null,\"Total\":null}}}');;
    }

    function init()
    {
        updateBoard();

        output = formatOutput();

        json_output.appendChild(renderjson(output));
    }
    document.getElementById('buttonFen').addEventListener("click", update);
    document.addEventListener("DOMContentLoaded", init);
}());
