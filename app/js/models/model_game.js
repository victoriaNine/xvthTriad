define([
    "underscore",
    "backbone",
    "global",
    "models/model_player",
    "collections/coll_deck"
], function Model_Game (_, Backbone, _$, Model_Player, Coll_Deck) {
    var BOARD_SIZE = 9;

    return Backbone.Model.extend({
        defaults : {
            type    : "solo",
            level   : "easy",
            rules   : setRules(),
            players : {},
            winner  : null
        },

        initialize,
        setupComputerInfo,
        updateBoard,
        getAdjacentCards
    });

    function initialize (attributes, options) {
        var userDeck  = options.deck;
        var gameLevel = this.get("level");

        this.set({ rules : setRules(options.rules) });

        if (!attributes.type || attributes.type === "solo") {
            var computerInfo = this.setupComputerInfo();

            this.set({ players :
                {
                    user     : new Model_Player({ type: "human", user: _$.state.user, name: _$.state.user.get("name"), avatar: _$.state.user.get("avatar"), deck: userDeck }),
                    opponent : new Model_Player({ type: "computer", user: null, name: computerInfo.name, avatar: computerInfo.avatar, deck: computerInfo.deck })
                }
            });
        }

        this.playing     = this.get("players").user;//(Math.random() > 0.5) ? this.get("players").user : this.get("players").opponent;
        this.playedCards = [];
    }

    function setupComputerInfo () {
        var info = {};
        var cardMaxLevel;

        switch (this.get("level")) {
            case "easy":
                info.name    = "Carbuncle";
                info.avatar  = "./assets/img/avatars/computer_carbuncle.jpg";
                cardMaxLevel = 3;
                break;
            case "medium":
                info.name    = "CC Jack Computer";
                info.avatar  = "./assets/img/avatars/computer_jack.jpg";
                cardMaxLevel = 7;
                break;
            case "hard":
                info.name    = "Queen of Cards Computer";
                info.avatar  = "./assets/img/avatars/computer_queen.jpg";
                cardMaxLevel = 10;
                break;
        }

        info.deck = new Coll_Deck(_$.utils.getRandomCards({
            amount   : 5,
            minLevel : 1,
            maxLevel : 1,//cardMaxLevel,
            owner    : null
        }));

        return info;
    }

    function setRules (rules = {}) {
        if (rules.trade && !rules.trade.match("none|one|difference|direct|all")) {
            throw new Error("Invalid trade rule: " + rules.trade);
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

    function updateBoard (newCard) {
        this.playedCards.push(newCard);

        var that          = this;
        var adjacentCards = this.getAdjacentCards(newCard);
        var flipped       = false;
        var index         = -1;
        var boardCase;

        if (_.isEmpty(adjacentCards)) {
            setNextTurn();
            _$.events.trigger("toNextTurn");
            return;
        }

        // BASIC RULE
        _.each(adjacentCards, function (card, side) {
            index++;
            boardCase = "case" + card.position.y + card.position.x;
            flipped   = false;

            if (card.currentOwner !== newCard.owner) {
                if (side === "top" && newCard.get("ranks").top > card.get("ranks").bottom) {
                    flipped = true;
                    _$.events.trigger("flipCard", { boardCase, from: "bottom" });
                } else if (side === "right" && newCard.get("ranks").right > card.get("ranks").left) {
                    flipped = true;
                    _$.events.trigger("flipCard", { boardCase, from: "left" });
                } else if (side === "bottom" && newCard.get("ranks").bottom > card.get("ranks").top) {
                    flipped = true;
                    _$.events.trigger("flipCard", { boardCase, from: "top" });
                } else if (side === "left" && newCard.get("ranks").left > card.get("ranks").right) {
                    flipped = true;
                    _$.events.trigger("flipCard", { boardCase, from: "right" });
                }
            }

            if (index === _.keys(adjacentCards).length - 1) {
                if (that.playedCards.length === BOARD_SIZE) {
                    if (flipped) {
                        updateScore(card, { endGame: true });
                    } else {
                        setEndGame();
                        _$.events.trigger("toEndGame");
                    }
                } else {
                    if (flipped) {
                        updateScore(card, { nextTurn: true });
                    } else {
                        setNextTurn();
                        _$.events.trigger("toNextTurn");
                    }
                }
            } else if (flipped) {
                updateScore(card);
            }
        });

        function updateScore (flippedCard, options = {}) {
            flippedCard.currentOwner = newCard.owner;

            if (that.playing === that.get("players").user) {
                that.get("players").user.attributes.points++;
                that.get("players").opponent.attributes.points--;
            } else {
                that.get("players").opponent.attributes.points++;
                that.get("players").user.attributes.points--;
            }

            if (options.nextTurn) {
                setNextTurn();
            } else if (options.endGame) {
                setEndGame();
            }

            _$.events.trigger("updateScore", options);
        }

        function setNextTurn () {
            if (that.playing === that.get("players").user) {
                that.playing = that.get("players").opponent;
            } else {
                that.playing = that.get("players").user;
            }
        }

        function setEndGame () {
            if (that.get("players").user.attributes.points > that.get("players").opponent.attributes.points) {
                that.winner = that.get("players").user;
                _$.state.user.get("gameStats").won++;
            } else if (that.get("players").opponent.attributes.points > that.get("players").user.attributes.points) {
                that.winner = that.get("players").user;
                _$.state.user.get("gameStats").lost++;
            } else if (that.get("players").user.attributes.points === that.get("players").opponent.attributes.points) {
                that.winner = "draw";
                _$.state.user.get("gameStats").draw++;
            }
        }
    }

    function getAdjacentCards (card) {
        var adjacentCards = {};

        _.each(this.playedCards, function (playedCard) {
            if (playedCard.position.x === card.position.x && playedCard.position.y === card.position.y - 1) {
                adjacentCards.top = playedCard;
            } else if (playedCard.position.x === card.position.x && playedCard.position.y === card.position.y + 1) {
                adjacentCards.bottom = playedCard;
            } else if (playedCard.position.y === card.position.y && playedCard.position.x === card.position.x - 1) {
                adjacentCards.left = playedCard;
            } else if (playedCard.position.y === card.position.y && playedCard.position.x === card.position.x + 1) {
                adjacentCards.right = playedCard;
            }
        });

        return adjacentCards;
    }
});
