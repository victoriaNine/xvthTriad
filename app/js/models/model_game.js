define([
    "underscore",
    "backbone",
    "global",
    "models/model_card",
    "models/model_player",
    "models/model_ai"
], function Model_Game (_, Backbone, _$, Model_Card, Model_Player, Model_AI) {
    const BOARD_SIZE   = 9;
    const MAX_ELEMENTS = 5;
    const ELEMENTS     = ["fire", "ice", "water", "poison", "light", "thunder", "rock", "wind", "dark"];

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
            cardsToTrade  : null,
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
        getAdjacentCards,
        selectCardsToTrade,
        getLostCards,
        setupNextTurn,
        setupEndGame,
        updateUserAlbum,
        promptOpponentAction,
        resetCardAttributes
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

        if (this.get("role") === "emitter") {
            _$.comm.socketManager.emit("roundReset");
        } else if (this.get("role") === "receiver") {
            _$.events.on("getFirstPlayer", (event, data) => {
                var playerRole = data.msg;

                if (playerRole) {
                    _$.events.off("getFirstPlayer");
                    var firstPlayer = (playerRole === "emitter") ? this.get("players").opponent : this.get("players").user;
                    this.set("playing", firstPlayer);
                    _$.events.trigger("firstPlayerSet");
                }
            });
        }

        if (this.get("rules").elemental) {
            var randomCase;
            var randomElement;
            var elementsNb    = _.random(1, MAX_ELEMENTS);
            this.set("elementBoard", _.clone(this.get("board")));

            for (var i = 0, ii = elementsNb; i < ii; i++) {
                do {
                    randomCase = _.random(0, BOARD_SIZE - 1);
                } while (this.get("elementBoard")[_.keys(this.get("elementBoard"))[randomCase]]);

                randomElement = _.random(0, ELEMENTS.length - 1);
                this.get("elementBoard")[_.keys(this.get("elementBoard"))[randomCase]] = ELEMENTS[randomElement];
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

        this.setupNextTurn();
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
            _$.debug.error("Invalid trade rule: " + rules.trade);
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

        var that            = this;
        var adjacentCards   = this.getAdjacentCards(newCard, playedCards);
        var adjacentCardsNb = _.keys(adjacentCards).length;
        var index           = -1;

        // ELEMENTAL RULE
        if (this.get("rules").elemental) {
            let caseName = _$.utils.getCaseNameFromPosition(newCard.get("position"));
            let element  = this.get("elementBoard")[caseName];

            if (element && element === newCard.get("element")) {
                newCard.set("bonus", newCard.get("bonus") + 1);
                triggerEvent("showElementalBonus", { caseName, bonusType: "bonus" });
            } else if (element && element !== newCard.get("element")) {
                newCard.set("bonus", newCard.get("bonus") - 1);
                triggerEvent("showElementalBonus", { caseName, bonusType: "penalty" });
            }
        }

        if (_.isEmpty(adjacentCards)) {
            if (!isSimulatedTurn) {
                this.setupNextTurn();
            }
            triggerEvent("toNextTurn", { nextTurn: true });
            return;
        }

        // SAME RULE
        /*if (this.get("rules").same && adjacentCardsNb >= 2) {
            index = -1;
            let sameTargetCards = {};

            _.each(adjacentCards, function (card, side) {
                if ((side === "top" && newCard.get("ranks").top === card.get("ranks").bottom) ||
                    (side === "right" && newCard.get("ranks").right === card.get("ranks").left) ||
                    (side === "bottom" && newCard.get("ranks").bottom === card.get("ranks").top) ||
                    (side === "left" && newCard.get("ranks").left === card.get("ranks").right)) {
                    sameTargetCards.push(card);
                }
            });

            if (sameTargetCards.length >= 2) {
                _.each(sameTargetCards, function (card, side) {
                    let caseName = _$.utils.getCaseNameFromPosition(card.get("position"));
                    let flipped  = false;

                    if (card.get("currentOwner") !== newCard.get("currentOwner")) {

                    }
                });
            }
        }*/

        // BASIC RULE
        index = -1;
        _.each(adjacentCards, function (card, side) {
            index++;
            let caseName = _$.utils.getCaseNameFromPosition(card.get("position"));
            let flipped  = false;

            if (card.get("currentOwner") !== newCard.get("currentOwner")) {
                if (side === "top" && (newCard.get("ranks").top + newCard.get("bonus")) > (card.get("ranks").bottom + card.get("bonus"))) {
                    flipped = true;
                    triggerEvent("flipCard", { caseName, from: "bottom" });
                } else if (side === "right" && (newCard.get("ranks").right + newCard.get("bonus")) > (card.get("ranks").left + card.get("bonus"))) {
                    flipped = true;
                    triggerEvent("flipCard", { caseName, from: "left" });
                } else if (side === "bottom" && (newCard.get("ranks").bottom + newCard.get("bonus")) > (card.get("ranks").top + card.get("bonus"))) {
                    flipped = true;
                    triggerEvent("flipCard", { caseName, from: "top" });
                } else if (side === "left" && (newCard.get("ranks").left + newCard.get("bonus")) > (card.get("ranks").right + card.get("bonus"))) {
                    flipped = true;
                    triggerEvent("flipCard", { caseName, from: "right" });
                }
            }

            // If this is the last card to check in the list of adjacent cards
            if (index === adjacentCardsNb - 1) {
                // If all of the board's cases have been filled (end of the game)
                if (playedCards.length === BOARD_SIZE) {
                    // If this card has been flipped
                    if (flipped) {
                        // Update the score a last time with the "end game" flag on
                        updateScore(card, { endGame: true });

                    // If it hasn't been flipped, just notify the view to move to the end game
                    } else {
                        // Do not make the end of game updates to the players' stats if it's just an AI simulation
                        if (!isSimulatedTurn) {
                            that.setupEndGame();
                        }

                        triggerEvent("toEndGame", { endGame: true });
                    }
                // If it's not the end of game yet
                } else {
                    // If the card has been flipped
                    if (flipped) {
                        // Update the score with the "next turn" flag on

                        updateScore(card, { nextTurn: true });
                    // If it hasn't been flipped, just notify the view to move to the next turn
                    } else {
                        // Do not make the end of turn updates to the players' stats if it's just an AI simulation
                        if (!isSimulatedTurn) {
                            that.setupNextTurn();
                        }
                        triggerEvent("toNextTurn", { nextTurn: true });
                    }
                }

            // If there are cards yet to be checked for that turn and this card has been flipped, update the score
            } else if (flipped) {
                updateScore(card);
            }
        });

        function updateScore (flippedCard, options = {}) {
            flippedCard.set("currentOwner", newCard.get("currentOwner"));

            if (playing === user) {
                user.set("points", user.get("points") + 1);
                opponent.set("points", opponent.get("points") - 1);
            } else {
                opponent.set("points", opponent.get("points") + 1);
                user.set("points", user.get("points") - 1);
            }

            //_$.debug.log("Card", newCard.get("name"), "at", newCard.get("position").x + "," + newCard.get("position").y, "flipped card", flippedCard.get("name"), "at", flippedCard.get("position").x + "," + flippedCard.get("position").y + ".");
            //_$.debug.log("New score:", opponent.get("points"), "(" + opponent.get("name") + ") /", user.get("points"), "(" + user.get("name") + ")");

            if (!isSimulatedTurn) {
                if (options.nextTurn) {
                    that.setupNextTurn();
                } else if (options.endGame) {
                    that.setupEndGame();
                }
            }

            triggerEvent("updateScore", options);
        }

        function triggerEvent (eventName, options = {}) {
            if (!isSimulatedTurn) {
                _$.events.trigger(eventName, options);
            } else if (eventName !== "flipCard") {
                _.extend(simulation, { endGame: !!options.endGame });
                simulationCallback(simulation);
            }
        }
    }

    function setupNextTurn () {
        this.set("turnNumber", this.get("turnNumber") + 1);

        if (this.get("turnNumber") === 0) {
            if (this.get("role") === "receiver") {
                _$.comm.socketManager.emit("getFirstPlayer");
            } else {
                this.set("playing", (Math.random() > 0.5) ? this.get("players").user : this.get("players").opponent);

                if (this.get("role") === "emitter") {
                    var firstPlayer = (this.get("playing") === this.get("players").user) ? "emitter" : "receiver";
                    _$.comm.socketManager.emit("setFirstPlayer", firstPlayer);
                }

                _$.events.trigger("firstPlayerSet");
            }
        } else {
            if (this.get("playing") === this.get("players").user) {
                this.set("playing", this.get("players").opponent);
            } else {
                this.set("playing", this.get("players").user);
            }
        }
    }

    function setupEndGame () {
        this.set("turnNumber", -1);
        _.each(this.get("playedCards"), (card) => {
            card.set("deckIndex", -1);
            card.set("bonus", 0);
            card.set("position", null);
        });

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
            if (this.get("isRanked")) {
                _$.state.user.get("gameStats").wonRanked++;
                _$.state.user.set("rankPoints", elo.newRating(odds, 1, userElo));
            }
        } else if (this.get("players").opponent.get("points") > this.get("players").user.get("points")) {
            this.set("winner", this.get("players").opponent);
            _$.state.user.get("gameStats").lost++;
            if (this.get("isRanked")) {
                _$.state.user.get("gameStats").lostRanked++;
                _$.state.user.set("rankPoints", elo.newRating(odds, 0, userElo));
            }
        } else if (this.get("players").user.get("points") === this.get("players").opponent.get("points")) {
            this.set("winner", "draw");

            if (!this.get("rules").suddenDeath) {
                _$.state.user.get("gameStats").draw++;
                if (this.get("isRanked")) {
                    _$.state.user.get("gameStats").drawRanked++;
                    _$.state.user.set("rankPoints", elo.newRating(odds, 0.5, userElo));
                }
            }
        }

        if (this.get("winner") === "draw" && this.get("rules").suddenDeath) {
            var newUserDeck     = [];
            var newOpponentDeck = [];

            _.each(_.concat(this.get("players").user.get("deck"), this.get("players").opponent.get("deck")), (card) => {
                if (card.get("currentOwner") === this.get("players").user) {
                    newUserDeck.push(card);
                } else if (card.get("currentOwner") === this.get("players").opponent) {
                    newOpponentDeck.push(card);
                }
            });

            this.get("players").user.set("deck", newUserDeck);
            this.get("players").opponent.set("deck", newOpponentDeck);
        } else if (this.get("rules").trade === "none") {
            _.each(_.concat(this.get("originalDecks").user, this.get("originalDecks").opponent), (card) => {
                card.set("owner", null);
                card.set("currentOwner", null);
            });
        }

        if (this.get("rules").trade === "one") {
            this.set("cardsToTrade", 1);
        } else if (this.get("rules").trade === "difference") {
            this.set("cardsToTrade", Math.abs(this.get("players").user.get("points") - this.get("players").opponent.get("points")));

            if (this.get("cardsToTrade") > _$.state.DECK_SIZE) {
                this.set("cardsToTrade", _$.state.DECK_SIZE);
            }
        }

        if (this.get("computer") && this.get("winner") === this.get("players").opponent && this.get("cardsToTrade")) {
            this.selectCardsToTrade.call(this);
        }
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

    function selectCardsToTrade () {
        // Select the best cards from the player's deck
        var orderedDeck = _.sortBy(this.get("originalDecks").user, [function (card) { return card.getRanksSum(); }]);
        this.get("computer").selectedCards = orderedDeck.slice(0, this.get("cardsToTrade"));
    }

    function getLostCards () {
        if (this.get("computer")) {
            return this.get("computer").selectedCards;
        }
    }

    function updateUserAlbum (gainedLost) {
        _.each(_.concat(this.get("originalDecks").user, this.get("originalDecks").opponent), (card) => {
            card.set("owner", null);
            card.set("currentOwner", null);
        });

        if (gainedLost.gained.length) {
            _$.state.user.get("album").add(gainedLost.gained);
        }

        if (gainedLost.lost.length) {
            _$.state.user.get("album").remove(gainedLost.lost);
        }
    }

    function getAdjacentCards (card, playedCards) {
        var adjacentCards = {};

        _.each(playedCards, function (playedCard) {
            if (playedCard.get("position").x === card.get("position").x && playedCard.get("position").y === card.get("position").y - 1) {
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

    function resetCardAttributes () {
        _.each(_.concat(this.get("originalDecks").user, this.get("originalDecks").opponent), (card) => {
            card.reset();
        });
    }
});
