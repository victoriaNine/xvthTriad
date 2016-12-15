define([
    "jquery",
    "underscore", 
    "backbone",
    "models/model_card",
    "views/screen",
    "views/screen_cardSelect",
    "views/screen_game",
    "text!templates/templ_rulesSelect.html",
    "global",
    "tweenMax"
], function Screen_RulesSelect ($, _, Backbone, Model_Card, Screen, Screen_CardSelect, Screen_Game, Templ_RulesSelect, _$) {
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
        transitionIn,
        transitionOut
    });

    function initialize (options) {
        _$.state.rulesSelectScreen = this;

        this.$el.html(this.template());
        this.toggleRule("open", true);
        this.toggleRule("random", false);
        this.toggleRule("elemental", false);
        this.toggleRule("suddenDeath", false);

        _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);

        this.add();
    }

    function remove () {
        delete _$.state.rulesSelectScreen;
        Backbone.View.prototype.remove.call(this);
        
        if (_$.state.cardSelectScreen) {
            _$.state.cardSelectScreen.remove();
        }
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

        if (rule === "random") {
            if (state && !$(".rulesSelect_content-confirm").is(":visible")) {
                toggleConfirm.call(this, "show");
            } else if ($(".rulesSelect_content-confirm").is(":visible")) {
                toggleConfirm.call(this, "hide");
            }
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
        });

        return this;
    }

    function transitionOut (nextScreen) {
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
            onTransitionComplete.call(this);
        }, null, [], tl.recent().endTime() + 0.5);

        function onTransitionComplete () {
            if (nextScreen === "game") {
                _$.utils.addDomObserver(this.$el, () => {
                    var randomDeck = _.sampleSize(_$.state.user.get("album").models, 5);

                    _$.events.trigger("startUserEvents");
                    _$.ui.screen = new Screen_Game({ userDeck: randomDeck, rules: this.rules });
                }, true, "remove");

                this.remove();
            } else if (nextScreen === "cardSelect") {
                _$.events.trigger("startUserEvents");
                _$.ui.screen = _$.state.cardSelectScreen ? _$.state.cardSelectScreen.transitionIn() : new Screen_CardSelect();
            } else if (nextScreen === "title") {
                _$.utils.addDomObserver(this.$el, () => {
                    var Screen_Title = require("views/screen_title");

                    _$.events.trigger("startUserEvents");
                    _$.ui.screen = new Screen_Title();
                }, true, "remove");

                this.remove();
            }
        }

        return this;
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
