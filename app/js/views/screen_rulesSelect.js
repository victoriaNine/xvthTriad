define([
    "jquery",
    "underscore", 
    "backbone",
    "models/model_card",
    "views/screen",
    "text!templates/templ_rulesSelect.html",
    "global",
    "tweenMax"
], function Screen_RulesSelect ($, _, Backbone, Model_Card, Screen, Templ_RulesSelect, _$) {
    var RULES       = "open|random|elemental|sameWall|same|suddenDeath|plus|trade";
    var TRADE_RULES = "none|one|difference|direct|all";

    return Screen.extend({
        id        : "screen_rulesSelect",

        // Our template for the line of statistics at the bottom of the app.
        template  : _.template(Templ_RulesSelect),

        // Delegated events for creating new items, and clearing completed ones.
        events    : {
            "click .rulesSelect_content-rules-rule:not(.rule-trade)" : function (e) {
                this.toggleRule(e.currentTarget.className.match(RULES)[0], "toggle");
            },
            "click .rule-trade"                                   : "toggleTrade",
            "click .rulesSelect_content-screenNav-choice-backBtn" : function () {
                if (_$.ui.roomSelect) {
                    this.transitionOut("roomSelect");
                } else {
                    this.transitionOut("title");
                }
            },
            "click .rulesSelect_content-screenNav-choice-nextBtn" : "toNextStep",
            "click .rulesSelect_content-confirm-choice-yesBtn"    : "toNextStep",
            "click .rulesSelect_content-confirm-choice-noBtn"     : function () { 
                this.toggleConfirm("hide");
                this.toggleRule("random", false);
            },
            "mouseenter .rulesSelect_content-rules-rule:not(.rule-trade)" : function (e) {
                this.showHelp(e.currentTarget.className.match(RULES)[0]);
            },
            "mouseenter .rule-trade li" : function (e) {
                this.showHelp(e.currentTarget.className.match(TRADE_RULES)[0]);
            },
            "mouseleave .rulesSelect_content-rules-rule:not(.rule-trade),.rule-trade li" : function (e) {
                this.showHelp();
            },
            "mouseenter .rulesSelect_content-screenNav-choice-element,.rulesSelect_content-confirm-choice-element" : function () {
                _$.audio.audioEngine.playSFX("uiHover");
            },
            "click .rulesSelect_content-screenNav-choice-element,.rulesSelect_content-confirm-choice-element,.rulesSelect_content-rules-rule" : function () {
                _$.audio.audioEngine.playSFX("uiConfirm");
            }
        },

        initialize,
        remove,

        toggleRule,
        toggleTrade,
        toggleConfirm,
        updateRules,
        setOpponentRules,

        toNextStep,
        transitionIn,
        transitionOut,
        showHelp
    });

    function initialize (options = {}) {
        _$.ui.rulesSelect = this;
        this.rules        = null;
        this.randomDeck   = null;
        this.readOnly     = options.readOnly;

        this.$el.html(this.template());
        this.toggleRule("open", true, true);
        this.toggleRule("random", false, true);
        this.toggleRule("elemental", false, true);
        this.toggleRule("suddenDeath", false, true);

        if (this.readOnly) {
            this.$(".rulesSelect_content-rules").css({ pointerEvents: "none" });
            this.$(".rulesSelect_content-confirm-choice-noBtn").hide();
        }

        if (!_$.state.room) {
            this.$(".rulesSelect_content-screenNav-choice-backBtn").hide();
        }

        if (_$.state.user.get("album").length < 6) {
            this.$(".tradeRule-one").addClass("is--disabled");
        }

        if (_$.state.user.get("album").length < 11) {
            this.$(".tradeRule-difference, .tradeRule-direct, .tradeRule-all").addClass("is--disabled");
        }

        this.showHelp();
        _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
        this.add();
    }

    function remove () {
        if (this.readOnly) {
            _$.events.off("getRules", this.setOpponentRules, this);
        }
        $(window).off("click.toggleTrade");

        delete _$.ui.rulesSelect;
        Screen.prototype.remove.call(this);
        
        if (_$.ui.roomSelect) {
            _$.ui.roomSelect.remove();
        }

        if (_$.ui.cardSelect) {
            _$.ui.cardSelect.remove();
        }
    }

    function setOpponentRules (eventName, response) {
        var opponentRules = response.msg;

        if (opponentRules) {
            _.each(opponentRules, (ruleState, ruleName) => {
                if (ruleName === "trade") {
                    this.toggleTrade({ target: this.$(".tradeRule-" + ruleState)[0] }, true);
                } else {
                    this.toggleRule(ruleName, ruleState);
                }
            });
        }
    }

    function toggleRule (rule, state, auto) {
        var ruleDOM = this.$(".rule-" + rule);
        
        if (state === "toggle") {
            state = ruleDOM.hasClass("is--on") ? false : true;
        }

        if (state) {
            ruleDOM.removeClass("is--off").addClass("is--on");
            ruleDOM.find(".rulesSelect_content-rules-rule-toggle").text("ON");
        } else {
            ruleDOM.removeClass("is--on").addClass("is--off");
            ruleDOM.find(".rulesSelect_content-rules-rule-toggle").text("OFF");
        }

        if (rule === "random") {
            if (state && !this.$(".rulesSelect_content-confirm").is(":visible")) {
                this.toggleConfirm("show");
                _$.audio.audioEngine.playSFX("gameGain");
            } else if (!state && this.$(".rulesSelect_content-confirm").is(":visible")) {
                this.toggleConfirm("hide");
            }
        }

        if (!auto) {
            this.updateRules();
        }
    }

    function toggleTrade (e, auto) {
        var closestValidOption = $(e.target).hasClass("is--disabled") ? $(e.target).parent().children(":not(.is--disabled)").eq(0) : $(e.target);
        var index              = _$.utils.getNodeIndex(closestValidOption);
        var selectHeight       = this.$(".rule-trade").height();
        var toggle             = this.$(".rule-trade .rulesSelect_content-rules-rule-toggle");
        var dropdown           = this.$(".rulesSelect_content-rules-rule-select");

        if (this.$(".rule-trade").hasClass("is--active") || auto) {
            if (!auto) {
                this.$(".rule-trade").removeClass("is--active");
                $(window).off("click.toggleTrade");
            }

            TweenMax.to(dropdown[0], 0.4, { scrollTop: index * selectHeight, delay: 0.6, onComplete: this.updateRules.bind(this) });
            return;
        } else {
            this.$(".rule-trade").addClass("is--active");
        }

        $(window).on("click.toggleTrade", (clickEvent) => {
            if (!$(clickEvent.target).parents(".rule-trade").length) {
                $(window).off("click.toggleTrade");
                var defaultOption      = this.$(".tradeRule-none");
                var defaultOptionIndex = _$.utils.getNodeIndex(defaultOption);
                this.$(".rule-trade").removeClass("is--active");
                TweenMax.to(dropdown[0], 0.4, { scrollTop: defaultOptionIndex * selectHeight, delay: 0.6, onComplete: this.updateRules.bind(this) });
            }
        });
    }

    function updateRules () {
        var selectHeight = $(".rule-trade").height();
        var rules        = {};
        var ruleName;
        var tradeRule;
        var tradeRuleIndex;

        this.$(".rulesSelect_content-rules-rule.is--on").each(function () {
            ruleName = this.className.match(RULES)[0];
            rules[ruleName] = true;
        });

        this.$(".rulesSelect_content-rules-rule.is--off").each(function () {
            ruleName = this.className.match(RULES)[0];
            rules[ruleName] = false;
        });

        tradeRuleIndex = Math.ceil(this.$(".rulesSelect_content-rules-rule-select").scrollTop() / selectHeight);
        tradeRule      = this.$(".rulesSelect_content-rules-rule-select").children().eq(tradeRuleIndex)[0].className.replace("tradeRule-", "");
        rules.trade    = tradeRule;

        this.rules     = rules;
        _$.state.rules = this.rules;

        if (_$.state.room && _$.state.room.mode === "create") {
            _$.comm.socketManager.emit("setRules", rules);
        }
    }

    function toNextStep () {
        if (this.rules.random) {
            this.randomDeck = _.sampleSize(_$.state.user.get("album").models, 5);
            this.toGame(this.randomDeck);
        } else {
            this.transitionOut("cardSelect");
        }
    }

    function transitionIn () {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        tl.set(this.$el, { clearProps: "display" });
        tl.set(this.$(".rulesSelect_content-rules"), { clearProps: "opacity" });
        tl.set(this.$(".rulesSelect_content-rules-rule"), { opacity: 0 });
        tl.call(() => {
            this.$(".rulesSelect_header").slideDown(500);
        });
        tl.staggerTo(this.$(".rulesSelect_content-rules-rule"), 0.5, { opacity: 1, clearProps:"all" }, 0.1, tl.recent().endTime() + 0.5);
        tl.call(() => {
            this.$(".rulesSelect_content-screenNav").slideDown(500);
            _$.events.trigger("startUserEvents");

            if (this.readOnly) {
                _$.events.on("getRules", this.setOpponentRules, this);
                _$.comm.socketManager.emit("getRules");
            }
        });

        return this;
    }

    function transitionOut (nextScreen, options) {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        if (_$.ui.footer.isOpen) {
            tl.add(_$.ui.footer.toggleFooter(), 0);
        }
        tl.call(() => {
            this.$(".rulesSelect_content-screenNav, .rulesSelect_content-confirm").slideUp(500);
        }, null, [], "-=1.5");
        tl.to(this.$(".rulesSelect_content-rules"), 0.5, { opacity: 0 }, tl.recent().endTime() + 0.5);
        tl.call(() => {
            this.$(".rulesSelect_header").slideUp(500);
        });
        tl.call(() => {
            TweenMax.set(this.$el, { display: "none" });
            this.changeScreen(nextScreen, options);
        }, null, [], tl.recent().endTime() + 0.5);

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
        var defaultMsg = "Choose the game's rules. Only the player who created the room can set them.";
        var text;

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
                    text += "This does not affect the Same, Plus and Same Wall rules where the cards' original ranks apply.";
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
                    text += "Your deck for this new match will consist of the cards you had control over at the end of the previous game.";
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
                    text += "You must have at least 6 cards to choose this trade mode.";
                    break;
                case "difference":
                    text = "The winner chooses one card per score difference (2, 4, or 5).<br>";
                    text += "You must have at least 11 cards to choose this trade mode.";
                    break;
                case "direct":
                    text  = "The players take the cards they have captured at the end of the game.<br>";
                    text += "This also applies in case of a draw. You must have at least 11 cards to choose this trade mode.";
                    break;
                case "all":
                    text  = "The winner takes the loser's deck.<br>";
                    text += "You must have at least 11 cards to choose this trade mode.";
                    break;
            }
        }

        this.$(".rulesSelect_header-help").html(text);
    }
});
