define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "views/screen",
    "views/elem_albumCard",
    "text!templates/templ_cardSelect.ejs"
], function Screen_CardSelect ($, _, Backbone, _$, Screen, Elem_AlbumCard, Templ_CardSelect) {
    var CARD_WIDTH = 180;

    return Screen.extend({
        id        : "screen_cardSelect",

        // Our template for the line of statistics at the bottom of the app.
        template  : _.template(Templ_CardSelect),

        // Delegated events for creating new items, and clearing completed ones.
        events    : {
            "click .cardSelect_content-screenNav-choice-backBtn" : function () { this.transitionOut("rulesSelect"); },
            "click .cardSelect_content-confirm-choice-yesBtn"    : function () {
                this.toGame(this.userDeck);
            },
            "click .cardSelect_content-confirm-choice-noBtn"     : function () { this.toggleConfirm("hide"); },
            "click .cardSelect_content-nav-prevBtn"              : function () { this.pageChange(-1); },
            "click .cardSelect_content-nav-nextBtn"              : function () { this.pageChange(1); },
            "mouseenter .cardSelect_content-screenNav-choice-element,.cardSelect_content-confirm-choice-element,.cardSelect_content-nav-element" : function () {
                _$.audio.audioEngine.playSFX("uiHover");
            },
            "click .cardSelect_content-screenNav-choice-element,.cardSelect_content-confirm-choice-element,.cardSelect_content-nav-element" : function () {
                _$.audio.audioEngine.playSFX("uiConfirm");
            }
        },

        initialize,
        remove,
        render,

        toggleConfirm,

        createAlbumCardViews,
        onResize,
        pageChange,
        navUpdate,
        emptyAlbumCardViews,
        updateDeck,

        transitionIn,
        transitionOut
    });

    function initialize (options) {
        _$.ui.cardSelect = this;

        var cardList         = _$.utils.getCardList();
        this.userAlbum       = _$.state.user.get("album");
        this.uniqueCopies    = _.uniqBy(this.userAlbum.models, "attributes.cardId");
        this.albumCardViews  = [];
        this.currentPage     = 1;
        this.userDeck        = [];
        this.holders         = null;

        this.$el.html(this.template({
            ownedCardsCount: this.userAlbum.length,
            totalCardsCount: cardList.length,
            uniqueCopiesCount: this.uniqueCopies.length
        }));

        var cardBG = $(_$.assets.get("svg.ui.cardBG"));
        this.$(".cardSelect_header-deck-holder").append(cardBG);

        this.createAlbumCardViews();

        _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);

        _$.events.on("resize", this.onResize, this);
        _$.events.on("resizeStart", this.emptyAlbumCardViews, this);
        _$.events.on("updateDeck", this.updateDeck, this);
        this.add();
    }

    function remove () {
        _$.events.off("resize", this.onResize, this);
        _$.events.off("resizeStart", this.emptyAlbumCardViews, this);
        _$.events.off("updateDeck", this.updateDeck, this);

        delete _$.ui.cardSelect;
        Screen.prototype.remove.call(this);

        if (_$.ui.roomSelect) {
            _$.ui.roomSelect.remove();
        }

        if (_$.ui.rulesSelect) {
            _$.ui.rulesSelect.remove();
        }
    }

    function transitionIn () {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        tl.set(this.$el, { clearProps: "display" });
        tl.call(() => {
            this.$(".cardSelect_header").slideDown(500);
            TweenMax.to(this.$(".cardCopy"), 0.4, { opacity: 1, clearProps: "opacity", delay: 0.5 });
        });
        tl.call(() => {
            this.onResize(null, true);
            this.render();
            this.navUpdate();
        }, null, [], tl.recent().endTime() + 0.5);
        tl.call(() => {
            this.$(".cardSelect_content-screenNav").slideDown(500);
            TweenMax.to(this.$(".cardSelect_content-scroll"), 0.4, { opacity: 1, clearProps: "opacity" });
            _$.events.trigger("startUserEvents");

            this.holders = {
                holder1 : {
                    dom  : this.$("#holder1"),
                    card : null
                },
                holder2 : {
                    dom  : this.$("#holder2"),
                    card : null
                },
                holder3 : {
                    dom  : this.$("#holder3"),
                    card : null
                },
                holder4 : {
                    dom  : this.$("#holder4"),
                    card : null
                },
                holder5 : {
                    dom  : this.$("#holder5"),
                    card : null
                }
            };
        }, null, [], "+=0.5");

        return this;
    }

    function transitionOut (nextScreen, fromMenu) {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        if (_$.ui.footer.isOpen) {
            tl.add(_$.ui.footer.toggleFooter(), 0);
        }
        tl.call(() => {
            this.$(".cardSelect_content-screenNav, .cardSelect_content-confirm").slideUp(500);
        }, null, [], "-=1.5");
        tl.to(this.$(".cardSelect_content-scroll"), 0.5, { opacity: 0 }, tl.recent().endTime() + 0.5);
        tl.call(() => {
            TweenMax.to(this.$(".cardCopy"), 0.4, { opacity: 0 });
            this.$(".cardSelect_header").slideUp(500);
        });
        tl.call(() => {
            TweenMax.set(this.$el, { display: "none" });
            this.changeScreen(nextScreen, fromMenu);
        }, null, [], tl.recent().endTime() + 0.5);

        return this;
    }

    function emptyAlbumCardViews () {
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

    function updateDeck (event, options) {
        var holderIndex;

        if (options.action === "remove") {
            if (options.moveFrom) {
                holderIndex = _$.utils.getNodeIndex(options.moveFrom);
                this.userDeck[holderIndex] = null;
            }
        } else if (options.action === "add") {
            holderIndex = _$.utils.getNodeIndex(options.moveTo);
            this.userDeck[holderIndex] = options.albumCardView.cardView.model;

            _.each(_.without(this.albumCardViews, options.albumCardView), (albumCardView) => {
                _.each(albumCardView.cardCopies, (cardCopy) => {
                    if (cardCopy.holder === options.moveTo) {
                        if (options.moveFrom) {
                            albumCardView.moveToDeck(options.moveFrom, cardCopy, true);

                            holderIndex = _$.utils.getNodeIndex(options.moveFrom);
                            this.userDeck[holderIndex] = albumCardView.cardView.model;
                        } else {
                            albumCardView.moveToOrigin(cardCopy, true);
                        }
                    }
                });
            });
        }

        if (_.compact(this.userDeck).length === 5) {
            if (!this.$(".cardSelect_content-confirm").is(":visible")) {
                this.toggleConfirm("show");
                _$.audio.audioEngine.playSFX("gameGain");
            }
        } else if (this.$(".cardSelect_content-confirm").is(":visible")) {
            this.toggleConfirm("hide");
        }
    }

    function toggleConfirm (state) {
        if (state === "show") {
            this.$(".cardSelect_content-confirm").css({pointerEvents: ""}).slideDown();
            this.$(".cardSelect_content-screenNav").css({pointerEvents: "none"}).slideUp();
        } else if (state === "hide") {
            this.$(".cardSelect_content-confirm").css({pointerEvents: "none"}).slideUp();
            this.$(".cardSelect_content-screenNav").css({pointerEvents: ""}).slideDown();
        }
    }
});
