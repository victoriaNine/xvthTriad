define([
    "underscore",
    "backbone",
    "global",
    "models/model_card",
    "models/model_player"
], function Model_Game (_, Backbone, _$, Model_Card, Model_Player) {
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

    function initialize (attributes, options = {}) {
        var players   = options.players;
        var userDeck  = options.userDeck;

        this.set("rules", setRules(options.rules));

        // In case of a new round for a game with the sudden death rule,
        // Use the players passed in the options
        if (players) {
            this.set("players", players);
        } else {
            if (!attributes.type || attributes.type === "solo") {
                var computerInfo = this.setupComputerInfo();

                this.set({ players :
                    {
                        user     : new Model_Player({ type: "human", user: _$.state.user, name: _$.state.user.get("name"), avatar: _$.state.user.get("avatar"), deck: userDeck }),
                        opponent : new Model_Player({ type: "computer", user: null, name: computerInfo.name, avatar: computerInfo.avatar, deck: computerInfo.deck })
                    }
                });
            }
        }

        if (this.get("rules").elemental) {
            var randomCase;
            var randomElement;
            var elements      = ["fire", "ice", "water", "poison", "holy", "thunder", "earth", "wind"];
            var elementsNb    = _.random(1, 5);
            this.elementCases = {
                "case11" : null,
                "case12" : null,
                "case13" : null,
                "case21" : null,
                "case22" : null,
                "case23" : null,
                "case31" : null,
                "case32" : null,
                "case33" : null
            };

            for (var i = 0, ii = elementsNb; i < ii; i++) {
                do {
                    randomCase = _.random(0, BOARD_SIZE - 1);
                } while (this.elementCases[_.keys(this.elementCases)[randomCase]]);

                randomElement = _.random(0, elements.length - 1);
                this.elementCases[_.keys(this.elementCases)[randomCase]] = elements[randomElement];
            }
        }

        this.playing         = (Math.random() > 0.5) ? this.get("players").user : this.get("players").opponent;
        this.playedCards     = [];
    }

    function setupComputerInfo () {
        var info = {};
        var cardMaxLevel;
        var randomCards;

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

        randomCards = _$.utils.getRandomCards({
            amount   : 5,
            minLevel : 1,
            maxLevel : 1//cardMaxLevel
        });

        info.deck = _.map(randomCards, function (attributes) {
            return new Model_Card(attributes);
        });

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
        var index         = -1;

        // ELEMENTAL RULE
        if (this.get("rules").elemental) {
            let boardCase = "case" + newCard.position.y + newCard.position.x;
            let element   = this.elementCases[boardCase];
            if (element && element === newCard.get("element")) {
                newCard.bonus++;
                _$.events.trigger("showElementalBonus", { boardCase, bonusType: "bonus" });
            } else if (element && element !== newCard.get("element")) {
                newCard.bonus--;
                _$.events.trigger("showElementalBonus", { boardCase, bonusType: "penalty" });
            }
        }

        if (_.isEmpty(adjacentCards)) {
            setNextTurn();
            _$.events.trigger("toNextTurn");
            return;
        }

        // BASIC RULE
        index = -1;
        _.each(adjacentCards, function (card, side) {
            index++;
            let boardCase = "case" + card.position.y + card.position.x;
            let flipped   = false;

            if (card.currentOwner !== newCard.currentOwner) {
                if (side === "top" && (newCard.get("ranks").top + newCard.bonus) > (card.get("ranks").bottom + card.bonus)) {
                    flipped = true;
                    _$.events.trigger("flipCard", { boardCase, from: "bottom" });
                } else if (side === "right" && (newCard.get("ranks").right + newCard.bonus) > (card.get("ranks").left + card.bonus)) {
                    flipped = true;
                    _$.events.trigger("flipCard", { boardCase, from: "left" });
                } else if (side === "bottom" && (newCard.get("ranks").bottom + newCard.bonus) > (card.get("ranks").top + card.bonus)) {
                    flipped = true;
                    _$.events.trigger("flipCard", { boardCase, from: "top" });
                } else if (side === "left" && (newCard.get("ranks").left + newCard.bonus) > (card.get("ranks").right + card.bonus)) {
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
            flippedCard.currentOwner = newCard.currentOwner;

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
            _.each(that.playedCards, (card) => {
                card.bonus = 0;
            });

            if (that.get("players").user.attributes.points > that.get("players").opponent.attributes.points) {
                that.winner = that.get("players").user;
                _$.state.user.get("gameStats").won++;
            } else if (that.get("players").opponent.attributes.points > that.get("players").user.attributes.points) {
                that.winner = that.get("players").opponent;
                _$.state.user.get("gameStats").lost++;
            } else if (that.get("players").user.attributes.points === that.get("players").opponent.attributes.points) {
                that.winner = "draw";
                _$.state.user.get("gameStats").draw++;

                if (that.get("rules").suddenDeath) {
                    var newUserDeck     = [];
                    var newOpponentDeck = [];
                    _.each(that.get("players").user.get("deck"), (card) => {
                        if (card.currentOwner === that.get("players").user) {
                            newUserDeck.push(card);
                        } else if (card.currentOwner === that.get("players").opponent) {
                            newOpponentDeck.push(card);
                        }
                    });

                    _.each(that.get("players").opponent.get("deck"), (card) => {
                        if (card.currentOwner === that.get("players").user) {
                            newUserDeck.push(card);
                        } else if (card.currentOwner === that.get("players").opponent) {
                            newOpponentDeck.push(card);
                        }
                    });

                    that.get("players").user.set("deck", newUserDeck);
                    that.get("players").opponent.set("deck", newOpponentDeck);
                }
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
