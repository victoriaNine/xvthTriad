define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "models/model_game",
    "views/screen",
    "views/elem_endGameCard",
    "text!templates/templ_game.html",
    "views/elem_card",
    "tweenMax"
], function Screen_Game ($, _, Backbone, _$, Model_Game, Screen, Elem_EndGameCard, Templ_Game, Elem_Card) {
    return Screen.extend({
        id       : "screen_game",

        template : _.template(Templ_Game),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
            "mouseenter #cardsContainer .card-blue:not(.is--played)" : function (e) { TweenMax.set(e.currentTarget, { scale: "1.1" }); },
            "mouseleave #cardsContainer .card-blue"                  : function (e) { TweenMax.set(e.currentTarget, { scale: "1" }); },
            "click .game_overlay-endGame-confirmBtn" : function ()  {
                this.postGameAction();
                _$.audio.audioEngine.playSFX("uiConfirm");
            },
            "mouseenter .game_overlay-endGame-confirmBtn" : function ()  {
                _$.audio.audioEngine.playSFX("uiHover");
            }
        },

        initialize,
        remove,
        renderCard,
        moveToBoard,
        moveToOrigin,
        onResize,

        showTurnOverlay,
        showEndGameOverlay,
        updateScore,
        toNextTurn,
        toEndGame,
        flipCard,
        showElementalBonus,
        toTitleScreen,
        toNextRound,
        confirmCardSelection,
        endGameCardSelected,
        findCardViewsFromModels,
        placeOpponentCard,
        getOpponentSelectedCards,

        transitionIn,
        transitionOut
    });

    function initialize (options = {}) {
        var that        = this;
        _$.state.inGame = true;
        _$.state.game   = new Model_Game({
            difficulty : _$.state.user.get("difficulty"),
            type       : _$.state.opponent ? "versus" : "solo",
            role       : _$.state.room ? ((_$.state.room.mode === "create") ? "transmitter" : "receiver") : null
        }, options);

        this.players = _$.state.game.get("players");
        this.$el.html(this.template({
            difficultyLevel : _$.state.game.get("difficulty"),
            userName        : this.players.user.get("name"),
            userPoints      : this.players.user.get("points"),
            userAvatar      : this.players.user.get("avatar"),
            opponentName    : this.players.opponent.get("name"),
            opponentPoints  : this.players.opponent.get("points"),
            opponentAvatar  : this.players.opponent.get("avatar"),
            opponentType    : this.players.opponent.get("type")
        }));

        this.ui                = {};
        this.ui.board          = this.$("#board");
        this.ui.cardsContainer = this.$("#cardsContainer");
        this.ui.HUDuser        = this.$(".game_playerHUD-user");
        this.ui.HUDopponent    = this.$(".game_playerHUD-opponent");

        this.userCardViews            = [];
        this.opponentCardViews        = [];
        this.userEndGameCardViews     = [];
        this.opponentEndGameCardViews = [];
        this.lostCards                = [];
        this.gainedCards              = [];
        this.board                    = _.clone(_$.state.game.get("board"));
        this.postGameAction           = null;

        if (_$.state.game.get("rules").elemental) {
             _.each(_$.state.game.get("elementBoard"), (element, caseName) => {
                if (element) {
                    this.$("#" + caseName).addClass("element-" + element);
                }
            });
        }

        var cardBG = $(_$.assets.get("svg.ui.cardBG"));
        this.$(".game_deck-holder").append(cardBG);

        _.each(_.concat(this.players.user.get("deck"), this.players.opponent.get("deck")), (cardModel, index, deck) => {
            renderCard.call(this, cardModel, index % (deck.length / 2));
        });

        _$.events.on("resize", this.onResize, this);
        _$.events.on("updateScore", this.updateScore, this);
        _$.events.on("toNextTurn", this.toNextTurn, this);
        _$.events.on("toEndGame", this.toEndGame, this);
        _$.events.on("flipCard", this.flipCard, this);
        _$.events.on("showElementalBonus", this.showElementalBonus, this);
        _$.events.on("endGameCardSelected", this.endGameCardSelected, this);
        _$.events.on("placeOpponentCard", this.placeOpponentCard, this);

        _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
        _$.audio.audioEngine.setBGM("bgm.game");
        _$.audio.audioEngine.playBGM();
        this.add();
    }

    function remove () {
        _$.events.off("resize", this.onResize, this);
        _$.events.off("updateScore", this.updateScore, this);
        _$.events.off("toNextTurn", this.toNextTurn, this);
        _$.events.off("toEndGame", this.toEndGame, this);
        _$.events.off("flipCard", this.flipCard, this);
        _$.events.off("showElementalBonus", this.showElementalBonus, this);
        _$.events.off("endGameCardSelected", this.endGameCardSelected, this);
        _$.events.off("placeOpponentCard", this.placeOpponentCard, this);

        if (_$.state.room) {
            _$.events.off("getSelectedCards", this.getOpponentSelectedCards, this);
        }

        _$.state.inGame = false;
        delete _$.state.opponent;
        delete _$.state.room;
        delete _$.state.rules;
        delete _$.state.game;

        Screen.prototype.remove.call(this);
    }

    function transitionIn () {
        _$.events.trigger("stopUserEvents");

        _.each(_.concat(this.userCardViews, this.opponentCardViews), (cardView) => {
            placeCardOnHolder.call(this, cardView);
        });

        var userCards     = _.map(this.userCardViews, "$el");
        var opponentCards = _.map(this.opponentCardViews, "$el");

        var tl = new TimelineMax();
        tl.from(this.ui.board, 0.4, { opacity: 0, scale: "1.2", clearProps: "all" });
        tl.from([this.ui.HUDuser, this.ui.HUDopponent], 0.4, { width: 0, opacity: 0, clearProps: "all" });
        tl.staggerFrom([this.$(".game_playerHUD-avatar"), this.$(".game_playerHUD-bar-type"), this.$(".game_playerHUD-bar-state")], 0.4, { opacity: 0, clearProps: "all" }, 0.2);
        tl.from(this.$(".game_playerHUD-score"), 0.4, { opacity: 0, y: -20, clearProps: "all" }, "-=.2");
        tl.from(this.$(".game_deck"), 0.4, { opacity: 0, y: -20, clearProps: "all" }, "-=.2");
        tl.addLabel("enterCards");
        tl.staggerFrom(userCards, 0.2, { opacity: 0, marginTop: 20, clearProps: "opacity, marginTop", onStart: playSFX }, 0.1, "enterCards");
        tl.staggerFrom(opponentCards, 0.2, { opacity: 0, marginTop: 20, clearProps: "opacity, marginTop", onStart: playSFX }, 0.1, "enterCards");
        tl.call(() => {
            if (_$.state.game.get("playing") !== null) {
                proceed.call(this);
            } else {
                _$.events.once("firstPlayerSet", proceed, this);
            }
        }, [], null, "+=.2");

        function playSFX () {
            _$.audio.audioEngine.playSFX("cardSort");
        }

        function proceed () {
            if (_$.state.game.get("playing") === this.players.user) {
                this.ui.HUDuser.addClass("is--active");
            } else {
                this.ui.HUDopponent.addClass("is--active");
            }

            this.showTurnOverlay();
            _$.audio.audioEngine.playSFX("gameStart");
        }

        return this;
    }

    function transitionOut (nextScreen, fromMenu) {
        if (nextScreen === "title") {
            this.toTitleScreen();
        }
    }

    function renderCard (cardModel, index) {
        var cardView = new Elem_Card({ model: cardModel, deckIndex: index });

        if (cardModel.get("currentOwner") === this.players.user) {
            cardView.$el.on("mousedown", (e) => {
                dragCardStart.call(this, e, cardView);
            });
        }

        this.ui.cardsContainer.append(cardView.$el);

        if (cardModel.get("currentOwner") === this.players.user) {
            this.userCardViews.push(cardView);
        } else {
            this.opponentCardViews.push(cardView);
        }
    }

    function placeCardOnHolder (cardView) {
        var player      = (cardView.model.get("currentOwner") === this.players.user) ? "user" : "opponent";
        var destination = $(".game_playerHUD-" + player).find(".game_deck-holder").eq(cardView.deckIndex);
        var hidden      = !_$.state.game.get("rules").open && player === "opponent";
        var coords      = _$.utils.getDestinationCoord(cardView.$el, destination, { hidden });

        if (hidden) {
            TweenMax.set(cardView.$el, { x: coords.left, y: coords.top, rotationY: 180 });
        } else {
            TweenMax.set(cardView.$el, { x: coords.left, y: coords.top });
        }
    }

    function dragCardStart (e, cardView) {
        if (_$.state.game.get("playing") === this.players.opponent || cardView.boardCase || this.eventsDisabled) {
            return;
        }

        var that             = this;
        var prevX            = e.pageX;
        var prevY            = e.pageY;
        var originalPosition = {
            left: cardView.$el[0]._gsTransform.x,
            top : cardView.$el[0]._gsTransform.y
        };

        TweenMax.set(cardView.$el, { zIndex: 1000 });

        $(window).on("mousemove", dragCard);
        $(window).on("mouseup", dragCardStop);
        _$.audio.audioEngine.playSFX("cardGrab");

        function dragCard (e) {
            var deltaX = e.pageX - prevX;
            var deltaY = e.pageY - prevY;

            TweenMax.set(cardView.$el, {
                x: cardView.$el[0]._gsTransform.x + deltaX * _$.utils.getDragSpeed(),
                y: cardView.$el[0]._gsTransform.y + deltaY * _$.utils.getDragSpeed()
            });

            prevX = e.pageX;
            prevY = e.pageY;
        }

        function dragCardStop (e) {
            $(window).off("mousemove", dragCard);
            $(window).off("mouseup", dragCardStop);

            var scaledPageX = e.pageX * window.devicePixelRatio / _$.state.appScalar;
            var scaledPageY = e.pageY * window.devicePixelRatio / _$.state.appScalar;

            var boardOffset   = _$.utils.getAbsoluteOffset($("#board"));
            var boardPosition = {
                x1: boardOffset.left,
                x2: boardOffset.left + $("#board").outerWidth(),
                y1: boardOffset.top,
                y2: boardOffset.top + $("#board").outerHeight()
            };

            var nearestCase = $.nearest({ x: scaledPageX, y: scaledPageY }, $("#board .case"))[0];

            if (!that.board[nearestCase.id] &&
                scaledPageX >= boardPosition.x1 &&
                scaledPageX <= boardPosition.x2 &&
                scaledPageY >= boardPosition.y1 &&
                scaledPageY <= boardPosition.y2) {
                that.moveToBoard(nearestCase, cardView);
            } else {
                that.moveToOrigin(cardView, originalPosition);
            }
        }
    }

    function moveToBoard (boardCase, cardView) {
        var caseOffset = _$.utils.getDestinationCoord(cardView.$el, boardCase);

        cardView.boardCase = boardCase;
        cardView.$el.addClass("is--played");
        this.board[boardCase.id] = cardView;

        var tl = new TimelineMax();
        if (cardView.model.get("currentOwner") === this.players.opponent) {
            tl.set(cardView.$el, { zIndex: 1000 }); 
            if (_$.state.game.get("rules").open) {
                tl.to(cardView.$el, 0.4, { x: caseOffset.left, y: caseOffset.top });
            } else {
                tl.to(cardView.$el, 0.4, { x: caseOffset.left, y: caseOffset.top, rotationY: 0 });
            }
        } else {
            tl.to(cardView.$el, 0.2, { x: caseOffset.left, y: caseOffset.top });
        }
        tl.call(() => {
            _$.audio.audioEngine.playSFX("cardDrop");
        });
        tl.set(cardView.$el, { scale: "1", zIndex: 999 }, "+=.1");
        tl.call(() => {
            _$.state.game.placeCard(cardView.model, _$.utils.getPositionFromCaseName(boardCase.id));
        });
    }

    function moveToOrigin (cardView, originalPosition) {
        var tl = new TimelineMax();
        tl.to(cardView.$el, 0.2, { x: originalPosition.left, y: originalPosition.top });
        tl.set(cardView.$el, { scale: "1" }, "+=.1");
    }

    function placeOpponentCard (event, cardModel, caseName) {
        var cardView  = this.findCardViewsFromModels(this.opponentCardViews, cardModel)[0];
        var boardCase = this.$("#" + caseName)[0];

        setTimeout(() => {
            _$.audio.audioEngine.playSFX("cardGrab");
            this.moveToBoard(boardCase, cardView);
        }, 500);
    }

    function onResize () {
        var caseOffset;
        _.each(_.concat(this.userCardViews, this.opponentCardViews), (cardView) => {
            if (cardView.boardCase) {
                caseOffset = _$.utils.getDestinationCoord(cardView.$el, cardView.boardCase);
                TweenMax.to(cardView.$el, 0.2, { x: caseOffset.left, y: caseOffset.top });
            } else {
                placeCardOnHolder.call(this, cardView);
            }
        });
    }

    function updateScore (event, options = {}) {
        this.ui.HUDuser.find(".game_playerHUD-score").text(this.players.user.get("points"));
        this.ui.HUDopponent.find(".game_playerHUD-score").text(this.players.opponent.get("points"));

        if (options.nextTurn) {
            this.toNextTurn();
        } else if (options.endGame) {
            this.toEndGame();
        }
    }

    function toNextTurn () {
        _$.events.trigger("stopUserEvents");

        setTimeout(() => {
            if (_$.state.game.get("playing") === this.players.user) {
                this.ui.HUDuser.addClass("is--active");
                this.ui.HUDopponent.removeClass("is--active");
            } else {
                this.ui.HUDopponent.addClass("is--active");
                this.ui.HUDuser.removeClass("is--active");
            }

            this.showTurnOverlay();
            _$.audio.audioEngine.playSFX("titleLogo");
        }, 500);
    }

    function toEndGame () {
        _$.events.trigger("stopUserEvents");

        setTimeout(() => {
            this.ui.HUDopponent.removeClass("is--active");
            this.ui.HUDuser.removeClass("is--active"); 
            this.showEndGameOverlay();
        }, 500);
    }

    function showTurnOverlay () {
        if (_$.state.game.get("playing") === this.players.user) {
            this.$(".game_overlay-playerTurn h1").find("span").text("Your");
        } else {
            this.$(".game_overlay-playerTurn h1").find("span").text("Opponent's");
        }

        this.$(".game_overlay-playerTurn").addClass("is--active");
        setTimeout(() => {
            this.$(".game_overlay-playerTurn").removeClass("is--active");
            _$.events.trigger("startUserEvents");

            setTimeout(() => {
                if (_$.state.game.get("playing") === this.players.opponent) {
                    _$.state.game.promptOpponentAction();
                }
            }, 1000);
        }, 2000);
    }

    function showEndGameOverlay () {
        var gameResult;
        var tl = new TimelineMax({
            onComplete: () => {
                _$.events.trigger("startUserEvents");
            }
        });

        if (_$.state.game.get("winner") === this.players.user) {
            gameResult = "won";
            this.$(".game_overlay-endGame h1").append(" win!");
        } else if (_$.state.game.get("winner") === this.players.opponent) {
            gameResult = "lost";
            this.$(".game_overlay-endGame h1").append(" lose...");
        } else if (_$.state.game.get("winner") === "draw") {
            gameResult = "draw";
            this.$(".game_overlay-endGame h1").find("span").text("Draw");
        }

        if (gameResult === "won") {
            _$.audio.audioEngine.stopBGM({
                fadeDuration : 0.5,
                callback     : () => {
                    _$.audio.audioEngine.setBGM("bgm.win");
                    _$.audio.audioEngine.playBGM();

                    _$.events.once(_$.audio.audioEngine.getBGM("bgm.win").events.ended, () => {
                        _$.audio.audioEngine.setBGM("bgm.postWin");
                        _$.audio.audioEngine.playBGM();
                    });
                }
            });
        } else if (gameResult === "lost") {
            _$.audio.audioEngine.stopBGM({
                fadeDuration : 0.5,
                callback     : () => {
                    _$.audio.audioEngine.setBGM("bgm.lose");
                    _$.audio.audioEngine.playBGM();
                }
            });
        }

        if (gameResult === "draw" && _$.state.game.get("rules").suddenDeath) {
            this.$(".game_overlay-endGame-confirmBtn").text("Start next round");
            noCardSelection.call(this);
            this.postGameAction = () => {
                if (_$.state.room) {
                    this.$(".game_overlay-endGame-confirmBtn").text("Waiting for the other player...");
                    _$.comm.socketManager.emit("confirmEnd", null, this.toNextRound.bind(this));
                } else {
                    this.toNextRound();
                }
            };
        } else if ((gameResult === "draw" && _$.state.game.get("rules").trade !== "direct") || _$.state.game.get("rules").trade === "none") {
            this.$(".game_overlay-endGame-confirmBtn").text("Go back to title screen");
            noCardSelection.call(this);
            this.postGameAction = () => {
                if (_$.state.room) {
                    this.$(".game_overlay-endGame-confirmBtn").text("Waiting for the other player...");
                    _$.comm.socketManager.emit("confirmEnd", null, this.toTitleScreen.bind(this));
                } else {
                    this.toTitleScreen();
                }
            };
        } else if (_$.state.game.get("rules").trade !== "none") {
            this.$(".game_overlay-endGame-confirmBtn").text("Confirm & Go back to title screen");
            cardSelection.call(this);
            this.postGameAction = () => {
                if (_$.state.room) {
                    this.$(".game_overlay-endGame-confirmBtn").text("Waiting for the other player...");
                    _$.comm.socketManager.emit("confirmEnd", null, this.confirmCardSelection.bind(this));
                } else {
                    this.confirmCardSelection();
                }
            };
        }

        function noCardSelection () {
            this.$(".game_overlay-endGame-album-opponent, .game_overlay-endGame-album-user").remove();

            tl.call(() => { this.$(".game_overlay-endGame").addClass("is--active"); });
            tl.call(() => { this.$(".game_overlay-endGame-confirmBtn").slideDown(400); }, [], null, "+=0.8");
        }

        function cardSelection () {
            tl.call(() => { this.$(".game_overlay-endGame").addClass("is--active"); });

            var i, ii;
            var endGameCardView;
            for (i = 0, ii = _$.state.game.get("originalDecks").user.length; i < ii; i++) {
                endGameCardView = new Elem_EndGameCard({ card: _$.state.game.get("originalDecks").user[i], deckIndex: i });
                this.$(".game_overlay-endGame-album-user").append(endGameCardView.$el);
                this.userEndGameCardViews.push(endGameCardView);

                _$.utils.fadeIn(endGameCardView.$el, null, 0.5, 1 + 0.15 * i);
            }

            for (i = 0, ii = _$.state.game.get("originalDecks").opponent.length; i < ii; i++) {
                endGameCardView = new Elem_EndGameCard({ card: _$.state.game.get("originalDecks").opponent[i], deckIndex: i });
                this.$(".game_overlay-endGame-album-opponent").append(endGameCardView.$el);
                this.opponentEndGameCardViews.push(endGameCardView);

                _$.utils.fadeIn(endGameCardView.$el, null, 0.5, 1 + 0.15 * i);
            }

            if (_$.state.game.get("rules").trade === "one" || _$.state.game.get("rules").trade === "difference") {
                if (_$.state.room) {
                    _$.events.on("getSelectedCards", this.getOpponentSelectedCards, this);
                    _$.comm.socketManager.emit("getSelectedCards");
                }

                if (gameResult === "won") {
                    tl.set(this.$(".game_overlay-endGame h1"), { transition: "none" }, "+=2");
                    tl.to(this.$(".game_overlay-endGame h1"), 0.4, { opacity: 0 });
                    tl.call(() => {
                        var span = this.$(".game_overlay-endGame h1").find("span").text("Choose");
                        var text = (_$.state.game.get("cardsToTrade") > 1) ? " " + _$.state.game.get("cardsToTrade") + " cards" : " 1 card";
                        this.$(".game_overlay-endGame h1").html(span).append(text);
                    });
                    tl.to(this.$(".game_overlay-endGame h1"), 0.4, { opacity: 1, clearProps: "all" });

                    if (_$.state.game.get("cardsToTrade") === 5) {
                        this.gainedCards = this.opponentEndGameCardViews;
                        autoFlipCards(this.gainedCards, true);
                    }
                } else if (gameResult === "lost") {
                    if (_$.state.game.get("type") === "solo") {
                        this.lostCards = this.findCardViewsFromModels(this.userEndGameCardViews, _$.state.game.getLostCards(), "cardView");
                        autoFlipCards(this.lostCards);
                    } else {
                        this.$(".game_overlay-endGame-confirmBtn").slideDown(400);
                    }
                }
            } else if (_$.state.game.get("rules").trade === "all") {
                if (gameResult === "won") {
                    this.gainedCards = this.opponentEndGameCardViews;
                    autoFlipCards(this.gainedCards, true);
                } else if (gameResult === "lost") {
                    this.lostCards = this.userEndGameCardViews;
                    autoFlipCards(this.lostCards);
                }
            } else if (_$.state.game.get("rules").trade === "direct") {
                this.gainedCards = _.filter(this.opponentEndGameCardViews, (endGameCardView) => {
                    return endGameCardView.cardView.model.get("currentOwner") === this.players.user;
                });

                this.lostCards = _.filter(this.userEndGameCardViews, (endGameCardView) => {
                    return endGameCardView.cardView.model.get("currentOwner") === this.players.opponent;
                });

                autoFlipCards(this.gainedCards, true);
                autoFlipCards(this.lostCards);
            }

            function autoFlipCards (cardsArray, gainCard) {
                var subTL = new TimelineMax();
                _.each(cardsArray, function (endGameCardView, index) {
                    subTL.call(() => {
                        if (gainCard) {
                            endGameCardView.selectCard();
                        } else {
                            endGameCardView.cardView.flip();
                        }
                    }, [], null, 0.15 * index);
                });

                tl.add(subTL, "+=1");

                if (!this.$(".game_overlay-endGame-confirmBtn").is(":visible")) {
                    tl.call(() => {
                        this.$(".game_overlay-endGame-confirmBtn").slideDown(400);
                    }, [], null, "+=.4");
                }
            }
        }
    }

    function findCardViewsFromModels (cardViewList, modelList, customPath) {
        if (!_.isArray(cardViewList)) {
            cardViewList = [cardViewList];
        }

        if (!_.isArray(modelList)) {
            modelList = [modelList];
        }

        return _.filter(cardViewList, (cardView) => {
            return _.some(modelList, (model) => {
                return _.get(cardView, customPath + ".model", cardView.model) === model;
            });
        });
    }

    function flipCard (event, info) {
        var cardView = this.board[info.caseName];
        cardView.flip(info);
    }

    function showElementalBonus (event, info) {
        this.$("#" + info.caseName).addClass("has--" + info.bonusType);
    }

    function toTitleScreen () {
        _$.events.trigger("stopUserEvents");
        _$.audio.audioEngine.stopBGM({ fadeDuration: 1 });
        _$.events.off(_$.audio.audioEngine.getBGM("bgm.win").events.ended);
        _$.state.game.resetCardAttributes();

        if (_$.state.room) {
            _$.comm.socketManager.emit("playerReset");
        }

        var tl = new TimelineMax();
        tl.call(() => { this.$(".game_overlay-endGame").removeClass("is--active"); });
        tl.to(this.$(".game_wrapper"), 0.4, { opacity: 0 });
        if (_$.ui.footer.isOpen) {
            tl.add(_$.ui.footer.toggleFooter(), 0);
        }
        tl.call(onTransitionComplete.bind(this));

        function onTransitionComplete () {
            _$.utils.addDomObserver(this.$el, () => {
                _$.events.trigger("startUserEvents");

                var Screen_Title = require("views/screen_title");
                _$.ui.screen     = new Screen_Title();
            }, true, "remove");
            this.remove();
        }
    }

    function toNextRound () {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        tl.call(() => { this.$(".game_overlay-endGame").removeClass("is--active"); });
        tl.to(this.$el, 0.8, { opacity: 0, clearProps: "all" }, "+=0.8");
        tl.call(() => {
            this.$el.empty();
            onTransitionComplete.call(this);
        });

        function onTransitionComplete () {
            var rules       = _$.state.game.get("rules");
            var computer    = _$.state.game.get("computer");
            var newPlayers  = { user: this.players.user, opponent: this.players.opponent };
            var roundNumber = _$.state.game.get("roundNumber") + 1;

            if (roundNumber === 4) {
                rules.suddenDeath = false;
            }

            _$.utils.addDomObserver(this.$el, () => {
                _$.events.trigger("startUserEvents");
                this.initialize({ players: newPlayers, rules, computer, roundNumber });
            }, true, "remove");
            this.remove();
        }
    }

    function confirmCardSelection () {
        var span       = this.$(".game_overlay-endGame h1").find("span");
        var gainedLost = { gained: [], lost: [] };

        var tl = new TimelineMax();
        tl.set(this.$(".game_overlay-endGame h1"), { transition: "none" });
        tl.call(() => { this.$(".game_overlay-endGame-confirmBtn").slideUp(400); });
        tl.to(this.$(".game_overlay-endGame h1"), 0.4, { opacity: 0 }, tl.recent().endTime() + 0.4);
        tl.staggerTo([this.$(".game_overlay-endGame-album-opponent"), this.$(".game_overlay-endGame-album-user")], 0.4, { opacity: 0 }, 0.2);
        tl.staggerTo([this.$(".game_overlay-endGame-album-opponent"), this.$(".game_overlay-endGame-album-user")], 0.4, { height: 0, marginTop: 0, marginBottom: 0 }, 0.2);
        tl.call(() => {
            this.$(".game_overlay-endGame-confirmBtn").remove();
            this.$(".game_overlay-endGame-album-opponent").remove();
            this.$(".game_overlay-endGame-album-user").remove();

            proceed.call(this);
        });

        function proceed () {
            if (this.gainedCards.length) {
                gainedLost.gained = _.map(this.gainedCards, (endGameCardView) => { return endGameCardView.cardView.model; });
                showGains.call(this, this.gainedCards, "Gained");
            }

            if (this.lostCards.length) {
                gainedLost.lost = _.map(this.lostCards, (endGameCardView) => { return endGameCardView.cardView.model; });
                showGains.call(this, this.lostCards, "Lost");
            }

            _$.state.game.updateUserAlbum(gainedLost);
            tl.call(this.toTitleScreen.bind(this));
        }

        function showGains (cardsArray, text) {
            tl.to(this.$(".game_overlay-endGame h1"), 0.4, { opacity: 0 });
            tl.call(() => {
                this.$(".game_overlay-endGame h1").html(span.text(text)).append(" cards");
            });
            tl.to(this.$(".game_overlay-endGame h1"), 0.4, { opacity: 1, marginBottom: "1em" });

            var subTL = new TimelineMax();
            for (let i = 0, ii = cardsArray.length; i < ii; i++) {
                subTL.call(() => {
                    this.$(".game_overlay-endGame").append(cardsArray[i].$el);
                    TweenMax.set(cardsArray[i].$el, { clearProps: "all" });
                    _$.audio.audioEngine.playSFX("gameGain");

                    if (i === 0) {
                        TweenMax.from(cardsArray[i].$el, 0.4, { opacity: 0, height: 0 });
                    } else {
                        TweenMax.from(cardsArray[i].$el, 0.4, { opacity: 0 });
                    }
                });

                if (i === ii - 1) {
                    subTL.to([cardsArray[i].$el, this.$(".game_overlay-endGame h1")], 0.4, { opacity: 0 }, "+=2");

                    if (cardsArray === this.gainedCards && this.lostCards.length) {
                        subTL.call(() => {
                            cardsArray[i].$el.remove();
                        });
                    }
                } else {
                    subTL.to(cardsArray[i].$el, 0.4, { opacity: 0 }, "+=2");
                    subTL.call(() => {
                        cardsArray[i].$el.remove();
                    });
                }
            }

            tl.add(subTL);
        }
    }

    function endGameCardSelected (event, info) {
        if (info.selected) {
            if (!_.includes(this.gainedCards, info.endGameCardView)) {
                this.gainedCards.push(info.endGameCardView);
                if ((_$.state.game.get("rules").trade === "one" || _$.state.game.get("rules").trade === "difference") &&
                    (this.gainedCards.length > _$.state.game.get("cardsToTrade"))) {
                    this.gainedCards[0].selectCard();
                }
            }
        } else {
            _.remove(this.gainedCards, info.endGameCardView);
        }

        if (_$.state.room) {
            _$.comm.socketManager.emit("setSelectedCards", _.map(this.gainedCards, "deckIndex"));
        }

        if ((_$.state.game.get("rules").trade === "one" || _$.state.game.get("rules").trade === "difference")) {
            if (this.gainedCards.length === _$.state.game.get("cardsToTrade")) {
                if (!this.$(".game_overlay-endGame-confirmBtn").is(":visible")) {
                    this.$(".game_overlay-endGame-confirmBtn").slideDown(400);
                }
            } else if (this.$(".game_overlay-endGame-confirmBtn").is(":visible")) {
                this.$(".game_overlay-endGame-confirmBtn").slideUp(400);
            }
        }
    }

    function getOpponentSelectedCards (eventName, response) {
        var opponentSelectedCards = response.msg;

        if (opponentSelectedCards) {
            this.lostCards = _.filter(this.userEndGameCardViews, (endGameCardView) => {
                return _.some(opponentSelectedCards, (deckIndex) => {
                    return endGameCardView.deckIndex === deckIndex;
                });
            });

            var tl = new TimelineMax();
            _.each(this.lostCards, function (endGameCardView, index) {
                tl.call(() => {
                    endGameCardView.cardView.flip();
                }, [], null, 0.15 * index);
            });
        }
    }
});
