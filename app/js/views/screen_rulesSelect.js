define([
    "jquery",
    "underscore", 
    "backbone",
    "views/screen",
    "views/screen_cardSelect",
    "views/screen_game",
    "collections/coll_deck",
    "text!templates/templ_rulesSelect.html",
    "global",
    "tweenMax"
], function Screen_RulesSelect ($, _, Backbone, Screen, Screen_CardSelect, Screen_Game, Coll_Deck, Templ_RulesSelect, _$) {
    var RULES = "open|random|elemental|same|sameWall|suddenDeath|plus|trade";

    return Screen.extend({
        id        : "screen_rulesSelect",

        // Our template for the line of statistics at the bottom of the app.
        template  : _.template(Templ_RulesSelect),

        // Delegated events for creating new items, and clearing completed ones.
        events    : {
            "click .rulesSelect_content-rules-rule" : function (e) {
                var ruleName = e.currentTarget.className.match(RULES)[0];

                if (ruleName !== "trade") {
                    this.toggleRule(ruleName, "toggle");
                }
            },
            "click .rule-trade"                                   : "toggleTrade",
            "click .rulesSelect_content-screenNav-choice-backBtn" : function () { this.transitionOut("title"); },
            "click .rulesSelect_content-screenNav-choice-nextBtn" : "toNextStep",
            "click .rulesSelect_content-confirm-choice-yesBtn"    : "toNextStep",
            "click .rulesSelect_content-confirm-choice-noBtn"     : function () { toggleConfirm.call(this, "hide"); },
        },

        initialize,
        remove,

        toggleRule,
        toggleTrade,

        toNextStep,
        transitionOut
    });

    function initialize (options) {
        _$.events.trigger("stopUserEvents");
        _$.state.rulesSelectScreen = this;

        this.$el.html(this.template());
        this.toggleRule("open", true);
        this.toggleRule("random", false);
        this.toggleRule("elemental", false);
        TweenMax.set(this.$(".rulesSelect_content-rules-rule"), { opacity: 0 });

        _$.utils.addDomObserver(this.$el, () => {
            var tl = new TimelineMax();
            tl.call(() => {
                this.$(".rulesSelect_header").slideDown(500);
            });
            tl.staggerTo(this.$(".rulesSelect_content-rules-rule"), 0.5, { opacity: 1, clearProps:"all" }, 0.1, 0.5);
            tl.call(() => {
                this.$(".rulesSelect_content-screenNav").slideDown(500);
                _$.events.trigger("startUserEvents");
            });
        }, true);

        this.add();
    }

    function remove () {
        if (_$.state.cardSelectScreen) {
             _$.state.cardSelectScreen.remove();
        }
        
        Backbone.View.prototype.remove.call(this);
        delete _$.state.rulesScreen;
    }

    function toggleRule (rule, state) {
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

        if (rule === "random" && state) {
            toggleConfirm.call(this, "show");
        } else {
            toggleConfirm.call(this, "hide");
        }
    }

    function toggleTrade (e) {
        var index        = _$.utils.getNodeIndex(e.target);
        var selectHeight = $(".rule-trade").height();
        var toggle       = this.$(".rule-trade .rulesSelect_content-rules-rule-toggle");
        var dropdown     = this.$(".rulesSelect_content-rules-rule-select");

        if (this.$(".rule-trade").hasClass("is--active")) {
            this.$(".rule-trade").removeClass("is--active");
            TweenMax.to(dropdown[0], 0.4, { scrollTop: index * selectHeight });
        } else {
            this.$(".rule-trade").addClass("is--active");
        }

        $(window).on("click.toggleTrade", (clickEvent) => {
            if (!$(clickEvent.target).parents(".rule-trade").length) {
                var scrollPosition = Math.round(dropdown.scrollTop() / selectHeight) * selectHeight;
                TweenMax.to(dropdown[0], 0.4, { scrollTop: scrollPosition });
                this.$(".rule-trade").removeClass("is--active");
                $(window).off("click.toggleTrade");
            }
        });
    }

    function toNextStep () {
        _$.events.trigger("stopUserEvents");

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

        this.rules = rules;

        if (this.rules.random) {
            this.transitionOut("game");
        } else {
            this.transitionOut("cardSelect");
        }
    }

    function transitionOut (newScreen) {
        var tl = new TimelineMax();
        tl.call(() => {
            this.$(".rulesSelect_content-screenNav, .rulesSelect_content-confirm").slideUp(500);
        });
        tl.to(this.$(".rulesSelect_content-rules"), 0.5, { opacity: 0 }, 0.5);
        tl.call(() => {
            this.$(".rulesSelect_header").slideUp(500);
        });
        tl.call(() => {
            this.$el.hide();
            onTransitionComplete.call(this);
        }, null, [], "+=0.5");

        function onTransitionComplete () {
            if (newScreen === "game") {
                _$.utils.addDomObserver(this.$el, () => {
                    var randomDeck = new Coll_Deck(_$.utils.getRandomCards({
                        amount : 5,
                        album  : _$.state.user.get("album"),
                        unique : true
                    }));

                    _$.events.trigger("startUserEvents");
                    _$.state.screen = new Screen_Game({ deck: randomDeck, rules: this.rules });
                }, true, "remove");

                this.remove();
            } else if (newScreen === "cardSelect") {
                _$.events.trigger("startUserEvents");
                _$.state.screen = _$.state.cardSelectScreen || new Screen_CardSelect();
            } else if (newScreen === "title") {
                _$.utils.addDomObserver(this.$el, () => {
                    var Screen_Title = require("views/screen_title");

                    _$.events.trigger("startUserEvents");
                    _$.state.screen = new Screen_Title();
                }, true, "remove");

                this.remove();
            }
        }
    }

    function toggleConfirm (state) {
        if (state === "show") {
            this.$(".rulesSelect_content-confirm").slideDown();
            this.$(".rulesSelect_content-screenNav").slideUp();
        } else if (state === "hide") {
            this.$(".rulesSelect_content-confirm").slideUp();
            this.$(".rulesSelect_content-screenNav").slideDown();
        }
    }
});
