define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "models/model_game",
    "views/screen",
    "text!templates/templ_game.html",
    "views/elem_card",
    "tweenMax"
], function Screen_Game ($, _, Backbone, _$, Model_Game, Screen, Templ_Game, Elem_Card) {
    return Screen.extend({
        id        : "screen_game",

        template : _.template(Templ_Game),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
            "mouseenter .card-blue:not(.is--played)" : function (e) { TweenMax.set(e.currentTarget, { scale: "1.1" }); },
            "mouseleave .card-blue"                  : function (e) { TweenMax.set(e.currentTarget, { scale: "1" }); },
            "click .game_overlay-endGame-confirmBtn" : function ()  { this.postGameAction(); }
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
        toNextRound
    });

    function initialize (options) {
        var that        = this;
        _$.state.inGame = true;
        _$.state.game   = new Model_Game({}, options);

        this.players = _$.state.game.get("players");
        this.$el.html(this.template({
            userName       : this.players.user.get("name"),
            userPoints     : this.players.user.get("points"),
            userAvatar     : this.players.user.get("avatar"),
            opponentName   : this.players.opponent.get("name"),
            opponentPoints : this.players.opponent.get("points"),
            opponentAvatar : this.players.opponent.get("avatar"),
            opponentType   : this.players.opponent.get("type")
        }));

        this.ui              = {};
        this.ui.board        = this.$("#board");
        this.ui.cardsWrapper = this.$("#cardsWrapper");
        this.ui.HUDuser      = this.$(".game_playerHUD-user");
        this.ui.HUDopponent  = this.$(".game_playerHUD-opponent");

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

        this.cardViews = [];
        this.board     = {
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

        _$.utils.addDomObserver(this.$el, () => {
            _.each(this.cardViews, (cardView) => {
                placeCardOnHolder.call(this, cardView);
            });

            this.showTurnOverlay();
        }, true);

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
        this.add();
    }

    function remove () {
        _$.events.off("resize", this.onResize.bind(this));
        _$.events.off("updateScore", this.updateScore.bind(this));
        _$.events.off("toNextTurn", this.toNextTurn.bind(this));
        _$.events.off("toEndGame", this.toEndGame.bind(this));
        _$.events.off("flipCard", this.flipCard.bind(this));
        _$.events.off("showElementalBonus", this.showElementalBonus.bind(this));

        _$.state.inGame = false;
        delete _$.state.game;

        Backbone.View.prototype.remove.call(this);
    }

    function renderCard (cardModel, index) {
        var cardView = new Elem_Card({ model: cardModel, deckIndex: index });

        //if (cardModel.currentOwner === this.players.user) {
            cardView.$el.on("mousedown", (e) => {
                dragCardStart.call(this, e, cardView);
            });
        //}

        this.ui.cardsWrapper.append(cardView.$el);
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
        if (_$.state.game.playing === this.players.user) {
            this.ui.HUDuser.addClass("is--active");
            this.ui.HUDopponent.removeClass("is--active");
        } else {
            this.ui.HUDopponent.addClass("is--active");
            this.ui.HUDuser.removeClass("is--active");
        }

        this.showTurnOverlay();
    }

    function toEndGame () {
        this.ui.HUDopponent.removeClass("is--active");
        this.ui.HUDuser.removeClass("is--active");    
        this.showEndGameOverlay();
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
        var result;
        var tl;

        if (_$.state.game.winner === this.players.user) {
            result = "won";
            this.$(".game_overlay-endGame h1").append(" win!");
        } else if (_$.state.game.winner === this.players.opponent) {
            result = "lost";
            this.$(".game_overlay-endGame h1").append(" lose...");
        } else if (_$.state.game.winner === "draw") {
            result = "draw";
            this.$(".game_overlay-endGame h1").find("span").text("Draw");
        }

        if (result === "draw" && _$.state.game.get("rules").suddenDeath) {
            this.$(".game_overlay-endGame-confirmBtn").text("Start next round");
            noCardSelection();
            this.postGameAction = this.toNextRound.bind(this);
        } else if (result === "draw" || _$.state.game.get("rules").trade === "none") {
            this.$(".game_overlay-endGame-confirmBtn").text("Go back to title screen");
            noCardSelection();
            this.postGameAction = this.toTitleScreen.bind(this);
        } else if (_$.state.game.get("rules").trade !== "none") {
            this.$(".game_overlay-endGame-confirmBtn").text("Confirm & Go back to title screen");
            cardSelection();
            this.postGameAction = this.confirmCardSelection.bind(this);
        }

        function noCardSelection () {
            tl = new TimelineMax();
            tl.call(() => { this.$(".game_overlay-endGame").addClass("is--active"); });
            tl.from(this.$(".game_overlay-endGame-confirmBtn"), 0.4, { marginTop: 0 }, "+=0.8");
            tl.from(this.$(".game_overlay-endGame-confirmBtn"), 0.4, { height: 0, padding: 0, opacity: 0, clearProps:"all" });
        }

        function cardSelection () {

        }
    }

    function flipCard (info) {
        var cardView = this.board[info.boardCase];
        var tl = new TimelineMax();

        if (info.from === "top") {
            tl.to(cardView.$el, 0.4, { rotationX: -180 });
        } else if (info.from === "right") {
            tl.to(cardView.$el, 0.4, { rotationY: 180 });
        } else if (info.from === "bottom") {
            tl.to(cardView.$el, 0.4, { rotationX: 180 });
        } else if (info.from === "left") {
            tl.to(cardView.$el, 0.4, { rotationY: -180 });
        }

        tl.call(function () {
            cardView.$el.toggleClass("card-blue card-red");
        });

        if (info.from === "top") {
            tl.to(cardView.$el, 0.4, { rotationX: -360 });
        } else if (info.from === "right") {
            tl.to(cardView.$el, 0.4, { rotationY: 360 });
        } else if (info.from === "bottom") {
            tl.to(cardView.$el, 0.4, { rotationX: 360 });
        } else if (info.from === "left") {
            tl.to(cardView.$el, 0.4, { rotationY: -360 });
        }
    }

    function showElementalBonus (info) {
        this.$("#" + info.boardCase).addClass("has--" + info.bonusType);
    }

    function toTitleScreen () {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        tl.call(() => { this.$(".game_overlay-endGame").removeClass("is--active"); });
        tl.to(this.$el, 1, { opacity: 0 }, "+=0.8");
        tl.call(() => {
            this.$el.hide();
            onTransitionComplete.call(this);
        });

        function onTransitionComplete () {
            _$.utils.addDomObserver(this.$el, () => {
                var Screen_Title = require("views/screen_title");

                _$.events.trigger("startUserEvents");
                _$.state.screen = new Screen_Title();
            }, true, "remove");
            this.remove();
        }
    }

    function toNextRound () {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        tl.call(() => { this.$(".game_overlay-endGame").removeClass("is--active"); });
        tl.to(this.$el, 1, { opacity: 0, clearProps:"all" }, "+=0.8");
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
});
