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
        id        : "screen_game",

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

        transitionIn
    });

    function initialize (options) {
        var that        = this;
        _$.state.inGame = true;
        _$.state.game   = new Model_Game({ difficulty: _$.state.user.get("difficulty") }, options);

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

        if (_$.state.game.get("rules").elemental) {
             _.each(_$.state.game.elementCases, (element, boardCase) => {
                if (element) {
                    this.$("#" + boardCase).addClass("element-" + element);
                }
            });
        }

        if (_$.state.game.playing === this.players.user) {
            this.ui.HUDuser.addClass("is--active");
        } else {
            this.ui.HUDopponent.addClass("is--active");
        }

        var cardBG = $(_$.assets.get("svg.ui.cardBG"));
        this.$(".game_deck-holder").append(cardBG);

        this.cardViews   = [];
        this.lostCards   = [];
        this.gainedCards = [];
        this.board       = {
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

        this.postGameAction = null;

        _.each(this.players.user.get("deck"), (cardModel, index) => {
            if (!cardModel.owner) {
                cardModel.owner        = this.players.user;
                cardModel.currentOwner = this.players.user;
            }

            renderCard.call(this, cardModel, index);
        });

        _.each(this.players.opponent.get("deck"), (cardModel, index) => {
            if (!cardModel.owner) {
                cardModel.owner        = this.players.opponent;
                cardModel.currentOwner = this.players.opponent;
            }

            renderCard.call(this, cardModel, index);
        });

        _$.events.on("resize", this.onResize.bind(this));
        _$.events.on("updateScore", this.updateScore.bind(this));
        _$.events.on("toNextTurn", this.toNextTurn.bind(this));
        _$.events.on("toEndGame", this.toEndGame.bind(this));
        _$.events.on("flipCard", this.flipCard.bind(this));
        _$.events.on("showElementalBonus", this.showElementalBonus.bind(this));
        _$.events.on("endGameCardSelected", this.endGameCardSelected.bind(this));

        _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
        _$.audio.audioEngine.setBGM("bgm.game");
        _$.audio.audioEngine.playBGM();
        this.add();
    }

    function remove () {
        _$.events.off("resize", this.onResize.bind(this));
        _$.events.off("updateScore", this.updateScore.bind(this));
        _$.events.off("toNextTurn", this.toNextTurn.bind(this));
        _$.events.off("toEndGame", this.toEndGame.bind(this));
        _$.events.off("flipCard", this.flipCard.bind(this));
        _$.events.off("showElementalBonus", this.showElementalBonus.bind(this));
        _$.events.off("endGameCardSelected", this.endGameCardSelected.bind(this));

        _$.state.inGame = false;
        delete _$.state.game;

        Backbone.View.prototype.remove.call(this);
    }

    function transitionIn () {
        _$.events.trigger("stopUserEvents");

        _.each(this.cardViews, (cardView) => {
            placeCardOnHolder.call(this, cardView);
        });

        var blueCards = this.ui.cardsContainer.children().slice(0, 5);
        var redCards  = this.ui.cardsContainer.children().slice(5, 10);

        var tl = new TimelineMax();
        tl.from(this.ui.board, 0.4, { opacity: 0, scale: "1.2", clearProps: "all" });
        tl.from([this.ui.HUDuser, this.ui.HUDopponent], 0.4, { width: 0, opacity: 0, clearProps: "all" });
        tl.staggerFrom([this.$(".game_playerHUD-avatar"), this.$(".game_playerHUD-bar-type"), this.$(".game_playerHUD-bar-state")], 0.4, { opacity: 0, clearProps: "all" }, 0.2);
        tl.from(this.$(".game_playerHUD-score"), 0.4, { opacity: 0, y: -20, clearProps: "all" }, "-=.2");
        tl.from(this.$(".game_deck"), 0.4, { opacity: 0, y: -20, clearProps: "all" }, "-=.2");
        tl.addLabel("enterCards");
        tl.staggerFrom(blueCards, 0.2, { opacity: 0, marginTop: 20, clearProps: "opacity, marginTop", onStart: playSFX }, 0.1, "enterCards");
        tl.staggerFrom(redCards, 0.2, { opacity: 0, marginTop: 20, clearProps: "opacity, marginTop", onStart: playSFX }, 0.1, "enterCards");
        tl.call(() => {
            _$.events.trigger("startUserEvents");
            this.showTurnOverlay();
            _$.audio.audioEngine.playSFX("gameStart");
        }, [], null, "+=.2");

        function playSFX () {
            _$.audio.audioEngine.playSFX("cardSort");
        }

        return this;
    }

    function renderCard (cardModel, index) {
        var cardView = new Elem_Card({ model: cardModel, deckIndex: index });

        //if (cardModel.currentOwner === this.players.user) {
            cardView.$el.on("mousedown", (e) => {
                dragCardStart.call(this, e, cardView);
            });
        //}

        this.ui.cardsContainer.append(cardView.$el);
        this.cardViews.push(cardView);
    }

    function placeCardOnHolder (cardView) {
        var player      = (cardView.model.currentOwner === this.players.user) ? "user" : "opponent";
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
        if (/*_$.state.game.playing === this.players.opponent ||*/ cardView.boardCase) {
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
                x: cardView.$el[0]._gsTransform.x + deltaX * 1.25,
                y: cardView.$el[0]._gsTransform.y + deltaY * 1.25
            });

            prevX = e.pageX;
            prevY = e.pageY;
        }

        function dragCardStop (e) {
            $(window).off("mousemove", dragCard);
            $(window).off("mouseup", dragCardStop);
            _$.audio.audioEngine.playSFX("cardDrop");

            var scaledPageX = e.pageX * window.devicePixelRatio;
            var scaledPageY = e.pageY * window.devicePixelRatio;

            var boardOffset   = _$.utils.getAbsoluteOffset($("#board"));
            var boardPosition = {
                x1: boardOffset.left,
                x2: boardOffset.left + $("#board").width(),
                y1: boardOffset.top,
                y2: boardOffset.top + $("#board").height()
            };

            var nearestCase = $.nearest({ x: e.pageX, y: e.pageY }, $("#board .case"))[0];
            var caseOffset  = _$.utils.getAbsoluteOffset(nearestCase);

            if (!that.board[nearestCase.id] && scaledPageX >= boardPosition.x1 && scaledPageX <= boardPosition.x2 && scaledPageY >= boardPosition.y1 && scaledPageY <= boardPosition.y2) {
                that.moveToBoard(nearestCase, cardView);
            } else {
                that.moveToOrigin(cardView, originalPosition);
            }
        }
    }

    function moveToBoard (boardCase, cardView) {
        var caseOffset = _$.utils.getDestinationCoord(cardView.$el, boardCase);

        var tl = new TimelineMax();
        if (!_$.state.game.get("rules").open && cardView.model.currentOwner === this.players.opponent) {
            tl.to(cardView.$el, 0.2, { x: caseOffset.left, y: caseOffset.top, rotationY: 0 });
        } else {
            tl.to(cardView.$el, 0.2, { x: caseOffset.left, y: caseOffset.top });
        }
        tl.set(cardView.$el, { scale: "1", zIndex:999 }, "+=.1");

        cardView.model.position = {
            x: parseInt(boardCase.id.match(/\d/g)[1]),
            y: parseInt(boardCase.id.match(/\d/g)[0])
        };
        cardView.boardCase = boardCase;
        cardView.$el.addClass("is--played");

        this.board[boardCase.id] = cardView;
        _$.state.game.updateBoard(cardView.model);
    }

    function moveToOrigin (cardView, originalPosition) {
        var tl = new TimelineMax();
        tl.to(cardView.$el, 0.2, { x: originalPosition.left, y: originalPosition.top });
        tl.set(cardView.$el, { scale: "1" }, "+=.1");
    }

    function onResize () {
        var caseOffset;
        _.each(this.cardViews, (cardView) => {
            if (cardView.boardCase) {
                caseOffset = _$.utils.getDestinationCoord(cardView.$el, cardView.boardCase);
                TweenMax.to(cardView.$el, 0.2, { x: caseOffset.left, y: caseOffset.top });
            } else {
                placeCardOnHolder.call(this, cardView);
            }
        });
    }

    function updateScore (options = {}) {
        this.ui.HUDuser.find(".game_playerHUD-score").text(this.players.user.get("points"));
        this.ui.HUDopponent.find(".game_playerHUD-score").text(this.players.opponent.get("points"));

        if (options.nextTurn) {
            this.toNextTurn();
        } else if (options.endGame) {
            this.toEndGame();
        }
    }

    function toNextTurn () {
        setTimeout(() => {
            if (_$.state.game.playing === this.players.user) {
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
        setTimeout(() => {
            this.ui.HUDopponent.removeClass("is--active");
            this.ui.HUDuser.removeClass("is--active"); 
            this.showEndGameOverlay();
        }, 500);
    }

    function showTurnOverlay () {
        if (_$.state.game.playing === this.players.user) {
            this.$(".game_overlay-playerTurn h1").find("span").text("Your");
        } else {
            this.$(".game_overlay-playerTurn h1").find("span").text("Opponent's");
        }

        this.$(".game_overlay-playerTurn").addClass("is--active");
        setTimeout(() => {
            this.$(".game_overlay-playerTurn").removeClass("is--active");
        }, 2000);
    }

    function showEndGameOverlay () {
        var gameResult;
        var tl;

        if (_$.state.game.winner === this.players.user) {
            gameResult = "won";
            this.$(".game_overlay-endGame h1").append(" win!");
        } else if (_$.state.game.winner === this.players.opponent) {
            gameResult = "lost";
            this.$(".game_overlay-endGame h1").append(" lose...");
        } else if (_$.state.game.winner === "draw") {
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
            this.postGameAction = this.toNextRound.bind(this);
        } else if ((gameResult === "draw" && _$.state.game.get("rules").trade !== "direct") || _$.state.game.get("rules").trade === "none") {
            this.$(".game_overlay-endGame-confirmBtn").text("Go back to title screen");
            noCardSelection.call(this);
            this.postGameAction = this.toTitleScreen.bind(this);
        } else if (_$.state.game.get("rules").trade !== "none") {
            this.$(".game_overlay-endGame-confirmBtn").text("Confirm & Go back to title screen");
            cardSelection.call(this);
            this.postGameAction = this.confirmCardSelection.bind(this);
        }

        function noCardSelection () {
            this.$(".game_overlay-endGame-album-opponent, .game_overlay-endGame-album-user").remove();

            tl = new TimelineMax();
            tl.call(() => { this.$(".game_overlay-endGame").addClass("is--active"); });
            tl.call(() => { this.$(".game_overlay-endGame-confirmBtn").slideDown(400); }, [], null, "+=0.8");
        }

        function cardSelection () {
            var userEndGameCardViews     = [];
            var opponentEndGameCardViews = [];

            tl = new TimelineMax();
            tl.call(() => { this.$(".game_overlay-endGame").addClass("is--active"); });

            var endGameCardView;
            for (let i = 0, ii = _$.state.game.originalDecks.user.length; i < ii; i++) {
                endGameCardView = new Elem_EndGameCard({ card: _$.state.game.originalDecks.user[i] });
                this.$(".game_overlay-endGame-album-user").append(endGameCardView.$el);
                userEndGameCardViews.push(endGameCardView);

                _$.utils.fadeIn(endGameCardView.$el, null, 0.5, 1 + 0.15 * i);
            }

            for (let i = 0, ii = _$.state.game.originalDecks.opponent.length; i < ii; i++) {
                endGameCardView = new Elem_EndGameCard({ card: _$.state.game.originalDecks.opponent[i] });
                this.$(".game_overlay-endGame-album-opponent").append(endGameCardView.$el);
                opponentEndGameCardViews.push(endGameCardView);

                _$.utils.fadeIn(endGameCardView.$el, null, 0.5, 1 + 0.15 * i);
            }

            if (_$.state.game.get("rules").trade === "one" || _$.state.game.get("rules").trade === "difference") {
                if (gameResult === "won") {
                    tl.set(this.$(".game_overlay-endGame h1"), { transition: "none" }, "+=2");
                    tl.to(this.$(".game_overlay-endGame h1"), 0.4, { opacity: 0 });
                    tl.call(() => {
                        var span = this.$(".game_overlay-endGame h1").find("span").text("Choose");
                        var text = (_$.state.game.cardsToTrade > 1) ? " " + _$.state.game.cardsToTrade + " cards" : " 1 card";
                        this.$(".game_overlay-endGame h1").html(span).append(text);
                    });
                    tl.to(this.$(".game_overlay-endGame h1"), 0.4, { opacity: 1, clearProps: "all" });

                    if (_$.state.game.cardsToTrade === 5) {
                        this.gainedCards = opponentEndGameCardViews;
                        autoFlipCards(this.gainedCards, true);
                    }
                } else if (gameResult === "lost") {
                    this.lostCards = _.filter(userEndGameCardViews, (endGameCardView) => {
                        return _.some(_$.state.game.computerInfo.selectedCards, (selectedCard) => {
                            return endGameCardView.cardView.model === selectedCard;
                        });
                    });

                    autoFlipCards(this.lostCards);
                }
            } else if (_$.state.game.get("rules").trade === "all") {
                if (gameResult === "won") {
                    this.gainedCards = opponentEndGameCardViews;
                    autoFlipCards(this.gainedCards, true);
                } else if (gameResult === "lost") {
                    this.lostCards = userEndGameCardViews;
                    autoFlipCards(this.lostCards);
                }
            } else if (_$.state.game.get("rules").trade === "direct") {
                this.gainedCards = _.filter(opponentEndGameCardViews, (endGameCardView) => {
                    return endGameCardView.cardView.model.currentOwner === this.players.user;
                });

                this.lostCards = _.filter(userEndGameCardViews, (endGameCardView) => {
                    return endGameCardView.cardView.model.currentOwner === this.players.opponent;
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

    function flipCard (info) {
        var cardView = this.board[info.boardCase];
        cardView.flip(info);
    }

    function showElementalBonus (info) {
        this.$("#" + info.boardCase).addClass("has--" + info.bonusType);
    }

    function toTitleScreen () {
        _$.events.trigger("stopUserEvents");
        _$.audio.audioEngine.stopBGM({ fadeDuration: 1 });

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
            var rules      = _$.state.game.get("rules");
            var newPlayers = { user: this.players.user, opponent: this.players.opponent };

            _$.utils.addDomObserver(this.$el, () => {
                _$.events.trigger("startUserEvents");
                this.initialize({ players: newPlayers, rules: rules });
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

    function endGameCardSelected (info) {
        if (info.selected) {
            if (!_.includes(this.gainedCards, info.endGameCardView)) {
                this.gainedCards.push(info.endGameCardView);
                if ((_$.state.game.get("rules").trade === "one" || _$.state.game.get("rules").trade === "difference") &&
                    (this.gainedCards.length > _$.state.game.cardsToTrade)) {
                    this.gainedCards[0].selectCard();
                }
            }
        } else {
            _.remove(this.gainedCards, info.endGameCardView);
        }

        if ((_$.state.game.get("rules").trade === "one" || _$.state.game.get("rules").trade === "difference")) {
            if (this.gainedCards.length === _$.state.game.cardsToTrade) {
                if (!this.$(".game_overlay-endGame-confirmBtn").is(":visible")) {
                    this.$(".game_overlay-endGame-confirmBtn").slideDown(400);
                }
            } else if (this.$(".game_overlay-endGame-confirmBtn").is(":visible")) {
                this.$(".game_overlay-endGame-confirmBtn").slideUp(400);
            }
        }
    }
});
