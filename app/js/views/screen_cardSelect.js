define([
    "jquery",
    "underscore", 
    "backbone",
    "views/screen",
    "views/screen_game",
    "views/elem_albumCard",
    "text!templates/templ_cardSelect.html",
    "global",
    "tweenMax",
], function Screen_CardSelect ($, _, Backbone, Screen, Screen_Game, Elem_AlbumCard, Templ_CardSelect, _$) {
    var CARD_WIDTH = 180;

    return Screen.extend({
        id        : "screen_cardSelect",

        // Our template for the line of statistics at the bottom of the app.
        template  : _.template(Templ_CardSelect),

        // Delegated events for creating new items, and clearing completed ones.
        events    : {
            "click .cardSelect_content-confirm-choice-yesBtn" : "newGame",
            "click .cardSelect_content-confirm-choice-noBtn"  : function () { toggleConfirm.call(this, "hide"); },
            "click .cardSelect_content-nav-prevBtn"           : function () { this.pageChange(-1); },
            "click .cardSelect_content-nav-nextBtn"           : function () { this.pageChange(1); }
        },

        initialize,
        remove,
        render,

        createAlbumCardViews,
        newGame,
        onResize,
        pageChange,
        navUpdate,
        emptyAlbumCardViews,
        updateDeck
    });

    function initialize (options) {
        _$.events.trigger("stopUserEvents");
        _$.state.cardSelectScreen = this;

        var cardList         = _$.utils.getCardList();
        this.userAlbum       = _$.state.user.get("album");
        this.uniqueCopies    = _.uniqBy(this.userAlbum.models, "attributes.cardId");
        this.albumCardViews  = [];
        this.currentPage     = 1;
        this.userDeck        = [];

        this.$el.html(this.template({
            ownedCardsCount: this.userAlbum.length,
            totalCardsCount: cardList.length,
            uniqueCopiesCount: this.uniqueCopies.length
        }));

        var cardBG = $(_$.assets.get("svg.ui.cardBG"));
        this.$(".cardSelect_header-deck-holder").append(cardBG);

        this.createAlbumCardViews();

        _$.utils.addDomObserver(this.$el, () => {
            var tl = new TimelineMax();
            tl.call(() => {
                this.$(".cardSelect_header").slideDown(500);
            });
            tl.call(() => {
                this.onResize(null, true);
                this.render();
                this.navUpdate();
            }, null, [], 0.5);
            tl.call(() => {
                this.$(".cardSelect_content-screenNav").slideDown(500);
                _$.events.trigger("startUserEvents");
            }, null, [], 1);
        }, true);

        _$.events.on("resize", this.onResize.bind(this));
        _$.events.on("resizeStart", this.emptyAlbumCardViews.bind(this));
        _$.events.on("updateDeck", this.updateDeck.bind(this));
        this.add();
    }

    function remove () {
        _$.events.off("resize", this.onResize.bind(this));
        _$.events.off("resizeStart", this.emptyAlbumCardViews.bind(this));
        _$.events.off("updateDeck", this.updateDeck.bind(this));

        delete _$.state.cardSelectScreen;
        Backbone.View.prototype.remove.call(this);
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

    function newGame () {
        _$.state.screen = new Screen_Game({ userDeck: this.userDeck, rules: _$.state.rulesSelectScreen.rules });
        _$.state.rulesSelectScreen.remove();
        this.remove();
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
                            albumCardView.moveInDeck(options.moveFrom, cardCopy, true);

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
                toggleConfirm.call(this, "show");
            }
        } else if (this.$(".cardSelect_content-confirm").is(":visible")) {
            toggleConfirm.call(this, "hide");
        }
    }

    function toggleConfirm (state) {
        if (state === "show") {
            this.$(".cardSelect_content-confirm").slideDown();
            this.$(".cardSelect_content-screenNav").slideUp();
        } else if (state === "hide") {
            this.$(".cardSelect_content-confirm").slideUp();
            this.$(".cardSelect_content-screenNav").slideDown();
        }
    }
});
