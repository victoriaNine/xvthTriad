define([
    "underscore",
    "backbone",
    "global",
    "models/model_card",
    "models/model_player",
    "models/model_ai"
], function Model_Game (_, Backbone, _$, Model_Card, Model_Player, Model_AI) {
    const BOARD_SIZE      = 9;
    const MAX_ELEMENTS    = 5;
    const ELEMENTS        = ["fire", "ice", "water", "thunder", "rock", "wind", "poison", "light", "dark"];
    const WALL_VALUE      = 10;
    const FLIP_RULE_ORDER = ["basic", "sameWall", "same", "plus", "combo"];
    const OPPOSING_SIDE   = {
        top    : "bottom",
        right  : "left",
        bottom : "top",
        left   : "right"
    };

    return Backbone.Model.extend({
        defaults : {
            type          : "solo",
            difficulty    : "easy",
            rules         : setRules(),
            players       : {},
            winner        : null,
            board         : {
                "case11" : null,
                "case21" : null,
                "case31" : null,
                "case12" : null,
                "case22" : null,
                "case32" : null,
                "case13" : null,
                "case23" : null,
                "case33" : null
            },
            elementBoard  : null,
            playing       : null,
            playedCards   : [],
            cardsToPickCount  : null,
            originalDecks : {
                user     : [],
                opponent : []
            },
            computer      : null,
            turnNumber    : -1,
            role          : null,
            roundNumber   : 0,
            isRanked      : false
        },

        initialize,
        setupComputer,
        placeCard,
        setupNextTurn,
        setupEndGame,
        updateUserAlbum,
        promptOpponentAction,
        resetCardAttributes,
        destroy
    });

    function initialize (attributes, options = {}) {
        var players  = options.players;
        var userDeck = options.userDeck;
        var computer = options.computer;
        var opponent = options.opponent;

        this.set("rules", setRules(options.rules));
        if (options.roundNumber) {
            this.set("roundNumber", options.roundNumber);
        }

        // In case of a new round for a game with the sudden death rule,
        // Use the players passed in the options
        if (players) {
            this.set("players", players);
            if (this.get("type") === "solo") {
                this.set("computer", computer).get("computer").AI = new Model_AI({ game: this, level: this.get("difficulty") });
            }
        } else {
            if (this.get("type") === "solo") {
                this.set("computer", this.setupComputer());
                this.set({ players :
                    {
                        user     : new Model_Player({
                            type   : "human",
                            user   : _$.state.user,
                            name   : _$.state.user.get("name"),
                            avatar : _$.state.user.get("avatar"),
                            deck   : userDeck
                        }),
                        opponent : new Model_Player({
                            type   : "computer",
                            user   : null,
                            name   : this.get("computer").name,
                            avatar : this.get("computer").avatar,
                            deck   : this.get("computer").deck
                        })
                    }
                });
            } else if (this.get("type") === "versus") {
                var opponentDeck = _.map(opponent.deck, function (attributes) {
                    return new Model_Card(attributes);
                });

                this.set({ players :
                    {
                        user     : new Model_Player({
                            type       : "human",
                            user       : _$.state.user,
                            name       : _$.state.user.get("name"),
                            avatar     : _$.state.user.get("avatar"),
                            rankPoints : _$.state.user.get("rankPoints"),
                            deck       : userDeck
                        }),
                        opponent : new Model_Player({
                            type       : "human",
                            user       : opponent,
                            name       : opponent.name,
                            avatar     : opponent.avatar,
                            rankPoints : opponent.rankPoints,
                            deck       : opponentDeck
                        })
                    }
                });
            }
        }

        _.each(this.get("players").user.get("deck"), (card, index) => {
            card.set("deckIndex", index);

            if (!card.get("owner")) {
                card.set("owner", this.get("players").user);
                card.set("currentOwner", this.get("players").user);
                this.get("originalDecks").user.push(card);
            } else {
                if (card.get("owner") === this.get("players").user) {
                    this.get("originalDecks").user.push(card);
                } else if (card.get("owner") === this.get("players").opponent) {
                    this.get("originalDecks").opponent.push(card);
                }
            }
        });

        _.each(this.get("players").opponent.get("deck"), (card, index) => {
            card.set("deckIndex", index);

            if (!card.get("owner")) {
                card.set("owner", this.get("players").opponent);
                card.set("currentOwner", this.get("players").opponent);
                this.get("originalDecks").opponent.push(card);
            } else {
                if (card.get("owner") === this.get("players").user) {
                    this.get("originalDecks").user.push(card);
                } else if (card.get("owner") === this.get("players").opponent) {
                    this.get("originalDecks").opponent.push(card);
                }
            }
        });

        if (this.get("role") === "emitter") {
            _$.comm.socketManager.emit("roundReset");
        }

        if (this.get("rules").elemental) {
            if (this.get("type") === "solo" || this.get("role") === "emitter") {
                var randomCase;
                var randomElement;
                var elementsCount = _.random(1, MAX_ELEMENTS);
                this.set("elementBoard", _.clone(this.get("board")));

                for (var i = 0, ii = elementsCount; i < ii; i++) {
                    do {
                        randomCase = _.random(0, BOARD_SIZE - 1);
                    } while (this.get("elementBoard")[_.keys(this.get("elementBoard"))[randomCase]]);

                    randomElement = _.random(0, ELEMENTS.length - 1);
                    this.get("elementBoard")[_.keys(this.get("elementBoard"))[randomCase]] = ELEMENTS[randomElement];
                }

                if (this.get("role") === "emitter") {
                    _$.comm.socketManager.emit("setElementBoard", this.get("elementBoard"));
                }

                proceed.call(this);
            } else if (this.get("role") === "receiver") {
                _$.events.on("getElementBoard", (event, data) => {
                    var elementBoard = data.msg;

                    if (elementBoard) {
                        _$.events.off("getElementBoard");
                        this.set("elementBoard", elementBoard);

                        proceed.call(this);
                    }
                });

                _$.comm.socketManager.emit("getElementBoard");
            }
        } else {
            proceed.call(this);
        }

        function proceed () {
            if (this.get("rules").elemental) {
                _$.events.trigger("boardSet");
            }

            this.setupNextTurn(() => {
                _$.events.trigger("firstPlayerSet");
            });
        }
    }

    function setupComputer () {
        var config = {};
        var cardMinLevel;
        var cardMaxLevel;
        var randomCards;

        switch (this.get("difficulty")) {
            case "easy":
                config.name   = "Carbuncle";
                config.avatar = _$.assets.get("img.avatars.computer_carbuncle").src;
                cardMinLevel  = 1;
                cardMaxLevel  = 1;
                break;
            case "normal":
                config.name   = "Gentiana";
                config.avatar = _$.assets.get("img.avatars.computer_gentiana").src;
                cardMinLevel  = 1;
                cardMaxLevel  = 2;
                break;
            case "hard":
                config.name   = "Bahamut";
                config.avatar = _$.assets.get("img.avatars.computer_bahamut").src;
                cardMinLevel  = 1;
                cardMaxLevel  = 3;
                break;
        }

        randomCards = _$.utils.getRandomCards({
            amount   : _$.state.DECK_SIZE,
            minLevel : cardMinLevel,
            maxLevel : cardMaxLevel
        });

        config.deck = _.map(randomCards, function (attributes) {
            return new Model_Card(attributes);
        });

        config.AI   = new Model_AI({ game: this, level: this.get("difficulty") });

        return config;
    }

    function setRules (rules = {}) {
        if (rules.trade && !rules.trade.match("none|one|difference|direct|all")) {
            _$.debug.error("Invalid Trade rule: " + rules.trade);
            rules.trade = null;
        }

        return _.defaults(rules, {
            open        : true,
            random      : false,
            same        : false,
            sameWall    : false,
            plus        : false,
            elemental   : false,
            suddenDeath : false,
            trade       : "none"
        });
    }

    function placeCard (newCard, position, simulation, simulationCallback) {
        var isSimulatedTurn = !!simulation;
        var playedCards     = isSimulatedTurn ? simulation.playedCards : this.get("playedCards");
        var user            = isSimulatedTurn ? simulation.user : this.get("players").user;
        var opponent        = isSimulatedTurn ? simulation.computer : this.get("players").opponent;
        var playing         = isSimulatedTurn ? simulation.playing : this.get("playing");
        var board           = isSimulatedTurn ? simulation.board : this.get("board");

        if (this.get("type") === "versus" && playing === user) {
            _$.comm.socketManager.emit("setPlayerAction", {
                deckIndex  : newCard.get("deckIndex"),
                position,
                turnNumber : this.get("turnNumber")
            });
        }

        newCard.set("position", position);
        board[_$.utils.getCaseNameFromPosition(newCard.get("position"))] = newCard;
        playedCards.push(newCard);

        //_$.debug.log(isSimulatedTurn ? "=== (AI SIMULATION) NEW TURN ===" : "=== NEW TURN ===");
        //_$.debug.log(playing.get("name"), "placed card", newCard.get("name"), "(deck card n°" + newCard.get("deckIndex") + ") at", position.x + "," + position.y + ".");

        var adjacentCards      = getAdjacentCards(newCard, playedCards);
        var adjacentCardsCount = _.keys(adjacentCards).length;
        var sameWallMatches    = isSameWallMatch(newCard, this.get("rules").sameWall);
        var flippedCards       = [];
        var orderedFlipCards   = [];
        var bypassPlusRule     = false;

        // ELEMENTAL RULE
        if (this.get("rules").elemental) {
            let caseName = _$.utils.getCaseNameFromPosition(newCard.get("position"));
            let element  = this.get("elementBoard")[caseName];

            if (element) {
                if (element === newCard.get("element")) {
                    newCard.set("bonus", newCard.get("bonus") + 1);
                    if (!isSimulatedTurn) { _$.events.trigger("showElementalBonus", { caseName, bonusType: "bonus" }); }
                } else {
                    newCard.set("bonus", newCard.get("bonus") - 1);
                    if (!isSimulatedTurn) { _$.events.trigger("showElementalBonus", { caseName, bonusType: "penalty" }); }
                }
            }
        }

        if (!adjacentCardsCount) {
            toNextPhase.call(this);
            return;
        }

        // SAME & SAME WALL RULES
        if ((this.get("rules").same && adjacentCardsCount >= 2) || (sameWallMatches && adjacentCardsCount >= 1)) {
            let sameWallMatchesCount         = sameWallMatches ? _.keys(sameWallMatches).length : 0;
            let sameTargetCardsCount         = 0;
            let sameTargetOpponentCardsCount = 0;
            let sameTargetOpponentCards      = {};

            _.each(adjacentCards, function (card, side) {
                if (newCard.get("ranks")[side] === card.get("ranks")[OPPOSING_SIDE[side]]) {
                    sameTargetCardsCount++;

                    if (card.get("currentOwner") !== newCard.get("currentOwner")) {
                        sameTargetOpponentCards[side] = card;
                        sameTargetOpponentCardsCount++;
                    }
                }
            });

            // If there are at least two cards (or walls, if the Same Wall rule is in effect) matching the Same rule
            // And at least one match is a card belonging to the opponent
            if ((sameTargetCardsCount + sameWallMatchesCount) >= 2 && sameTargetOpponentCardsCount >= 1) {
                let sameWallHasBeenUsed = sameWallMatchesCount >= sameTargetCardsCount;

                // We flip the opponent's cards captured by the rule
                _.each(sameTargetOpponentCards, function (card, side) {
                    let caseName = _$.utils.getCaseNameFromPosition(card.get("position"));
                    flipCard(card, caseName, OPPOSING_SIDE[side], { flipRule: sameWallHasBeenUsed ? "sameWall" : "same", checkCombos: true });
                });

                // If the Same rule has been applied, bypass the Plus rule
                bypassPlusRule = true;
            }
        }

        // PLUS RULE
        if (this.get("rules").plus && !bypassPlusRule && adjacentCardsCount >= 2) {
            let plusTargetCardsCount         = 0;
            let plusTargetOpponentCardsCount = 0;
            let plusTargetOpponentCards      = {};
            let sums                         = {};

            _.each(adjacentCards, function (card, side) {
                sums[side] = newCard.get("ranks")[side] + card.get("ranks")[OPPOSING_SIDE[side]];
            });

            _.each(adjacentCards, function (card, side) {
                let sum = newCard.get("ranks")[side] + card.get("ranks")[OPPOSING_SIDE[side]];

                if (_.filter(sums, (s) => s === sum).length >= 2) {
                    plusTargetCardsCount++;

                    if (card.get("currentOwner") !== newCard.get("currentOwner")) {
                        plusTargetOpponentCards[side] = card;
                        plusTargetOpponentCardsCount++;
                    }
                }
            });

            // If there are at least two cards matching the Plus rule
            // And at least one match is a card belonging to the opponent
            if (plusTargetCardsCount >= 2 && plusTargetOpponentCardsCount >= 1) {

                // We flip the opponent's cards captured by the rule
                _.each(plusTargetOpponentCards, function (card, side) {
                    let caseName = _$.utils.getCaseNameFromPosition(card.get("position"));
                    flipCard(card, caseName, OPPOSING_SIDE[side], { flipRule: "plus", checkCombos: true });
                });
            }
        }

        // BASIC RULE
        _.each(adjacentCards, function (card, side) {
            let caseName = _$.utils.getCaseNameFromPosition(card.get("position"));
            let flipped  = checkBasicFlip(newCard, card, side);

            if (flipped) {
                flipCard(card, caseName, OPPOSING_SIDE[side], { flipRule: "basic" });
            }
        });

        if (!isSimulatedTurn) {
            _.each(FLIP_RULE_ORDER, function (flipRule) {
                _.each(flippedCards[flipRule], function (flippedCard) {
                    user.set("points", user.get("points") + flippedCard.newUserPointsDelta);
                    opponent.set("points", opponent.get("points") + flippedCard.newOpponentPointsDelta);

                    flippedCard.newUserPoints     = user.get("points");
                    flippedCard.newOpponentPoints = opponent.get("points");
                    orderedFlipCards.push(flippedCard);
                });
            });

            toNextPhase.call(this);
        } else {
            toNextPhase.call(this);
        }

        function toNextPhase () {
            if (!isSimulatedTurn) {
                if (playedCards.length === BOARD_SIZE) {
                    this.setupEndGame(() => {
                        _$.events.trigger("toNextPhase", { flippedCards: orderedFlipCards, endGame: true });
                    });
                } else {
                    this.setupNextTurn(() => {
                        _$.events.trigger("toNextPhase", { flippedCards: orderedFlipCards });
                    });
                }
            } else {
                _.extend(simulation, { endGame: playedCards.length === BOARD_SIZE });
                simulationCallback(simulation);
            } 
        }

        function flipCard (flippedCard, caseName, fromSide, options = {}) {
            flippedCard.set("currentOwner", newCard.get("currentOwner"));

            if (!isSimulatedTurn) {
                if (!flippedCards[options.flipRule]) {
                    flippedCards[options.flipRule] = [];
                }

                flippedCards[options.flipRule].push({
                    caseName,
                    fromSide,
                    flipRule               : options.flipRule,
                    newUserPointsDelta     : playing === user ? 1 : -1,
                    newOpponentPointsDelta : playing === opponent ? 1 : -1
                });
            } else {
                user.set("points", user.get("points") + (playing === user ? 1 : -1));
                opponent.set("points", opponent.get("points") + (playing === opponent ? 1 : -1));
            }

            if (options.checkCombos) {
                var flippedCardAdjacentCards = getAdjacentCards(flippedCard, playedCards);

                _.each(flippedCardAdjacentCards, function (card, side) {
                    let caseName = _$.utils.getCaseNameFromPosition(card.get("position"));
                    let flipped  = checkBasicFlip(flippedCard, card, side);

                    if (flipped) {
                        flipCard(card, caseName, OPPOSING_SIDE[side], { flipRule: "combo" });
                    }
                });
            }
        }
    }

    function setupNextTurn (callback) {
        this.set("turnNumber", this.get("turnNumber") + 1);

        if (this.get("turnNumber") === 0) {
            if (this.get("role") === "receiver") {
                _$.events.on("getFirstPlayer", (event, data) => {
                    var playerRole = data.msg;

                    if (playerRole) {
                        _$.events.off("getFirstPlayer");
                        var firstPlayer = (playerRole === "emitter") ? this.get("players").opponent : this.get("players").user;
                        this.set("playing", firstPlayer);

                        callback();
                    }
                });

                _$.comm.socketManager.emit("getFirstPlayer");
            } else {
                this.set("playing", (Math.random() > 0.5) ? this.get("players").user : this.get("players").opponent);

                if (this.get("role") === "emitter") {
                    var firstPlayer = (this.get("playing") === this.get("players").user) ? "emitter" : "receiver";
                    _$.comm.socketManager.emit("setFirstPlayer", firstPlayer);
                }

                callback();
            }
        } else {
            if (this.get("playing") === this.get("players").user) {
                this.set("playing", this.get("players").opponent);
            } else {
                this.set("playing", this.get("players").user);
            }

            callback();
        }
    }

    function setupEndGame (callback) {
        this.set("turnNumber", -1);
        var userElo, opponentElo, elo, odds;
        
        if (this.get("isRanked")) {
            userElo     = this.get("players").user.get("rankPoints");
            opponentElo = this.get("players").opponent.get("rankPoints");
            elo         = _$.utils.getElo();
            odds        = elo.expectedScore(userElo, opponentElo);
        }

        if (this.get("players").user.get("points") > this.get("players").opponent.get("points")) {
            this.set("winner", this.get("players").user);
            _$.state.user.get("gameStats").won++;

            // If the game is ranked, update the Elo score (win)
            if (this.get("isRanked")) {
                _$.state.user.get("gameStats").wonRanked++;
                _$.state.user.set("rankPoints", elo.newRating(odds, 1, userElo));
            }
        } else if (this.get("players").opponent.get("points") > this.get("players").user.get("points")) {
            this.set("winner", this.get("players").opponent);
            _$.state.user.get("gameStats").lost++;

            // If the game is ranked, update the Elo score (lose)
            if (this.get("isRanked")) {
                _$.state.user.get("gameStats").lostRanked++;
                _$.state.user.set("rankPoints", elo.newRating(odds, 0, userElo));
            }
        } else if (this.get("players").user.get("points") === this.get("players").opponent.get("points")) {
            this.set("winner", "draw");

            // If the game ended in a tie, unless the Sudden Death rule is in effect
            if (!this.get("rules").suddenDeath) {
                _$.state.user.get("gameStats").draw++;

                // If the game is ranked, update the Elo score (draw)
                if (this.get("isRanked")) {
                    _$.state.user.get("gameStats").drawRanked++;
                    _$.state.user.set("rankPoints", elo.newRating(odds, 0.5, userElo));
                }
            }
        }

        // If the game ended in a tie and the Sudden Death rule is in effect
        // Create the decks for the next round
        if (this.get("winner") === "draw" && this.get("rules").suddenDeath) {
            var newUserDeck     = [];
            var newOpponentDeck = [];

            _.each(_.concat(this.get("players").user.get("deck"), this.get("players").opponent.get("deck")), (card) => {
                card.set("bonus", 0);
                card.set("position", null);

                if (card.get("currentOwner") === this.get("players").user) {
                    card.set("deckIndex", newUserDeck.length);
                    newUserDeck.push(card);
                } else if (card.get("currentOwner") === this.get("players").opponent) {
                    card.set("deckIndex", newOpponentDeck.length);
                    newOpponentDeck.push(card);
                }
            });

            this.get("players").user.set("deck", newUserDeck);
            this.get("players").opponent.set("deck", newOpponentDeck);

        // Otherwise, the game has ended, we set the number of cards to pick according to the Trade rule in effect
        } else {
            if (this.get("rules").trade === "none" || this.get("winner") === "draw" && this.get("rules").trade !== "direct") {
                this.set("cardsToPickCount", 0);

                // There won't be any further steps in the flow, so we can reset the cards' attributes now
                this.resetCardAttributes();
            } else if (this.get("rules").trade === "one") {
                this.set("cardsToPickCount", 1);
            } else if (this.get("rules").trade === "difference") {
                this.set("cardsToPickCount", Math.abs(this.get("players").user.get("points") - this.get("players").opponent.get("points")));

                if (this.get("cardsToPickCount") > _$.state.DECK_SIZE) {
                    this.set("cardsToPickCount", _$.state.DECK_SIZE);
                }
            } else if (this.get("rules").trade === "direct") {
                this.set("cardsToPickCount", _.filter(this.get("originalDecks").opponent, (card) => {
                    return card.get("currentOwner") === this.get("players").user;
                }).length);
            } else if (this.get("rules").trade === "all") {
                this.set("cardsToPickCount", _$.state.DECK_SIZE);
            }

            // If the opponent is an AI and it won, select the cards the AI will pick
            if (this.get("computer") && this.get("winner") === this.get("players").opponent) {
                if (this.get("rules").trade === "none") {
                    this.get("computer").selectedCards = [];

                } else if (this.get("rules").trade === "one" || this.get("rules").trade === "difference") {
                    // Select the best cards from the player's deck
                    var orderedDeckByBest = _.orderBy(this.get("originalDecks").user, function (card) { return card.getRanksSum(); }, "desc");
                    this.get("computer").selectedCards = orderedDeckByBest.slice(0, this.get("cardsToPickCount"));

                } else if (this.get("rules").trade === "direct") {
                    this.get("computer").selectedCards = _.filter(this.get("playedCards").user, (card) => {
                        return card.get("currentOwner") === this.get("players").opponent;
                    });

                } else if (this.get("rules").trade === "all") {
                    this.get("computer").selectedCards = this.get("originalDecks").user.slice(0);
                }
            }
        }

        callback();
    }

    function promptOpponentAction () {
        var action;
        var card;
        var caseName;

        if (this.get("type") === "solo") {
            action           = this.get("computer").AI.doAction();
            action.deckIndex = action.card.get("deckIndex");

            proceed.call(this);
        } else {
            _$.events.on("getPlayerAction", (event, response) => {
                if (response.msg) {
                    _$.events.off("getPlayerAction");
                    action = response.msg;
                    proceed.call(this);
                }
            });

            _$.comm.socketManager.emit("getPlayerAction");
        }

        function proceed () {
            card     = this.get("players").opponent.get("deck")[action.deckIndex];
            caseName = _$.utils.getCaseNameFromPosition(action.position);
            _$.events.trigger("placeOpponentCard", card, caseName);
        }
    }

    function updateUserAlbum (gainedLost) {
        // We reset the cards' attributes
        this.resetCardAttributes();

        if (gainedLost.gained.length) { _$.state.user.get("album").add(gainedLost.gained); }
        if (gainedLost.lost.length)   { _$.state.user.get("album").remove(gainedLost.lost); }
    }

    function getAdjacentCards (card, playedCards) {
        var adjacentCards = {};

        _.each(playedCards, function (playedCard) {
            if (playedCard.get("position").x        === card.get("position").x && playedCard.get("position").y === card.get("position").y - 1) {
                adjacentCards.top = playedCard;
            } else if (playedCard.get("position").x === card.get("position").x && playedCard.get("position").y === card.get("position").y + 1) {
                adjacentCards.bottom = playedCard;
            } else if (playedCard.get("position").y === card.get("position").y && playedCard.get("position").x === card.get("position").x - 1) {
                adjacentCards.left = playedCard;
            } else if (playedCard.get("position").y === card.get("position").y && playedCard.get("position").x === card.get("position").x + 1) {
                adjacentCards.right = playedCard;
            }
        });

        return adjacentCards;
    }

    function isSameWallMatch (card, sameWallRuleIsOn) {
        var isMatch = {};

        // If the Same Wall rule is in effect, and the card isn't in the board's middle case
        if (sameWallRuleIsOn && card.get("position").x !== 2 && card.get("position").y !== 2) {
            // If it's against the left, right, top or bottom wall, and the card's value on these sides is equal to the wall's set value
            if (card.get("position").x === 1 && card.get("ranks").left   === WALL_VALUE) { isMatch.left   = true; }
            if (card.get("position").x === 3 && card.get("ranks").right  === WALL_VALUE) { isMatch.right  = true; }
            if (card.get("position").y === 1 && card.get("ranks").top    === WALL_VALUE) { isMatch.top    = true; }
            if (card.get("position").y === 3 && card.get("ranks").bottom === WALL_VALUE) { isMatch.bottom = true; }

            if (isMatch.left || isMatch.right || isMatch.top || isMatch.bottom) {
                return isMatch;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    // Check whether cardA flips cardB according to the basic rule
    function checkBasicFlip (cardA, cardB, side) {
        // If cardB belongs to the other player
        if (cardB.get("currentOwner") !== cardA.get("currentOwner")) {
            // If cardB is placed on a side of cardA where its rank is lower than cardA's
            if ((cardA.get("ranks")[side] + cardA.get("bonus")) > (cardB.get("ranks")[OPPOSING_SIDE[side]] + cardB.get("bonus"))) {
                // Then the card is flipped
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    function resetCardAttributes () {
        _.each(_.concat(this.get("originalDecks").user, this.get("originalDecks").opponent), (card) => {
            card.reset();
        });
    }

    function destroy () {
        this.resetCardAttributes();
        
        if (this.get("type") === "versus") {
            _$.events.off("getBoardInfo");
            _$.events.off("getFirstPlayer");
            _$.events.off("getPlayerAction");
        }
    }
});
