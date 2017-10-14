import { template, each, min, sampleSize } from 'lodash';
import { TweenMax, TimelineMax } from 'gsap';

import _$ from 'common';
import Screen from 'Screens/Screen';
import Templ_RulesSelect from './template.ejs';

const RULES       = "open|random|elemental|sameWall|same|suddenDeath|plus|trade";
const TRADE_RULES = "none|one|difference|direct|all";

export default Screen.extend({
  id       : "screen_rulesSelect",
  template : template(Templ_RulesSelect),
  events   : {
    /* eslint-disable object-shorthand */
    "click .rulesSelect_content-rules-rule:not(.rule-trade):not(.is--disabled)" : function (e) {
      if (this.readOnly) {
        e.preventDefault();
        return false;
      }

      const ruleName = e.currentTarget.className.match(RULES)[0];
      this.toggleRule(ruleName, "toggle");
      this.updateRules();
    },
    "click .rulesSelect_content-screenNav-choice-backBtn" : function () {
      if (_$.state.room) {
        if (_$.state.user.isInLounge) {
          this.transitionOut("lounge");
        } else {
          this.transitionOut("roomSelect");
        }
      } else {
        this.transitionOut("title");
      }
    },
    "click .rulesSelect_content-screenNav-choice-nextBtn" : "toNextStep",
    "click .rulesSelect_content-confirm-choice-yesBtn"    : "toNextStep",
    "click .rulesSelect_content-confirm-choice-noBtn"     : function () {
      this.toggleConfirm("hide");
      this.toggleRule("random", false);
      this.updateRules();
    },
    "mouseenter .rulesSelect_content-rules-rule:not(.rule-trade)" : function (e) {
      this.showHelp(e.currentTarget.className.match(RULES)[0]);
    },
    "mouseenter .rule-trade li" : function (e) {
      this.showHelp(e.currentTarget.className.match(TRADE_RULES)[0]);
    },
    "mouseleave .rulesSelect_content-rules-rule:not(.rule-trade),.rule-trade li" : function () {
      this.showHelp();
    },
    "mouseenter .rulesSelect_content-screenNav-choice-element,.rulesSelect_content-confirm-choice-element" : function () {
      _$.audio.audioEngine.playSFX("uiHover");
    },
    "click .rulesSelect_content-screenNav-choice-element,.rulesSelect_content-confirm-choice-element" : function () {
      _$.audio.audioEngine.playSFX("uiConfirm");
    },
    "click .rulesSelect_content-rules-rule:not(.is--disabled)" : function (e) {
      if (this.readOnly) {
        e.preventDefault();
        return false;
      }

      _$.audio.audioEngine.playSFX("uiConfirm");
    }
    /* eslint-enable */
  },

  initialize,
  remove,

  toggleRule,
  toggleConfirm,
  updateRules,
  updateFromOpponentRules,
  setAvailableRules,

  toNextStep,
  transitionIn,
  transitionOut,
  showHelp
});

function initialize (options = {}) {
  Screen.prototype.initialize.call(this);

  _$.ui.rulesSelect  = this;
  this.readOnly      = options.readOnly;
  this.rules         = {};
  this.randomDeck    = [];
  this.tradeDropdown = null;
  this.initialized   = false;

  this.$el.html(this.template({
    isReadOnly: !!this.readOnly
  }));

  // Setting default rules for toggle options
  this.toggleRule("open", true);
  this.toggleRule("random", false);
  this.toggleRule("elemental", false);
  this.toggleRule("suddenDeath", false);
  this.toggleRule("same", false);
  this.toggleRule("sameWall", false);
  this.toggleRule("plus", false);

  if (this.readOnly) {
    this.$(".rulesSelect_content-rules-rule").addClass("is--readOnly");
  }

  this.showHelp();
  _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
  this.add();
}

function remove () {
  if (this.readOnly) {
    _$.events.off("getRules", this.updateFromOpponentRules, this);
  }

  delete _$.ui.rulesSelect;
  Screen.prototype.remove.call(this);
  this.tradeDropdown.remove();

  if (_$.ui.roomSelect) {
    _$.ui.roomSelect.remove();
  }

  if (_$.ui.cardSelect) {
    _$.ui.cardSelect.remove();
  }
}

function updateFromOpponentRules (event, data) {
  const opponentRules = data.msg;

  if (opponentRules) {
    each(opponentRules, (ruleState, ruleName) => {
      if (ruleName === "trade") {
        this.tradeDropdown.scrollTo(".tradeRule-" + ruleState);
      } else {
        this.toggleRule(ruleName, ruleState);
      }
    });

    if (_$.ui.screen.id !== this.id) {
      _$.audio.audioEngine.playSFX("gameGain");
      _$.ui.screen.info({
        titleBold    : "Rules",
        titleRegular : "updated",
        msg          : _$.state.opponent.name + " has updated the rules",
        autoClose    : true
      });
    }
  }
}

