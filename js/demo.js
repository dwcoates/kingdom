(function ()
{
    "use strict";
    
    var main = document.getElementById("main");
    var board_el = document.createElement("div");
    var board;
    var json_output = document.getElementById("dest");
    var eval_depth = 12;
    var BIT_LENGTH = 32;
    var recSettings = {NONE: 0, IDEAS : 1, ATTRIBUTES : 2, IDEAS_AND_ATTRIBUTES: 3}
    var engine;
    var output;
    var eval_data = [];
    var boardSize = 400;
    var inputFen = "5rkn/1K4p1/8/2p5/3B4/4p3/8/8 b - - 0 1";
    var jsonRaw=[];

    function createBoard(el, fen)
    {
        board = BOARD(el);
        board.size_board(boardSize, boardSize);
        board.set_board(fen);
        board.wait();
    }

    function decorateBoard(vals)
    {
        function bitboardToArray(bitsets)
        {
            function getBits(integer) {
                var bits = integer.toString(2);
                bits += '0'.repeat(BIT_LENGTH - bits.length);
                return bits;
            }

            // var bits = getBits(bitsets[0]) + getBits(bitsets[1]),
            var arr = [];

            // for (var i = 0; i < bits.length; i++) {
            //     if (bits[i] === "1") {
            //         var x = 7 - (i % 8);
            //         var y = 7 - Math.ceil(i / 8);
            //         arr.push([x, y]);
            //     }
            // }

            for (var i = 0; i < vals.length; i++) {
                if (vals[i] === "1") {
                    var x = 7 - (i % 8);
                    var y = 7 - Math.ceil(i / 8);
                    console.log(x + "," + y + ":" + vals);
                    arr.push([x, y]);
                }
            }

            return arr;
        }

        function highlightBoard(board, locations) {
            for (var i = 0; i < locations.length; i++) {
                board.highlight_square(locations[i][1], locations[i][0], "red"); // y, x
            }
        }

        for (var x=0; x<8; x++) {
            for (var y=0; y<8; y++)
                board.remove_highlight(y, x);
        }

        var squares = bitboardToArray(vals);

        highlightBoard(board, squares);
    }

    function update()
    {
        updateFen();
        updateEngine();
        updateBoard();
        updateJsonOutput();
    }

    function updateEngine()
    {
        function eval_pos()
        {

            /// If we are in the middle of an eval, stop it and do the latest one.
            if (engine.busy) {
                engine.stop = true;
                return engine.send("stop");
            }

            engine.stop = false;
            engine.busy = true;

            eval_data = [];

            engine.send("position " + inputFen);
            engine.send("setoption name Record value " + recSettings.IDEAS_AND_ATTRIBUTES);
            engine.send("go depth " + eval_depth, function ongo(str)
                        {
                            var matches = str.match(/^bestmove\s(\S+)(?:\sponder\s(\S+))?/);

                            // rec best move matches[0]

                            engine.busy = false;
                            G.events.trigger("evaled", {ply: 0});
                        }, function stream(str)
                        {
                            var matches = str.match(/depth (\d+) .*score (cp|mate) ([-\d]+) .*pv (.+)/),
                                score,
                                type,
                                depth,
                                pv,
                                data;

                            if (matches) {
                                depth = Number(matches[1]);
                                type = matches[2];
                                score = Number(matches[3]);
                                pv = matches[4].split(" ");

                                data = {score: score, type: type, depth: depth, pv: pv} ;
                            } else {
                                if (/score mate 0\b/.test(str)) {
                                    data = {score: 0, type: "mate", depth: 0};
                                }
                            }

                            if (data) {
                                data.ply = 0;
                                data.turn = 0;
                                eval_data.push(data);
                            }
                        });
        }

        eval_pos();

        engine.send("fetch json search", formatOutput, function (line)
                    {
                        jsonRaw.push(line);
                    });
    }

    function updateBoard()
    {
        createBoard(board_el, inputFen);
        main.appendChild(board_el);
    }

    function updateFen()
    {
        var newFen = document.getElementById('inputFen').value;
        if (newFen !== "") {
            inputFen = newFen;
        }
    }

    function formatOutput(str)
    {
        // temp
        console.log(str.substr(0,10) + " . . . " + str.substr(str.length-11, str.length-10));

        output = renderjson(JSON.parse(str));
        json_output.appendChild(output);
    }

    function updateJsonOutput()
    {
        //
    }

    function load_engine()
    {
        var worker = new Worker("js/stockfish.js"),
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
            } else if (first_word === "assess") {
                cmd_type = "fetch";
            } else {
                /// eval and d are more difficult.
                cmd_type = "other";
            }

            len = que.length;

            for (i = 0; i < len; i += 1) {
                cmd_first_word = get_first_word(que[i].cmd);
                if (cmd_first_word === cmd_type || (cmd_type === "other" && (cmd_first_word === "d" || cmd_first_word === "eval" || cmd_first_word === "fetch"))) {
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
            } else if (line.indexOf("***ASSESSMENT END***") !== -1) {
                // json
                done = true;
                engine.ready = true;
                my_que.message = jsonRaw.slice(0, jsonRaw.length-1).join();
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
        createBoard(board_el, inputFen);
        main.appendChild(board_el);

        engine = load_engine();

        // JSON
        renderjson.set_replacer(function(k,v) {
            var obj_from_dom = function (el) {
                if (el.nodeType == el.TEXT_NODE)
                    return el.data;
                var attributes="";
                if (el.attributes)
                    for (var i=0; i<el.attributes.length; i++)
                        attributes += " "+el.attributes.item(i).name + "=\"" + el.attributes.item(i).value + "\"";
                var obj = {};
                obj["<"+el.tagName+attributes+">"] = Array.prototype.map.call(el.childNodes, obj_from_dom);
                return obj;
            };
            if (v === window) return "<window>";
            if (v === document) return "<document>";
            if (typeof(v) == "number") {
                //alert('buton')

            }
            if (Array.isArray(v)) {
                // var button = document.createElement("BUTTON")
                // button.setAttribute("id", v+k); // temp
                // button.innerHTML = k;
                // button.setAttribute("tagName", "button"); // temp
                // button.addEventListener("click", function()
                //                         {
                //                             decorateBoard(v);
                //                             updateBoard();
                //                         });
                // return button;
            }
            if (typeof(v) == "string" && /^[01]+$/.test(v)) {
                var button = document.createElement("BUTTON")
                button.setAttribute("id", v+k); // temp
                button.innerHTML = k;
                button.setAttribute("tagName", "button"); // temp
                button.addEventListener("click", function()
                                        {
                                            decorateBoard(v);
                                            updateBoard();
                                        });
                return button;
            }
            if (typeof(v) == "object" && v && "nodeType" in v) return obj_from_dom(v);
            else return v;
        });

        // ENGINE
        engine.send("uci", function onuci(str)
                    {
                        engine.send("isready", function onuci(str)
                                   {
                                       engine.send("setoption name Record value 3");
                                   });
                    });
    }
    document.getElementById('buttonFen').addEventListener("click", update);
    document.addEventListener("DOMContentLoaded", init);
}());
