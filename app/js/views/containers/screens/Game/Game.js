import $ from 'jquery';
import { template, concat, clone, each, map, startCase, filter, isArray, some, get, includes, remove as _remove, difference } from 'lodash';
import { TweenMax, TimelineMax } from 'gsap';

import _$ from 'common';
import Model_Game from 'Models/Game';
import Screen from 'Screens/Screen';
import Screen_Lounge from 'Screens/Lounge';
import Screen_Title from 'Screens/Title';
import Comp_EndGameCard from 'Components/EndGameCard';
import Comp_Card from 'Components/Card';
import Templ_Game from './template.ejs';

import svgCardBG from '!svg-inline-loader!Assets/svg/ui/cardBG.svg';

export default Screen.extend({
  id       : "screen_game",
  template : template(Templ_Game),
  events   : {
    /* eslint-disable object-shorthand */
    "mouseenter #cardsContainer .card-blue:not(.is--played)" : function (e) {
      if (!this.isDraggingCard) {
        _$.audio.audioEngine.playSFX("cardSort");
      }
      TweenMax.set(e.currentTarget, { scale: "1.1" });
    },
    "mouseleave #cardsContainer .card-blue"                  : function (e) { TweenMax.set(e.currentTarget, { scale: "1" }); },
    "click .game_overlay-endGame-confirmBtn" : function ()  {
      this.postGameAction();
      _$.audio.audioEngine.playSFX("uiConfirm");
    },
    "mouseenter .game_overlay-endGame-confirmBtn" : function ()  {
      _$.audio.audioEngine.playSFX("uiHover");
    }
    /* eslint-enable */
  },

  initialize,
  remove,
  renderCard,
  moveToBoard,
  moveToOrigin,
  onResize,

  setupElementBoard,
  showTurnOverlay,
  showEndGameOverlay,
  toNextPhase,
  toNextTurn,
  toEndGame,
  showElementalBonus,
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
  // Disable lag smoothing for real time
  TweenMax.lagSmoothing(0);

  Screen.prototype.initialize.call(this);

  this.isRanked          = !!_$.state.user.isInLounge && options.rules.trade !== "none";
  _$.state.user.isInGame = true;
  _$.state.game          = new Model_Game({
    difficulty : _$.state.user.get("difficulty"),
    type       : _$.state.opponent ? "versus" : "solo",
    role       : _$.state.room ? ((_$.state.room.mode === "create") ? "emitter" : "receiver") : null,
    isRanked   : this.isRanked
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
  this.board                    = clone(_$.state.game.get("board"));
  this.postGameAction           = null;
  this.gameResult               = null;
  this.isDraggingCard           = false;

  if (_$.state.game.get("rules").elemental) {
    if (_$.state.game.get("elementBoard") !== null) { this.setupElementBoard(this); }
    else { _$.events.once("boardSet", this.setupElementBoard, this); }
  }

  this.$(".game_deck-holder").append(svgCardBG);

  concat(this.players.user.get("deck"), this.players.opponent.get("deck")).forEach((cardModel, index, deck) => {
    renderCard.call(this, cardModel, index % (deck.length / 2));
  });

  _$.events.on("resize", this.onResize, this);
  _$.events.on("toNextPhase", this.toNextPhase, this);
  _$.events.on("toNextTurn", this.toNextTurn, this);
  _$.events.on("toEndGame", this.toEndGame, this);
  _$.events.on("showElementalBonus", this.showElementalBonus, this);
  _$.events.on("endGameCardSelected", this.endGameCardSelected, this);
  _$.events.on("placeOpponentCard", this.placeOpponentCard, this);

  _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
  _$.audio.audioEngine.setBGM(_$.state.user.isInLounge ? "bgm.loungeGame" : "bgm.game");
  _$.audio.audioEngine.playBGM();
  this.add();

  _$.app.track("set", {
    "dimension0" : "difficulty",
    "dimension1" : "type",
    "dimension2" : "role",
    "dimension3" : "rules",
    "dimension4" : "gameStats"
  });
  _$.app.track("send", "event", {
    eventCategory : "gameEvent",
    eventAction   : "startGame",
    dimension0    : _$.state.game.get("difficulty"),                // difficulty
    dimension1    : _$.state.game.get("type"),                      // type
    dimension2    : _$.state.game.get("role"),                      // role
    dimension3    : JSON.stringify(_$.state.game.get("rules")),     // rules
    dimension4    : JSON.stringify(_$.state.user.get("gameStats"))  // gameStats
  });
}

function remove () {
  _$.events.off("resize", this.onResize, this);
  _$.events.off("toNextPhase", this.toNextPhase, this);
  _$.events.off("toNextTurn", this.toNextTurn, this);
  _$.events.off("toEndGame", this.toEndGame, this);
  _$.events.off("showElementalBonus", this.showElementalBonus, this);
  _$.events.off("endGameCardSelected", this.endGameCardSelected, this);
  _$.events.off("placeOpponentCard", this.placeOpponentCard, this);

  if (_$.state.room) {
    _$.events.off("firstPlayerSet");
    _$.events.off("boardSet", this.setupElementBoard, this);
    _$.events.off("getSelectedCards", this.getOpponentSelectedCards, this);
  }

  _$.state.game.destroy();
  _$.state.user.isInGame = false;
  delete _$.state.rules;
  delete _$.state.game;

  Screen.prototype.remove.call(this);
}

function setupElementBoard () {
  each(_$.state.game.get("elementBoard"), (element, caseName) => {
    if (element) {
      this.$("#" + caseName).addClass("elementCase element-" + element);
    }
  });
}

function transitionIn () {
  _$.events.trigger("stopUserEvents");

  const tl            = new TimelineMax();
  const userCards     = map(this.userCardViews, "$el");
  const opponentCards = map(this.opponentCardViews, "$el");

  concat(this.userCardViews, this.opponentCardViews).forEach((cardView) => {
    tl.add(placeCardOnHolder.call(this, cardView));
  });

  tl.from(this.ui.board, 0.4, { opacity: 0, scale: "1.2", clearProps: "all" });
  tl.from([this.ui.HUDuser, this.ui.HUDopponent], 0.4, { width: 0, opacity: 0, clearProps: "all" });
  tl.staggerFrom([this.$(".game_playerHUD-avatar"), this.$(".game_playerHUD-bar-type"), this.$(".game_playerHUD-bar-state")], 0.4, { opacity: 0, clearProps: "all" }, 0.2);
  tl.from(this.$(".game_playerHUD-score"), 0.4, { opacity: 0, y: -20, clearProps: "all" }, "-=.2");
  tl.from(this.$(".game_deck"), 0.4, { opacity: 0, y: -20, clearProps: "all" }, "-=.2");
  tl.addLabel("enterCards");
  tl.staggerFrom(userCards, 0.2, { opacity: 0, y: "+=20", clearProps: "opacity", onStart: playSFX }, 0.1, "enterCards");
  tl.staggerFrom(opponentCards, 0.2, { opacity: 0, y: "+=20", clearProps: "opacity", onStart: playSFX }, 0.1, "enterCards");
  tl.call(() => {
    if (_$.state.game.get("playing") !== null) { proceed.call(this); }
    else { _$.events.once("firstPlayerSet", proceed, this); }
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

function renderCard (cardModel, index) {
  const cardView = new Comp_Card({ model: cardModel, deckIndex: index });
  const owner    = (cardModel.get("currentOwner") === this.players.user) ? "user" : "opponent";

  if (owner === "user") {
    cardView.$el.on("mousedown touchstart", (e) => {
      dragCardStart.call(this, e, cardView);
    });
  } else if (!_$.state.game.get("rules").open) {
    TweenMax.set(cardView.$el, { rotationY: 180 });
  }

  this.ui.cardsContainer.append(cardView.$el);
  if (owner === "user") {this.userCardViews.push(cardView); }
  else { this.opponentCardViews.push(cardView); }
}

function placeCardOnHolder (cardView) {
  const owner       = (cardView.model.get("currentOwner") === this.players.user) ? "user" : "opponent";
  const destination = $(".game_playerHUD-" + owner).find(".game_deck-holder").eq(cardView.deckIndex);
  const coords      = _$.utils.getDestinationCoord(cardView.$el, destination);

  return TweenMax.set(cardView.$el, { x: coords.left, y: coords.top });
}

function dragCardStart (e, cardView) {
  if (this.isDraggingCard || _$.state.game.get("playing") === this.players.opponent || cardView.boardCase || this.eventsDisabled) {
    return;
  } else if (!this.isDraggingCard) {
    this.isDraggingCard = true;
  }

  const that  = this;
  let prevX = ("ontouchstart" in window) ? e.originalEvent.touches[0].pageX : e.pageX;
  let prevY = ("ontouchstart" in window) ? e.originalEvent.touches[0].pageY : e.pageY;
  const originalPosition = {
    left: cardView.$el[0]._gsTransform.x,
    top : cardView.$el[0]._gsTransform.y
  };

  TweenMax.set(cardView.$el, { zIndex: 1000 });

  $(window).on("mousemove touchmove", dragCard);

  if (_$.state.user.get("placingMode") === "dragDrop") {
    $(window).one("mouseup touchend", dragCardStop);
  } else {
    $(window).one("mouseup touchend", () => {
      $(window).one("mouseup touchend", dragCardStop);
    });
  }

  _$.audio.audioEngine.playSFX("cardGrab");

  function dragCard (e) {
    const pageX  = ("ontouchstart" in window) ? e.originalEvent.touches[0].pageX : e.pageX;
    const pageY  = ("ontouchstart" in window) ? e.originalEvent.touches[0].pageY : e.pageY;
    const deltaX = pageX - prevX;
    const deltaY = pageY - prevY;

    TweenMax.set(cardView.$el, {
      x: cardView.$el[0]._gsTransform.x + deltaX * _$.utils.getDragSpeed(),
      y: cardView.$el[0]._gsTransform.y + deltaY * _$.utils.getDragSpeed()
    });

    prevX = pageX;
    prevY = pageY;
  }

  function dragCardStop (e) {
    $(window).off("mousemove touchmove", dragCard);
    that.isDraggingCard = false;

    const pageX       = ("ontouchstart" in window) ? e.originalEvent.changedTouches[0].pageX : e.pageX;
    const pageY       = ("ontouchstart" in window) ? e.originalEvent.changedTouches[0].pageY : e.pageY;
    const scaledPageX = pageX * window.devicePixelRatio / _$.state.appScalar;
    const scaledPageY = pageY * window.devicePixelRatio / _$.state.appScalar;

    const boardOffset   = _$.utils.getAbsoluteOffset($("#board"));
    const boardPosition = {
      x1: boardOffset.left,
      x2: boardOffset.left + $("#board").outerWidth(),
      y1: boardOffset.top,
      y2: boardOffset.top + $("#board").outerHeight()
    };

    const nearestCase = $.nearest({ x: scaledPageX, y: scaledPageY }, $("#board .case"))[0];

    if (!that.board[nearestCase.id] &&
      scaledPageX >= boardPosition.x1 &&
      scaledPageX <= boardPosition.x2 &&
      scaledPageY >= boardPosition.y1 &&
      scaledPageY <= boardPosition.y2
    ) {
      that.moveToBoard(nearestCase, cardView);
    } else {
      that.moveToOrigin(cardView, originalPosition);
    }
  }
}

function moveToBoard (boardCase, cardView) {
  const caseOffset = _$.utils.getDestinationCoord(cardView.$el, boardCase);
  const owner      = (cardView.model.get("currentOwner") === this.players.user) ? "user" : "opponent";

  cardView.boardCase = boardCase;
  cardView.$el.addClass("is--played");
  this.board[boardCase.id] = cardView;

  const tl = new TimelineMax();
  if (owner === "opponent") {
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
    this.$(boardCase).addClass(owner === "user" ? "blue" : "red");
  });
  tl.set(cardView.$el, { scale: "1", zIndex: 999 }, "+=.1");
  tl.call(() => {
    _$.events.trigger("stopUserEvents");
    _$.state.game.placeCard(cardView.model, _$.utils.getPositionFromCaseName(boardCase.id));
  });
}

function moveToOrigin (cardView, originalPosition) {
  const tl = new TimelineMax();
  tl.to(cardView.$el, 0.2, { x: originalPosition.left, y: originalPosition.top });
  tl.set(cardView.$el, { scale: "1" }, "+=.1");
}

function placeOpponentCard (event, cardModel, caseName) {
  const cardView  = this.findCardViewsFromModels(this.opponentCardViews, cardModel)[0];
  const boardCase = this.$("#" + caseName)[0];

  setTimeout(() => {
    _$.audio.audioEngine.playSFX("cardGrab");
    this.moveToBoard(boardCase, cardView);
  }, 500);
}

function onResize () {
  let caseOffset;
  concat(this.userCardViews, this.opponentCardViews).forEach((cardView) => {
    if (cardView.boardCase) {
      caseOffset = _$.utils.getDestinationCoord(cardView.$el, cardView.boardCase);
      TweenMax.to(cardView.$el, 0.2, { x: caseOffset.left, y: caseOffset.top });
    } else {
      placeCardOnHolder.call(this, cardView);
    }
  });
}

function toNextPhase (event, info) {
  const endingPhasePlayer = _$.state.game.get("playing") === this.players.user ? "opponent" : "user";
  let tl, cardView, flipRule, flipRuleIndex;

  if (info.flippedCards.length) {
    tl = new TimelineMax({ onComplete: proceed.bind(this) });

    each(info.flippedCards, (flippedCard) => {
      cardView = this.board[flippedCard.caseName];

      if (flippedCard.flipRule !== flipRule) {
        flipRule      = flippedCard.flipRule;
        flipRuleIndex = 0;

        tl.addLabel(flipRule, tl.recent() ? tl.recent().endTime() : 0);
        if (flipRule !== "basic") {
          let specialFlipRule = flipRule;
          tl.call(() => {
            _$.audio.audioEngine.playSFX("specialRule");
            this.$(".game_overlay-specialRule span").text(startCase(specialFlipRule) + "!");
            this.$(".game_overlay-specialRule").addClass("is--active is--" + endingPhasePlayer);
          }, [], null, flipRule);
          tl.call(() => {
            this.$(".game_overlay-specialRule").removeClass("is--active is--" + endingPhasePlayer);
          }, [], null, tl.recent().endTime() + 0.5);
        }
      }

      tl.call(() => {
        this.$("#" + flippedCard.caseName).toggleClass("blue red");
        this.ui.HUDuser.find(".game_playerHUD-score").text(flippedCard.newUserPoints);
        this.ui.HUDopponent.find(".game_playerHUD-score").text(flippedCard.newOpponentPoints);
      }, [], null, (tl.recent() ? tl.recent().endTime() : 0) + 0.15 * flipRuleIndex);
      tl.add(cardView.flip({ fromSide: flippedCard.fromSide }), tl.recent().endTime() + 0.15 * flipRuleIndex++);
    });
  } else {
    proceed.call(this);
  }

  function proceed () {
    if (info.endGame) { this.toEndGame(); }
    else { this.toNextTurn(); }
  }
}

function toNextTurn () {
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
  setTimeout(() => {
    this.ui.HUDopponent.removeClass("is--active");
    this.ui.HUDuser.removeClass("is--active");
    this.showEndGameOverlay();
  }, 500);
}

function showTurnOverlay () {
  if (_$.state.game.get("playing") === this.players.user) {
    this.$(".game_overlay-playerTurn h1").find("span").text("Your");
    this.$(".game_overlay-playerTurn").addClass("is--user");
  } else {
    this.$(".game_overlay-playerTurn h1").find("span").text("Opponent's");
    this.$(".game_overlay-playerTurn").addClass("is--opponent");
  }

  this.$(".game_overlay-playerTurn").addClass("is--active");
  setTimeout(() => {
    this.$(".game_overlay-playerTurn").removeClass("is--active is--user is--opponent");
    _$.events.trigger("startUserEvents");

    setTimeout(() => {
      if (_$.state.game.get("playing") === this.players.opponent) {
        _$.state.game.promptOpponentAction();
      }
    }, 1000);
  }, 1000);
}

function showEndGameOverlay () {
  const shouldAutoProceed = () => { return this.gameResult === "lost" && _$.state.game.get("rules").trade !== "none"; };

  const tl = new TimelineMax({
    onComplete: () => {
      _$.events.trigger("startUserEvents");

      if (shouldAutoProceed()) {
        setTimeout(() => {
          this.postGameAction();
        }, 1000);
      }
    }
  });

  if (_$.state.game.get("winner") === this.players.user) {
    this.gameResult = "won";
    this.$(".game_overlay-endGame h1").append(" win!");
    this.$(".game_overlay-endGame").addClass("is--user");
  } else if (_$.state.game.get("winner") === this.players.opponent) {
    this.gameResult = "lost";
    this.$(".game_overlay-endGame h1").append(" lose...");
  } else if (_$.state.game.get("winner") === "draw") {
    this.gameResult = "draw";
    this.$(".game_overlay-endGame h1").find("span").text("Draw");
    this.$(".game_overlay-endGame").addClass("is--opponent");
  }

  if (this.gameResult === "won") {
    _$.audio.audioEngine.stopBGM({
      fadeDuration : 0.5,
      callback     : () => {
        _$.audio.audioEngine.playSFX("win");
        _$.audio.audioEngine.setBGM("bgm.win");
        _$.audio.audioEngine.playBGM();

        _$.events.once(_$.audio.audioEngine.getBGM("bgm.win").events.ended, () => {
          _$.audio.audioEngine.setBGM("bgm.postWin");
          _$.audio.audioEngine.playBGM();
        });
      }
    });
  } else if (this.gameResult === "lost") {
    _$.audio.audioEngine.stopBGM({
      fadeDuration : 0.5,
      callback     : () => {
        _$.audio.audioEngine.playSFX("lose");
        _$.audio.audioEngine.setBGM("bgm.lose");
        _$.audio.audioEngine.playBGM();
      }
    });
  }

  if (this.gameResult === "draw" && _$.state.game.get("rules").suddenDeath) {
    this.$(".game_overlay-endGame-confirmBtn").text("Start next round");
    noCardSelection.call(this);
    this.postGameAction = () => {
      if (_$.state.room) {
        this.$(".game_overlay-endGame-confirmBtn").text("Waiting for the other player to confirm...");
        _$.comm.socketManager.emit("confirmEnd", this.players.user.get("points"), this.toNextRound.bind(this));
      } else {
        this.toNextRound();
      }
    };
  } else if ((this.gameResult === "draw" && _$.state.game.get("rules").trade !== "direct") || _$.state.game.get("rules").trade === "none") {
    this.$(".game_overlay-endGame-confirmBtn").text("Return to " + (_$.state.user.isInLounge ? "the lounge room" : "title screen"));
    noCardSelection.call(this);
    this.postGameAction = () => {
      if (_$.state.room) {
        this.$(".game_overlay-endGame-confirmBtn").text("Waiting for the other player to confirm...");
        _$.comm.socketManager.emit("confirmEnd", this.players.user.get("points"), this.transitionOut.bind(this));
      } else {
        this.transitionOut();
      }
    };
  } else if (_$.state.game.get("rules").trade !== "none") {
    this.$(".game_overlay-endGame-confirmBtn").text("Confirm & Return to " + (_$.state.user.isInLounge ? "the lounge room" : "title screen"));
    cardSelection.call(this);
    this.postGameAction = () => {
      if (_$.state.room) {
        this.$(".game_overlay-endGame-confirmBtn").text("Waiting for the other player to confirm...");
        _$.comm.socketManager.emit("confirmEnd", this.players.user.get("points"), this.confirmCardSelection.bind(this));
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

    let i, ii;
    let endGameCardView;
    for (i = 0, ii = _$.state.game.get("originalDecks").user.length; i < ii; i++) {
      endGameCardView = new Comp_EndGameCard({ card: _$.state.game.get("originalDecks").user[i], deckIndex: i });
      this.$(".game_overlay-endGame-album-user").append(endGameCardView.$el);
      this.userEndGameCardViews.push(endGameCardView);

      _$.utils.fadeIn(endGameCardView.$el, null, 0.5, 1 + 0.15 * i);
    }

    for (i = 0, ii = _$.state.game.get("originalDecks").opponent.length; i < ii; i++) {
      endGameCardView = new Comp_EndGameCard({ card: _$.state.game.get("originalDecks").opponent[i], deckIndex: i });
      this.$(".game_overlay-endGame-album-opponent").append(endGameCardView.$el);
      this.opponentEndGameCardViews.push(endGameCardView);

      _$.utils.fadeIn(endGameCardView.$el, null, 0.5, 1 + 0.15 * i);
    }

    if (_$.state.game.get("rules").trade === "one" || _$.state.game.get("rules").trade === "difference") {
      if (this.gameResult === "won") {
        tl.set(this.$(".game_overlay-endGame h1"), { transition: "none" }, "+=2");
        tl.to(this.$(".game_overlay-endGame h1"), 0.4, { opacity: 0 });
        tl.call(() => {
          const span = this.$(".game_overlay-endGame h1").find("span").text("Choose");
          const text = (_$.state.game.get("cardsToPickCount") > 1) ? " " + _$.state.game.get("cardsToPickCount") + " cards" : " 1 card";
          this.$(".game_overlay-endGame h1").html(span).append(text);
        });
        tl.to(this.$(".game_overlay-endGame h1"), 0.4, { opacity: 1, clearProps: "all" });

        if (_$.state.game.get("cardsToPickCount") === _$.state.DECK_SIZE) {
          this.gainedCards = this.opponentEndGameCardViews;
          autoFlipCards(this.gainedCards, true);
        }
      } else if (this.gameResult === "lost") {
        if (_$.state.game.get("type") === "solo") {
          this.lostCards = this.findCardViewsFromModels(this.userEndGameCardViews, _$.state.game.get("computer").selectedCards, "cardView");
          autoFlipCards(this.lostCards);
        } else if (_$.state.room) {
          _$.events.on("getSelectedCards", this.getOpponentSelectedCards, this);
          _$.comm.socketManager.emit("getSelectedCards");
        }
      }
    } else if (_$.state.game.get("rules").trade === "all") {
      if (this.gameResult === "won") {
        this.gainedCards = this.opponentEndGameCardViews;
        autoFlipCards(this.gainedCards, true);
      } else if (this.gameResult === "lost") {
        this.lostCards = this.userEndGameCardViews;
        autoFlipCards(this.lostCards);
      }
    } else if (_$.state.game.get("rules").trade === "direct") {
      this.gainedCards = filter(this.opponentEndGameCardViews, (endGameCardView) => {
        return endGameCardView.cardView.model.get("currentOwner") === this.players.user;
      });

      this.lostCards = filter(this.userEndGameCardViews, (endGameCardView) => {
        return endGameCardView.cardView.model.get("currentOwner") === this.players.opponent;
      });

      autoFlipCards(this.gainedCards, true);
      autoFlipCards(this.lostCards);
    }

    function autoFlipCards (cardsArray, gainCard) {
      const subTL = new TimelineMax();
      each(cardsArray, (endGameCardView, index) => {
        subTL.call(() => {
          if (gainCard) {
            endGameCardView.selectCard();
          } else {
            endGameCardView.cardView.flip();
          }
        }, [], null, 0.15 * index);
      });

      tl.add(subTL, "+=1");

      if (!this.$(".game_overlay-endGame-confirmBtn").is(":visible") && !shouldAutoProceed()) {
        tl.call(() => {
          this.$(".game_overlay-endGame-confirmBtn").slideDown(400);
        }, [], null, "+=.4");
      }
    }
  }
}

function findCardViewsFromModels (cardViewList, modelList, customPath) {
  if (!isArray(cardViewList)) {
    cardViewList = [cardViewList];
  }

  if (!isArray(modelList)) {
    modelList = [modelList];
  }

  return filter(cardViewList, (cardView) => {
    return some(modelList, (model) => {
      return get(cardView, customPath + ".model", cardView.model) === model;
    });
  });
}

function showElementalBonus (event, info) {
  this.$("#" + info.caseName).addClass("has--" + info.bonusType);
}

function transitionOut () {
  _$.app.track("set", {
    "dimension0" : "difficulty",
    "dimension1" : "type",
    "dimension2" : "role",
    "dimension3" : "rules",
    "dimension4" : "gameStats",
    "metric0"    : "round",
    "metric1"    : "scoreUser",
    "metric2"    : "scoreOpponent"
  });

  _$.app.track("send", "event", {
    eventCategory : "gameEvent",
    eventAction   : "endGame",
    result        : this.gameResult,
    dimension0    : _$.state.game.get("difficulty"),                    // difficulty
    dimension1    : _$.state.game.get("type"),                          // type
    dimension2    : _$.state.game.get("role"),                          // role
    dimension3    : JSON.stringify(_$.state.game.get("rules")),         // rules
    dimension4    : JSON.stringify(_$.state.user.get("gameStats")),     // gameStats
    metric0       : _$.state.game.get("roundNumber"),                   // round
    metric1       : _$.state.game.get("players").user.get("points"),    // scoreUser
    metric2       : _$.state.game.get("players").opponent.get("points") // scoreOpponent
  });

  const nextScreen = _$.state.user.isInLounge ? "lounge" : "title";

  _$.events.trigger("stopUserEvents");
  _$.audio.audioEngine.stopBGM({ fadeDuration: 1 });
  _$.events.off(_$.audio.audioEngine.getBGM("bgm.win").events.ended);
  this.checkBGMCrossfade(nextScreen);

  if (_$.state.room) {
    _$.comm.socketManager.emit("playerReset");

    if (this.isRanked) {
      _$.state.user.set("lastRankedGame", Date.now());
    }
  }

  const tl = new TimelineMax();
  tl.call(() => { this.$(".game_overlay-endGame").removeClass("is--active"); });
  tl.to(this.$(".game_wrapper"), 0.4, { opacity: 0 });
  tl.add(this.checkFooterUpdate(nextScreen), 0);
  tl.call(onTransitionComplete.bind(this));

  function onTransitionComplete () {
    _$.utils.addDomObserver(this.$el, () => {
      if (this.gameResult) {
        _$.events.once("userDataSaved", () => {
          proceed.call(this);
          if (!_$.comm.sessionManager.getSession()) {
            _$.ui.screen.showAutoSavePrompt();
          }
        });

        _$.app.saveData();
      } else {
        proceed.call(this);
      }
    }, true, "remove");
    this.remove();
  }

  function proceed () {
    _$.events.trigger("startUserEvents");
    if (nextScreen === "lounge") {
      _$.ui.screen = new Screen_Lounge();
    } else {
      // Re-enable lag smoothing
      TweenMax.lagSmoothing(1000, 16);
      _$.ui.screen = new Screen_Title();
    }
  }
}

function toNextRound () {
  _$.events.trigger("stopUserEvents");

  const tl = new TimelineMax();
  tl.call(() => { this.$(".game_overlay-endGame").removeClass("is--active"); });
  tl.to(this.$el, 0.8, { opacity: 0, clearProps: "all" }, "+=0.8");
  tl.call(() => {
    this.$el.empty();
    onTransitionComplete.call(this);
  });

  function onTransitionComplete () {
    const rules       = _$.state.game.get("rules");
    const computer    = _$.state.game.get("computer");
    const newPlayers  = { user: this.players.user, opponent: this.players.opponent };
    const roundNumber = _$.state.game.get("roundNumber") + 1;

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
  const span       = this.$(".game_overlay-endGame h1").find("span");
  const gainedLost = { gained: [], lost: [] };

  const tl = new TimelineMax();
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
      gainedLost.gained = map(this.gainedCards, (endGameCardView) => { return endGameCardView.cardView.model; });
      showGains.call(this, this.gainedCards, "Gained");
    }

    if (this.lostCards.length) {
      gainedLost.lost = map(this.lostCards, (endGameCardView) => { return endGameCardView.cardView.model; });
      showGains.call(this, this.lostCards, "Lost");
    }

    _$.state.game.updateUserAlbum(gainedLost);
    tl.call(this.transitionOut.bind(this));
  }

  function showGains (cardsArray, text) {
    tl.to(this.$(".game_overlay-endGame h1"), 0.4, { opacity: 0 });
    tl.call(() => {
      this.$(".game_overlay-endGame h1").html(span.text(text)).append(" cards");
    });
    tl.to(this.$(".game_overlay-endGame h1"), 0.4, { opacity: 1, marginBottom: "1em" });

    const subTL = new TimelineMax();
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
    if (!includes(this.gainedCards, info.endGameCardView)) {
      this.gainedCards.push(info.endGameCardView);

      if ((_$.state.game.get("rules").trade === "one" || _$.state.game.get("rules").trade === "difference") &&
      (this.gainedCards.length > _$.state.game.get("cardsToPickCount"))) {
        this.gainedCards[0].selectCard(null, true);
        this.gainedCards.splice(0, 1);
      }
    }
  } else {
    _remove(this.gainedCards, (item) => item === info.endGameCardView);
  }

  if (_$.state.room) {
    _$.comm.socketManager.emit("setSelectedCards", map(this.gainedCards, "deckIndex"));
  }

  if ((_$.state.game.get("rules").trade === "one" || _$.state.game.get("rules").trade === "difference")) {
    if (this.gainedCards.length === _$.state.game.get("cardsToPickCount")) {
      if (!this.$(".game_overlay-endGame-confirmBtn").is(":visible")) {
        this.$(".game_overlay-endGame-confirmBtn").slideDown(400);
      }
    } else if (this.$(".game_overlay-endGame-confirmBtn").is(":visible")) {
      this.$(".game_overlay-endGame-confirmBtn").slideUp(400);
    }
  }
}

function getOpponentSelectedCards (event, response) {
  const opponentSelection = response.msg;
  const previousSelection = map(this.lostCards, "deckIndex");
  const deselection       = difference(previousSelection, opponentSelection);
  let deselectedCards   = [];

  this.lostCards = filter(this.userEndGameCardViews, (endGameCardView) => {
    return some(opponentSelection, (deckIndex) => {
      return endGameCardView.deckIndex === deckIndex;
    });
  });

  deselectedCards = filter(this.userEndGameCardViews, (endGameCardView) => {
    return some(deselection, (deckIndex) => {
      return endGameCardView.deckIndex === deckIndex;
    });
  });

  const tl = new TimelineMax();
  concat(deselectedCards, this.lostCards).forEach((endGameCardView, index) => {
    tl.call(() => {
      endGameCardView.cardView.flip();
    }, [], null, 0.15 * index);
  });
}
