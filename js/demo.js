(function ()
{
    "use strict";
    
    var main = document.getElementById("main");
    var board_el = document.createElement("div");
    var json_el = document.getElementById("dest");
    var BIT_LENGTH = 32;
    var ASSESS_TAG = "assess ";
    var REC_SETTINGS = {NONE: 0, IDEAS : 1, ATTRIBUTES : 2, IDEAS_AND_ATTRIBUTES: 3};
    var JSON_SHOW_LEVEL = 5;
    var board;
    var boardSize = 400;
    var engine;
    var eval_depth = 12;
    var eval_data = [];
    var inputFenStr = "5rkn/1K4p1/8/2p5/3B4/4p3/8/8 b - - 0 1";
    var jsonRaw=[];
    var moveData=[];

    // testing flags
    var TEST_BITMAPS=false;

    function createBoard(el, fen)
    {
        board = BOARD(el);
        board.size_board(boardSize, boardSize);
        board.set_board(fen !== "startpos" ? fen : null);
        board.wait();
    }

    function decorateBoard(vals)
    {
        function bitboardToArray(bitsets)
        {
            var arr = [];

            // string representation of bitboard
            if (typeof(bitsets) == "string") {
                for (var i = 0; i < bitsets.length; i++) {
                    if (bitsets[i] === "1") {
                        var x = 7 - (i % 8);
                        var y = 7 - Math.ceil(i / 8);
                        arr.push([x, y]);
                    }
                }
            // partitioned 64-bit integer representation of bitboard
            } else if (Array.isArray(bitsets)) {
                function getBits(integer) {
                    var bits = integer.toString(2);
                    bits += '0'.repeat(BIT_LENGTH - bits.length);
                    return bits;
                }
                var bits = getBits(bitsets[0]) + getBits(bitsets[1]);
                for (var i = 0; i < bits.length; i++) {
                    if (bits[i] === "1") {
                        var x = 7 - (i % 8);
                        var y = 7 - Math.ceil(i / 8);
                        arr.push([x, y]);
                    }
                }
            }

            return arr;
        }

        function highlightBoard(board, locations) {
            for (var i = 0; i < locations.length; i++) {
                board.highlight_square(locations[i][1], locations[i][0], "red"); // highlight_square(y, x)
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
        updateData();
        updateEngine();
        updateBoard();
        updateJsonOutput();
    }

    function updateData()
    {
        function updateDepth()
        {
            var newDepth = document.getElementById('searchDepth').value;
            if (newDepth !== "") {
                newDepth = parseInt(newDepth);
                eval_depth = newDepth;
            }
        }

        function updateFen()
        {
            var newFen = document.getElementById('inputFen').value;
            if (newFen !== "") {
                inputFenStr = newFen;
            }
        }

        updateFen();
        updateDepth();
    }

    function get_pos_cmd()
    {
        return "position " + (inputFenStr === "startpos" ? "" : "fen ") + inputFenStr;
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
            jsonRaw = [];

            engine.send("ucinewgame");
            engine.send(get_pos_cmd());
            engine.send("go depth " + eval_depth, function ongo(str)
                        {
                            var matches = str.match(/^bestmove\s(\S+)(?:\sponder\s(\S+))?/);

                            engine.busy = false;
                            G.events.trigger("evaled", {ply: 0});

                            // fetch
                            engine.send("fetch json search", formatOutput, function (line)
                                        {
                                            jsonRaw.push(line.substring(ASSESS_TAG.length));
                                        });
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
                        }
                       );
        }

        eval_pos();
    }

    function updateBoard(cb)
    {
        createBoard(board_el, inputFenStr);
        if (cb) cb();
        main.appendChild(board_el);
    }

    function showJson(move) {
        for (var m in moveData) {
            if (moveData[move].style.display === "none") {
                moveData[move].style.display = "block";
            } else {
                moveData[move].style.display = "none";
            }
        }
    }

    function showMove(move) {
        function square_to_pair(sq) {
            var file = sq.charCodeAt(0)-65,
                rank = parseInt(sq[1])-1;
            return {file : file, rank : rank};
        }

        var from = square_to_pair(move.substr(0,2)),
            to = square_to_pair(move.substr(2,2));
        board.arrow_manager.draw(from.rank, from.file, to.rank, to.file, board.color_values[board.highlight_colors.indexOf("red")]);
    }

    function formatOutput(str)
    {
        moveData=[];
        var objs = JSON.parse(str);

        while (json_el.firstChild) {
            json_el.removeChild(json_el.firstChild);
        }

        for (var obj in objs) {
            var i = moveData.length,
                div = document.createElement("div"),
                button = document.createElement("BUTTON");

            moveData[obj] = renderjson(objs[obj]);

            button.setAttribute("id", obj); // not unique id
            button.innerHTML = obj;
            button.setAttribute("tagName", "button"); // ?
            button.addEventListener("click", function()
                                    {
                                        showMove(obj);
                                    });


            div.appendChild(button);
            div.appendChild(moveData[obj]);

            json_el.appendChild(div);
        }
    }

    function updateJsonOutput()
    {
        // no implement
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
            } else if (first_word === "assess" || line === "***ASSESSMENT END***") {
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
                my_que.message = jsonRaw.slice(0, jsonRaw.length-1).join("");
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
        createBoard(board_el, inputFenStr);
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

            }
            if (typeof(v) == "string") {
                // binary string
                if (/^[01]+$/.test(v)) {
                    var button = document.createElement("BUTTON")
                    button.setAttribute("id", v+k); // temp
                    button.innerHTML = k;
                    button.setAttribute("tagName", "button"); // temp
                    button.addEventListener("click", function()
                                            {
                                                console.log(v);
                                                decorateBoard(v);
                                            });
                    return button;
                }
                // move
                if (/([A-Z][0-9][A-Z][0-9])/.test(v)) {
                    alert('move');
                }
            }
            if (typeof(v) == "object" && v && "nodeType" in v) return obj_from_dom(v);
            else return v;
        });
        renderjson.set_show_to_level(JSON_SHOW_LEVEL);

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
    document.getElementById('searchDepth').addEventListener("keypress", function (evt)
                                                          {
                                                              var theEvent = evt || window.event;
                                                              var key = theEvent.keyCode || theEvent.which;
                                                              if ((key < 48 || key > 57) &&
                                                                  !(key == 8 || key == 9 || key == 13) ) {
                                                                  theEvent.returnValue = false;
                                                                  if (theEvent.preventDefault) theEvent.preventDefault();
                                                              }
                                                          }
                                                           );
    document.addEventListener("DOMContentLoaded", init);
}());