function setAvailableRules (opponent) {
  const albumSize    = _$.state.user.get("album").length;
  const albumSizeMin = opponent ? min([albumSize, opponent.albumSize]) : albumSize;

  if (albumSizeMin < _$.state.DECK_SIZE) {
    _$.app.track("send", "event", {
      eventCategory : "notEnoughCards",
      dimension0    : _$.state.user.get("difficulty"),
      metric0       : JSON.stringify(_$.state.user.get("gameStats"))
    });

    this.disableSetting(".rule-random", ".rulesSelect_content-rules-rule-toggle");
    _$.audio.audioEngine.playSFX("uiError");

    if (opponent && opponent.albumSize < _$.state.DECK_SIZE) {
      _$.ui.screen.info({
        titleBold    : "Not enough ",
        titleRegular : "cards",
        msg          : "Your opponent doesn't have enough cards to play",
        btnMsg       : "Return to title screen",
        action       : _$.ui.screen.closePrompt.bind(_$.ui.screen, transitionOut.bind(_$.ui.screen, "title"))
      });
    } else {
      _$.ui.screen.choice({
        titleBold    : "Not enough ",
        titleRegular : "cards",
        msg          : "You must own at least " + _$.state.DECK_SIZE + " cards to play",
        btn1Msg      : "Reset my album card",
        action1      : _$.ui.screen.closePrompt.bind(_$.ui.screen, _$.ui.screen.transitionOut.bind(_$.ui.screen, "userSettings")),
        btn2Msg      : "Return to title screen",
        action2      : _$.ui.screen.closePrompt.bind(_$.ui.screen, _$.ui.screen.transitionOut.bind(_$.ui.screen, "title"))
      });
    }
  }

  if (albumSizeMin < 6) {
    this.tradeDropdown.disableOption(".tradeRule-one");
  }

  if (albumSizeMin < 11) {
    this.tradeDropdown.disableOption(".tradeRule-difference");
    this.tradeDropdown.disableOption(".tradeRule-direct");
    this.tradeDropdown.disableOption(".tradeRule-all");
  }

  if (this.initialized) {
    this.tradeDropdown.validitateCurrentOption(false, true);
  }

  this.updateRules();
}

function toggleRule (ruleName, state) {
  this.toggleSetting(".rule-" + ruleName, ".rulesSelect_content-rules-rule-toggle", state);
  const newState = this.$(".rule-" + ruleName).hasClass("is--on");

  if (ruleName === "random") {
    if (newState && !this.$(".rulesSelect_content-confirm").is(":visible")) {
      this.toggleConfirm("show");
      _$.audio.audioEngine.playSFX("gameGain");

      if (_$.ui.screen.id === "screen_cardSelect") {
        _$.ui.screen.transitionOut("rulesSelect");
      }
    } else if (!newState && this.$(".rulesSelect_content-confirm").is(":visible")) {
      this.toggleConfirm("hide");
    }
  }

  // The "Same Wall" rule can only work if the "Same" rule is enabled
  if (ruleName === "same" && !newState && this.rules.sameWall) {
    this.toggleRule("sameWall", false);
  }
  if (ruleName === "sameWall" && newState && !this.rules.same) {
    this.toggleRule("same", true);
  }
}

function updateRules () {
  const rules = {};
  let ruleName;
  let tradeRule;

  this.$(".rulesSelect_content-rules-rule.is--on").each(function () {
    ruleName = this.className.match(RULES)[0];
    rules[ruleName] = true;
  });

  this.$(".rulesSelect_content-rules-rule.is--off").each(function () {
    ruleName = this.className.match(RULES)[0];
    rules[ruleName] = false;
  });

  this.$(".rulesSelect_content-rules-rule.is--disabled").each(function () {
    ruleName = this.className.match(RULES)[0];
    delete rules[ruleName];
  });

  tradeRule      = this.tradeDropdown.currentOption[0].className.replace("tradeRule-", "");
  rules.trade    = tradeRule;

  this.rules     = rules;
  _$.state.rules = this.rules;

  if (_$.state.room && _$.state.room.mode === "create") {
    _$.comm.socketManager.emit("setRules", rules);
  }
}

function toNextStep () {
  if (this.rules.random) {
    this.randomDeck = sampleSize(_$.state.user.get("album").models, _$.state.DECK_SIZE);
    this.toGame(this.randomDeck);
  } else {
    this.transitionOut("cardSelect");
  }
}

