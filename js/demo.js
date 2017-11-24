(function ()
{
    "use strict";
    
    var main = document.getElementById("main");
    var board_el = document.createElement("div");
    var json_output = document.getElementById("dest");
    var output;

    var boardSize = 400;

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
        alert("updated"); // test
    }

    function updateBoard()
    {
        createBoard(board_el, inputFen);

        main.appendChild(board_el);
    }

    function updateFen()
    {
        inputFen = document.getElementById('inputFen').value;
    }

    function updateJsonOutput()
    {
        output = formatOutput();

        json_output.replaceChild(json_output.firstChild.value, renderjson(output)); // value?
    }

    function formatOutput()
    {
        // long bit of test json
        return JSON.parse('{\"Board\":{\"PIECES\":{\"27\":{\"xray2 (d->e)\":9223372036854775808,\"pawns on same color\":85899345920,\"valid fork\":17180917760,\"reachable outposts\":85899345920,\"attacked king squares\":0,\"attacked squares\":18049668782227969,\"partially attacked squares\":18049668782227969}}},\"Scores\":{\"PIECES\":{\"49\":{\"close enemies\":0,\"king safety\":0},\"27\":{\"interferring pawns\":0,\"reachable outpost\":0,\"mobility\":58}},\"TRACE\":{\"Imbalance\":{\"imbalance\":-25},\"Imbalance\":{\"imbalance\":-25},\"Mobility\":{\"mobility\":58},\"Threat\":{\"threat by pawn push\":0,\"hanging threats\":54,\"threat by weak minor\":33},\"Passed\":null,\"Space\":null,\"Total\":null}}}');;
    }

        function load_engine()
    {
        var worker = new Worker("js/stockfish6.js"),
            engine = {started: Date.now()},
            que = [];

        function get_first_word(line)
        {
            var space_index = line.indexOf(" ");

            /// If there are no spaces, send the whole line.
            if (space_index === -1) {
                return line;
            }
            return line.substr(0, space_index);
        }

        function determine_que_num(line, que)
        {
            var cmd_type,
                first_word = get_first_word(line),
                cmd_first_word,
                i,
                len;

            if (first_word === "uciok" || first_word === "option") {
                cmd_type = "uci"
            } else if (first_word === "readyok") {
                cmd_type = "isready";
            } else if (first_word === "bestmove" || first_word === "info") {
                cmd_type = "go";
            } else {
                /// eval and d are more difficult.
                cmd_type = "other";
            }

            len = que.length;

            for (i = 0; i < len; i += 1) {
                cmd_first_word = get_first_word(que[i].cmd);
                if (cmd_first_word === cmd_type || (cmd_type === "other" && (cmd_first_word === "d" || cmd_first_word === "eval"))) {
                    return i;
                }
            }

            /// Not sure; just go with the first one.
            return 0;
        }

        worker.onmessage = function (e)
        {
            var line = e.data,
                done,
                que_num = 0,
                my_que;

            /// Stream everything to this, even invalid lines.
            if (engine.stream) {
                engine.stream(line);
            }

            /// Ignore invalid setoption commands since valid ones do not repond.
            if (line.substr(0, 14) === "No such option") {
                return;
            }

            que_num = determine_que_num(line, que);

            my_que = que[que_num];

            if (!my_que) {
                return;
            }

            if (my_que.stream) {
                my_que.stream(line);
            }

            if (typeof my_que.message === "undefined") {
                my_que.message = "";
            } else if (my_que.message !== "") {
                my_que.message += "\n";
            }

            my_que.message += line;

            /// Try to determine if the stream is done.
            if (line === "uciok") {
                /// uci
                done = true;
                engine.loaded = true;
            } else if (line === "readyok") {
                /// isready
                done = true;
                engine.ready = true;
            } else if (line.substr(0, 8) === "bestmove") {
                /// go [...]
                done = true;
                /// All "go" needs is the last line (use stream to get more)
                my_que.message = line;
            } else if (my_que.cmd === "d" && line.substr(0, 15) === "Legal uci moves") {
                done = true;
            } else if (my_que.cmd === "eval" && /Total Evaluation[\s\S]+\n$/.test(my_que.message)) {
                done = true;
            } else if (line.substr(0, 15) === "Unknown command") {
                done = true;
            }
            ///NOTE: Stockfish.js does not support the "debug" or "register" commands.
            ///TODO: Add support for "perft", "bench", and "key" commands.
            ///TODO: Get welcome message so that it does not get caught with other messages.
            ///TODO: Prevent (or handle) multiple messages from different commands
            ///      E.g., "go depth 20" followed later by "uci"

            if (done) {
                if (my_que.cb && !my_que.discard) {
                    my_que.cb(my_que.message);
                }

                /// Remove this from the que.
                G.array_remove(que, que_num);
            }
        };

        engine.send = function send(cmd, cb, stream)
        {
            cmd = String(cmd).trim();

            ///TODO: Destroy the engine.
            if (cmd === "quit") {
                return;
            }

            /// Only add a que for commands that always print.
            ///NOTE: setoption may or may not print a statement.
            if (cmd !== "ucinewgame" && cmd !== "flip" && cmd !== "stop" && cmd !== "ponderhit" && cmd.substr(0, 8) !== "position"  && cmd.substr(0, 9) !== "setoption") {
                que[que.length] = {
                    cmd: cmd,
                    cb: cb,
                    stream: stream
                };
            }

            worker.postMessage(cmd);
        };

        engine.stop_moves = function stop_moves()
        {
            var i,
                len = que.length;

            for (i = 0; i < len; i += 1) {
                if (debugging) {
                    console.log(i, get_first_word(que[i].cmd))
                }
                /// We found a move that has not been stopped yet.
                if (get_first_word(que[i].cmd) === "go" && !que[i].discard) {
                    engine.send("stop");
                    que[i].discard = true;
                }
            }
        }

        engine.get_cue_len = function get_cue_len()
        {
            return que.length;
        }

        return engine;
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
