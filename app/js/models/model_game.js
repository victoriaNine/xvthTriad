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
            type       : "solo",
            difficulty : "medium",
            rules      : setRules(),
            players    : {},
            winner     : null
        },

        initialize,
        setupComputerInfo,
        updateBoard,
        getAdjacentCards,
        selectCardsToTrade,
        setupNextTurn,
        setupEndGame,
        updateUserAlbum
    });

    function initialize (attributes, options = {}) {
        var players   = options.players;
        var userDeck  = options.userDeck;

        this.computerInfo = null;
        this.set("rules", setRules(options.rules));

        // In case of a new round for a game with the sudden death rule,
        // Use the players passed in the options
        if (players) {
            this.set("players", players);
        } else {
            if (!attributes.type || attributes.type === "solo") {
                this.computerInfo = this.setupComputerInfo();

                this.set({ players :
                    {
                        user     : new Model_Player({ type: "human", user: _$.state.user, name: _$.state.user.get("name"), avatar: _$.state.user.get("avatar"), deck: userDeck }),
                        opponent : new Model_Player({ type: "computer", user: null, name: this.computerInfo.name, avatar: this.computerInfo.avatar, deck: this.computerInfo.deck })
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

        this.originalDecks   = {
            user     : [],
            opponent : []
        };

        _.each(this.get("players").user.get("deck"), (card) => {
            if (!card.owner) {
                this.originalDecks.user.push(card);
            } else {
                if (card.owner === this.get("players").user) {
                    this.originalDecks.user.push(card);
                } else if (card.owner === this.get("players").opponent) {
                    this.originalDecks.opponent.push(card);
                }
            }
        });

        _.each(this.get("players").opponent.get("deck"), (card) => {
            if (!card.owner) {
                this.originalDecks.opponent.push(card);
            } else {
                if (card.owner === this.get("players").user) {
                    this.originalDecks.user.push(card);
                } else if (card.owner === this.get("players").opponent) {
                    this.originalDecks.opponent.push(card);
                }
            }
        });

        this.playing         = (Math.random() > 0.5) ? this.get("players").user : this.get("players").opponent;
        this.playedCards     = [];
        this.cardsToTrade    = null;
    }

    function setupComputerInfo () {
        var info = {};
        var cardMaxLevel;
        var randomCards;

        switch (this.get("difficulty")) {
            case "easy":
                info.name    = "Carbuncle";
                info.avatar  = "./assets/img/avatars/computer_carbuncle.jpg";
                cardMaxLevel = 3;
                break;
            case "medium":
                info.name    = "Gentiana";
                info.avatar  = "./assets/img/avatars/computer_gentiana.jpg";
                cardMaxLevel = 7;
                break;
            case "hard":
                info.name    = "Bahamut";
                info.avatar  = "./assets/img/avatars/computer_bahamut.jpg";
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
            this.setupNextTurn();
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
                        that.setupEndGame();
                        _$.events.trigger("toEndGame");
                    }
                } else {
                    if (flipped) {
                        updateScore(card, { nextTurn: true });
                    } else {
                        that.setupNextTurn();
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
                that.setupNextTurn();
            } else if (options.endGame) {
                that.setupEndGame();
            }

            _$.events.trigger("updateScore", options);
        }
    }

    function setupNextTurn () {
        if (this.playing === this.get("players").user) {
            this.playing = this.get("players").opponent;
        } else {
            this.playing = this.get("players").user;
        }
    }

    function setupEndGame () {
        _.each(this.playedCards, (card) => {
            card.bonus    = 0;
            card.position = null;
        });

        if (this.get("players").user.attributes.points > this.get("players").opponent.attributes.points) {
            this.winner = this.get("players").user;
            _$.state.user.get("gameStats").won++;
        } else if (this.get("players").opponent.attributes.points > this.get("players").user.attributes.points) {
            this.winner = this.get("players").opponent;
            _$.state.user.get("gameStats").lost++;
        } else if (this.get("players").user.attributes.points === this.get("players").opponent.attributes.points) {
            this.winner = "draw";
            _$.state.user.get("gameStats").draw++;
        }

        if (this.winner === "draw" && this.get("rules").suddenDeath) {
            var newUserDeck     = [];
            var newOpponentDeck = [];

            _.each(this.get("players").user.get("deck"), (card) => {
                if (card.currentOwner === this.get("players").user) {
                    newUserDeck.push(card);
                } else if (card.currentOwner === this.get("players").opponent) {
                    newOpponentDeck.push(card);
                }
            });

            _.each(this.get("players").opponent.get("deck"), (card) => {
                if (card.currentOwner === this.get("players").user) {
                    newUserDeck.push(card);
                } else if (card.currentOwner === this.get("players").opponent) {
                    newOpponentDeck.push(card);
                }
            });

            this.get("players").user.set("deck", newUserDeck);
            this.get("players").opponent.set("deck", newOpponentDeck);
        } else if (this.get("rules").trade === "none") {
            _.each(this.originalDecks.user, (card) => {
                card.owner        = null;
                card.currentOwner = null;
            });

            _.each(this.originalDecks.opponent, (card) => {
                card.owner        = null;
                card.currentOwner = null;
            });
        }

        if (this.get("rules").trade === "one") {
            this.cardsToTrade = 1;
        } else if (this.get("rules").trade === "difference") {
            this.cardsToTrade = Math.abs(this.get("players").user.attributes.points - this.get("players").opponent.attributes.points);

            if (this.cardsToTrade > 5) {
                this.cardsToTrade = 5;
            }
        }

        if (this.cardsToTrade && this.winner === this.get("players").opponent) {
            if (this.get("players").opponent.get("type") === "computer") {
                this.selectCardsToTrade.call(this);
            }
        }
    }

    function selectCardsToTrade () {
        // Select the best cards from the player's deck
        var orderedDeck = _.sortBy(this.originalDecks.user, [function (card) { return card.getRanksSum(); }]);
        this.computerInfo.selectedCards = orderedDeck.slice(0, this.cardsToTrade);
    }

    function updateUserAlbum (gainedLost) {
        _.each(this.originalDecks.user, (card) => {
            card.owner        = null;
            card.currentOwner = null;
        });

        _.each(this.originalDecks.opponent, (card) => {
            card.owner        = null;
            card.currentOwner = null;
        });

        console.log(gainedLost);
        if (gainedLost.gained.length) {
            _$.state.user.get("album").add(gainedLost.gained);
        }

        if (gainedLost.lost.length) {
            _$.state.user.get("album").remove(gainedLost.lost);
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
