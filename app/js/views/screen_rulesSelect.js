define([
    "jquery",
    "underscore", 
    "backbone",
    "views/screen",
    "views/screen_cardSelect",
    "text!templates/templ_rulesSelect.html",
    "global",
    "tweenMax"
], function Screen_RulesSelect ($, _, Backbone, Screen, Screen_CardSelect, Templ_RulesSelect, _$) {
    return Screen.extend({
        id        : "screen_rulesSelect",

        // Our template for the line of statistics at the bottom of the app.
        template  : _.template(Templ_RulesSelect),

        // Delegated events for creating new items, and clearing completed ones.
        events    : {
            "click .rulesSelect_content-rules-rule" : function (e) {
                var temp     = e.currentTarget.className.slice(e.currentTarget.className.indexOf("rule-"));
                var ruleName = e.currentTarget.className.slice(e.currentTarget.className.indexOf("rule-"), e.currentTarget.className.indexOf(temp.slice(temp.indexOf(" "))));
                ruleName     = ruleName.replace("rule-", "");

                if (ruleName !== "trade") {
                    this.toggleRule(ruleName, "toggle");
                }
            },
            "click .rule-trade" : "toggleTrade",
            "click .rulesSelect_content-screenNav-choice-nextBtn" : "toCardSelection"
        },

        initialize,
        remove,

        toggleRule,
        toggleTrade,

        toCardSelection
    });

    function initialize (options) {
        this.$el.html(this.template());
        this.toggleRule("open", true);
        this.toggleRule("random", false);
        this.toggleRule("elemental", false);

        _$.utils.addDomObserver(this.$el, () => {
            var tl = new TimelineMax();
            tl.call(() => {
                this.$(".rulesSelect_header").slideDown(500);
            });
            tl.call(() => {
                /*this.onResize(null, true);
                this.render();
                this.navUpdate();*/
            }, null, [], 0.5);
        }, true);

        //_$.events.on("resize", this.onResize.bind(this));
        this.add();
    }

    function remove () {
        //_$.events.off("resize", this.onResize.bind(this));
        Backbone.View.prototype.remove.call(this);
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

    function toCardSelection () {
        var selectHeight = $(".rule-trade").height();
        var rules        = {};
        var ruleName;
        var tradeRule;
        var tradeRuleIndex;
        var temp;

        this.$(".rulesSelect_content-rules-rule.is--on").each(function () {
            temp     = this.className.slice(this.className.indexOf("rule-"));
            ruleName = this.className.slice(this.className.indexOf("rule-"), this.className.indexOf(temp.slice(temp.indexOf(" "))));

            rules[ruleName.replace("rule-", "")] = true;
        });

        this.$(".rulesSelect_content-rules-rule.is--off").each(function () {
            temp     = this.className.slice(this.className.indexOf("rule-"));
            ruleName = this.className.slice(this.className.indexOf("rule-"), this.className.indexOf(temp.slice(temp.indexOf(" "))));

            rules[ruleName.replace("rule-", "")] = false;
        });

        tradeRuleIndex = Math.ceil(this.$(".rulesSelect_content-rules-rule-select").scrollTop() / selectHeight);
        tradeRule      = this.$(".rulesSelect_content-rules-rule-select").children().eq(tradeRuleIndex)[0].className.replace("tradeRule-", "");
        rules.trade    = tradeRule;

        console.log(rules);
    }

    /*function emptyAlbumCardViews () {
        var that = this;
        if (this.$(".cardSelect_content-album").children().length) {
            _$.utils.fadeOut(this.$(".cardSelect_content-album"), empty.bind(that, true), 0.5);
        }

        function empty () {
            this.$(".cardSelect_content-album").empty();
            TweenMax.set(this.$(".cardSelect_content-album"), { clearProps: "all" });
            _$.events.trigger("albumCardViewEmpty");
        }
    }

    function render () {
        if (this.$(".cardSelect_content-album").children().length) {
            _$.events.once("albumCardViewEmpty", () => {
                this.render();
            });

            return this;
        }

        var albumCardView;
        var currentId;
        for (var i = 0, ii = this.maxVisibleCards; i < ii; i++) {
            currentId = i + (this.currentPage - 1) * this.maxVisibleCards;
            if (currentId === this.albumCardViews.length) {
                this.$(".cardSelect_content-album").removeClass("flex-justify-sb").addClass("flex-justify-start");
                break;
            } else if (i === ii - 1) {
                this.$(".cardSelect_content-album").removeClass("flex-justify-start").addClass("flex-justify-sb");
            }

            albumCardView = this.albumCardViews[currentId].delegateEvents();
            this.$(".cardSelect_content-album").append(albumCardView.$el);
            _$.utils.fadeIn(albumCardView.$el, null, 0.5, 0.15 * i);
        }

        return this;
    }

    function createAlbumCardViews () {
        var copiesCount;
        var albumCardView;

        _.each(this.uniqueCopies, (card) => {
            copiesCount   = this.userAlbum.where({ cardId: card.get("cardId") }).length;
            albumCardView = new Elem_AlbumCard({ card, copiesCount });

            this.albumCardViews.push(albumCardView);
        });
    }

    function pageChange (direction) {
        var oldPage = this.currentPage;
        this.currentPage += direction;
        _.clamp(this.currentPage, 1, this.maxPages);

        if (this.currentPage !== oldPage) {
            this.render();
            this.emptyAlbumCardViews();
            this.navUpdate();
        }
    }

    function onResize (event, noUpdate) {
        this.maxVisibleCards = (Math.floor(this.$(".cardSelect_content-album").width() / CARD_WIDTH) - 1) || 1;
        this.maxPages        = Math.ceil(this.uniqueCopies.length / this.maxVisibleCards);
        this.currentPage     = Math.ceil(this.currentPage / this.maxVisibleCards);
        
        if (!noUpdate) {
            this.navUpdate();
            this.render();
        }
    }

    function navUpdate () {
        if (this.currentPage === 1) {
            _$.utils.fadeOut(this.$(".cardSelect_content-nav-prevBtn"));
        } else {
            _$.utils.fadeIn(this.$(".cardSelect_content-nav-prevBtn"));
        }

        if (this.currentPage === this.maxPages) {
            _$.utils.fadeOut(this.$(".cardSelect_content-nav-nextBtn"));
        } else {
            _$.utils.fadeIn(this.$(".cardSelect_content-nav-nextBtn"));
        }
    }

    function updateDeck (options) {
        var holderIndex;

        if (options.action === "remove") {
            if (options.moveFrom) {
                holderIndex = Array.from(options.moveFrom.parentNode.children).indexOf(options.moveFrom);
                this.userDeck[holderIndex] = null;
            }
        } else if (options.action === "add") {
            holderIndex = Array.from(options.moveTo.parentNode.children).indexOf(options.moveTo);
            this.userDeck[holderIndex] = options.albumCardView.cardView.model;

            _.each(_.without(this.albumCardViews, options.albumCardView), (albumCardView) => {
                _.each(albumCardView.cardCopies, (cardCopy) => {
                    if (cardCopy.holder === options.moveTo) {
                        if (options.moveFrom) {
                            albumCardView.moveInDeck(options.moveFrom, cardCopy, true);

                            holderIndex = Array.from(options.moveFrom.parentNode.children).indexOf(options.moveFrom);
                            this.userDeck[holderIndex] = albumCardView.cardView.model;
                        } else {
                            albumCardView.moveToOrigin(cardCopy, true);
                        }
                    }
                });
            });
        }

        if (_.compact(this.userDeck).length === 5) {
            if (!$(".cardSelect_content-confirm").is(":visible")) {
                toggleConfirm.call(this, "show");
            }
        } else if ($(".cardSelect_content-confirm").is(":visible")) {
            toggleConfirm.call(this, "hide");
        }
    }

    function toggleConfirm (state) {
        if (state === "show") {
            this.$(".cardSelect_content-confirm").slideDown();
            this.$(".cardSelect_content-back").slideUp();
        } else if (state === "hide") {
            this.$(".cardSelect_content-confirm").slideUp();
            this.$(".cardSelect_content-back").slideDown();
        }
    }*/
});