function transitionIn () {
  _$.events.trigger("stopUserEvents");

  if (!this.initialized) {
    this.tradeDropdown = this.createDropdown({
      selector         : ".rule-trade",
      dropdownSelector : ".rulesSelect_content-rules-rule-select",
      onUpdate         : this.updateRules.bind(this)
    });

    if (this.readOnly) {
      this.tradeDropdown.disable();
    }
  }

  const tl = new TimelineMax();
  tl.set(this.$el, { clearProps: "display" });
  tl.set(this.$(".rulesSelect_content-rules"), { clearProps: "opacity" });
  tl.set(this.$(".rulesSelect_content-rules-rule"), { opacity: 0 });
  tl.call(() => {
    this.$(".rulesSelect_header").slideDown(this.transitionSettings.slides * 1000);
  });
  tl.staggerTo(
    this.$(".rulesSelect_content-rules-rule"),
    this.transitionSettings.slides,
    { opacity: 1, clearProps:"all" },
    this.transitionSettings.staggers,
    `+=${this.transitionSettings.slides}`
  );
  tl.call(() => {
    if (!this.initialized) {
      this.initialized = true;

      if (this.readOnly) {
        _$.events.on("getRules", this.updateFromOpponentRules, this);
        _$.comm.socketManager.emit("getRules");
      }

      this.setAvailableRules(_$.state.opponent);
    }

    if (!this.$(".rule-random").hasClass("is--on")) {
      this.$(".rulesSelect_content-screenNav").slideDown(this.transitionSettings.slides * 1000);
    }

    _$.events.trigger("startUserEvents");
  }, null, [], `-=${this.transitionSettings.slides}`);

  return this;
}

function transitionOut (nextScreen, options) {
  _$.events.trigger("stopUserEvents");
  this.checkBGMCrossfade(nextScreen);

  const tl = new TimelineMax();
  tl.call(() => {
    this.$(".rulesSelect_content-screenNav, .rulesSelect_content-confirm").slideUp(this.transitionSettings.slides * 1000);
  });
  tl.to(this.$(".rulesSelect_content-rules"), this.transitionSettings.slides, { opacity: 0 }, tl.recent().endTime() + this.transitionSettings.slides);
  tl.call(() => {
    this.$(".rulesSelect_header").slideUp(this.transitionSettings.slides * 1000);
  });
  tl.add(this.checkFooterUpdate(nextScreen), 0);
  tl.call(() => {
    TweenMax.set(this.$el, { display: "none" });
    this.changeScreen(nextScreen, options);
  }, null, [], `+=${this.transitionSettings.slides}`);

  return this;
}

function toggleConfirm (state) {
  if (state === "show") {
    this.$(".rulesSelect_content-confirm").css({pointerEvents: ""}).slideDown();
    this.$(".rulesSelect_content-screenNav").css({pointerEvents: "none"}).slideUp();
  } else if (state === "hide") {
    this.$(".rulesSelect_content-confirm").css({pointerEvents: "none"}).slideUp();
    this.$(".rulesSelect_content-screenNav").css({pointerEvents: ""}).slideDown();
  }
}

function showHelp (msgName, asIs) {
  let defaultMsg = "Choose the duel's rules.";
  if (_$.state.room) {
    defaultMsg += " Only the player hosting the duel can set them.";
  }

  let text;

  if (!msgName) {
    text = defaultMsg;
  } else if (asIs) {
    text = msgName;
  } else {
    switch (msgName) {
      case "open":
        text = "All five cards in each deck are made visible to both players.";
        break;
      case "random":
        text = "Your deck will be chosen randomly from your card album.";
        break;
      case "elemental":
        text  = "One or more cases are randomly marked with an element.<br>";
        text += "When an elemental card is placed on a corresponding element, each rank goes up a point.<br>";
        text += "When any card is placed on a non-matching element, each rank goes down a point.<br>";
        text += "This does not affect the Same, Same Wall and Plus rules where the cards' original ranks apply.";
        break;
      case "same":
        text  = "If the ranks of the card you place are the same as the ranks on the adjacent sides of two or more adjacent cards,<br>";
        text += "you gain control of these cards. This allows the Combo rule: if a captured card is adjacent to another card<br>";
        text += "whose rank is lower, this card is captured as well.";
        break;
      case "sameWall":
        text = "An extension of the Same rule where the edges of the board are counted as A ranks.";
        break;
      case "suddenDeath":
        text  = "Any match that ends in a draw will be restarted.<br>";
        text += "Your deck for this new match will consist of the cards you had control over at the end of the previous round.<br>";
        text += "The duel will end in a draw after 5 rounds.";
        break;
      case "plus":
        text  = "If the ranks of the card you place have the same total when added to the ranks on the adjacent sides<br>";
        text += "of two or more adjacent cards, you gain control of them. This allows the Combo rule: if a captured card<br>";
        text += "is adjacent to another card whose rank is lower, this card is captured as well.";
        break;
      // Trade rules
      case "none":
        text = "A friendly match.";
        break;
      case "one":
        text  = "The winner chooses a card from the loser's deck.<br>";
        text += "You and your opponent must have at least 6 cards to choose this trade mode.";
        break;
      case "difference":
        text = "The winner chooses one card per score difference (2, 4, or 5).<br>";
        text += "You and your opponent must have at least 11 cards to choose this trade mode.";
        break;
      case "direct":
        text  = "The players take the cards they have captured at the end of the duel.<br>";
        text += "This also applies in case of a draw. You must have at least 11 cards to choose this trade mode.";
        break;
      case "all":
        text  = "The winner takes the loser's deck.<br>";
        text += "You and your opponent must have at least 11 cards to choose this trade mode.";
        break;
    }
  }

  this.$(".rulesSelect_header-help").html(text);
}
