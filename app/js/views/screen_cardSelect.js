define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "views/screen",
    "views/elem_albumCard",
    "text!templates/templ_cardSelect.ejs"
], function Screen_CardSelect ($, _, Backbone, _$, Screen, Elem_AlbumCard, Templ_CardSelect) {
    const CARDS_PER_LINE = 9;

    return Screen.extend({
        id       : "screen_cardSelect",
        template : _.template(Templ_CardSelect),
        events   : {
            "click .cardSelect_content-screenNav-choice-backBtn" : function () { this.transitionOut("rulesSelect"); },
            "click .cardSelect_content-confirm-choice-yesBtn"    : function () {
                this.toGame(this.userDeck);
            },
            "click .cardSelect_content-confirm-choice-noBtn"     : function () { this.toggleConfirm("hide"); },
            "mouseenter .cardSelect_content-screenNav-choice-element,.cardSelect_content-confirm-choice-element,.cardSelect_content-nav-element" : function () {
                _$.audio.audioEngine.playSFX("uiHover");
            },
            "click .cardSelect_content-screenNav-choice-element,.cardSelect_content-confirm-choice-element,.cardSelect_content-nav-element" : function () {
                _$.audio.audioEngine.playSFX("uiConfirm");
            },
            "mouseenter .cardSelect_content-album-card-visual" : function () {
                _$.audio.audioEngine.playSFX("cardSort");
            }
        },

        initialize,
        remove,

        toggleConfirm,
        createAlbumCardViews,
        updateDeck,

        transitionIn,
        transitionOut
    });

    function initialize (options) {
        Screen.prototype.initialize.call(this);
        
        _$.ui.cardSelect = this;

        var cardList         = _$.utils.getCardList();
        this.userAlbum       = _$.state.user.get("album");
        this.uniqueCopies    = _.uniqBy(this.userAlbum.models, "attributes.cardId");
        this.albumCardViews  = [];
        this.userDeck        = [];
        this.holders         = null;
        this.initialized     = false;

        this.$el.html(this.template({
            ownedCardsCount   : this.userAlbum.length,
            totalCardsCount   : cardList.length,
            uniqueCopiesCount : this.uniqueCopies.length
        }));

        var cardBG = $(_$.assets.get("svg.ui.cardBG"));
        this.$(".cardSelect_header-deck-holder").append(cardBG);

        this.createAlbumCardViews();
        _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
        this.add();
    }

    function remove () {
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
        tl.set(this.$(".cardSelect_content-album-scroll"), { clearProps: "opacity" });
        tl.set(this.$(".cardSelect_content-album-cardWrapper"), { opacity: 0 });
        tl.call(() => {
            this.$(".cardSelect_header").slideDown(500);
            TweenMax.to(this.$(".cardCopy"), 0.5, { opacity: 1, clearProps: "opacity", delay: 0.5 });
        });
        tl.staggerTo(_.take(this.$(".cardSelect_content-album-cardWrapper"), CARDS_PER_LINE * 2), 0.5, { opacity: 1, clearProps: "all" }, 0.1, "+=0.5");
        tl.call(() => {
            this.$(".cardSelect_content-screenNav").slideDown(500);
            _$.events.trigger("startUserEvents");

            if (!this.initialized) {
                this.initialized = true;
                this.holders = {
                    holder1 : { dom: this.$("#holder1"), cardView: null },
                    holder2 : { dom: this.$("#holder2"), cardView: null },
                    holder3 : { dom: this.$("#holder3"), cardView: null },
                    holder4 : { dom: this.$("#holder4"), cardView: null },
                    holder5 : { dom: this.$("#holder5"), cardView: null }
                };
            }
        }, null, [], "-=0.5");

        return this;
    }

    function transitionOut (nextScreen, fromMenu) {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        tl.call(() => {
            this.$(".cardSelect_content-screenNav, .cardSelect_content-confirm").slideUp(500);
        });
        tl.to(this.$(".cardSelect_content-album-scroll"), 0.5, { opacity: 0 }, tl.recent().endTime() + 0.5);
        tl.to(this.$(".cardCopy"), 0.5, { opacity: 0 }, "-=0.5");
        tl.call(() => {
            this.$(".cardSelect_header").slideUp(500);
        });
        tl.add(this.checkFooterUpdate(nextScreen), 0);
        tl.call(() => {
            TweenMax.set(this.$el, { display: "none" });
            this.changeScreen(nextScreen, fromMenu);
        }, null, [], "+=0.5");

        return this;
    }

    function createAlbumCardViews () {
        var copiesCount;
        var albumCardView;

        _.each(this.uniqueCopies, (card) => {
            copiesCount   = this.userAlbum.where({ cardId: card.get("cardId") }).length;
            albumCardView = new Elem_AlbumCard({ card, copiesCount, screen: this });

            this.albumCardViews.push(albumCardView);
            this.$(".cardSelect_content-album-scroll").append($("<div class='cardSelect_content-album-cardWrapper'>").append(albumCardView.$el));
        });
    }

    function updateDeck (options) {
        var fromHolderIndex = options.moveFrom ? parseInt(options.moveFrom.id.replace(/\D/g, "")) : -1;
        var toHolderIndex   = options.moveTo ? parseInt(options.moveTo.id.replace(/\D/g, "")) : -1;

        if (options.action === "remove") {
            // If the card was previously in the deck, we update the deck and holders values
            if (options.moveFrom) {
                this.userDeck[fromHolderIndex]             = null;
                this.holders[options.moveFrom.id].cardView = null;
            } // Otherwise the user cancelled their selection mid-drag-and-drop, so there is nothing to do
        } else if (options.action === "add") {
            this.userDeck[toHolderIndex]             = options.albumCardView.cardView.model;
            this.holders[options.moveTo.id].cardView = options.cardCopy;

            if (options.moveFrom) {
                this.holders[options.moveFrom.id].cardView = null;
            }

            // We check whether we need to reorder the deck in case cards have been swapped places
            // For each card in the album, except the one we're placing (card "A")
            _.each(_.without(this.albumCardViews, options.albumCardView), (albumCardView) => {
                // We check each of its copies
                _.each(albumCardView.cardCopies, (cardCopy) => {
                    // If one of the copies is in the holder we're moving "A" to
                    if (cardCopy.holder === options.moveTo) {
                        // And if "A" was already in the deck (the user is reordering the cards in the deck)
                        if (options.moveFrom) {
                            // We move the card copy where "A" previously was
                            albumCardView.moveToDeck(options.moveFrom, cardCopy, true);
 
                            this.userDeck[fromHolderIndex]             = albumCardView.cardView.model;
                            this.holders[options.moveFrom.id].cardView = cardCopy;
                        } else {
                            // If "A" wasn't in the deck (the user is replacing the card with "A")
                            // We move the card back to its origin
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
