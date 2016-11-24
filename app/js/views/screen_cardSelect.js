define([
    "jquery",
    "underscore", 
    "backbone",
    "models/model_game",
    "views/screen",
    "views/screen_game",
    "views/elem_albumCard",
    "text!templates/templ_cardSelect.html",
    "global",
    "gsap"
], function Screen_CardSelect ($, _, Backbone, Model_Game, Screen, Screen_Game, Elem_AlbumCard, Templ_CardSelect, _$) {
    var CARD_WIDTH = 180;

    return Screen.extend({
        id        : "screen_cardSelect",

        // Our template for the line of statistics at the bottom of the app.
        template : _.template(Templ_CardSelect),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
            "click .cardSelect_content-confirm-choice-yesBtn" : "newGame"
        },

        initialize,
        remove,
        render,

        createAlbumCardViews,
        newGame,
        onResize,
        navUpdate
    });

    function initialize (options) {
        var cardList         = _$.utils.getCardList();
        this.userAlbum       = _$.state.user.get("album");
        this.uniqueCopies    = _.uniqBy(this.userAlbum.models, "attributes.cardId");
        this.albumCardViews  = [];
        this.currentPage     = 1;

        this.$el.append(this.template({
            ownedCardsCount: this.userAlbum.length,
            totalCardsCount: cardList.length,
            uniqueCopiesCount: this.uniqueCopies.length
        }));

        var cardBG = $(_$.assets.get("svg.ui.cardBG"));
        this.$(".cardSelect_header-deck-card").append(cardBG);

        this.createAlbumCardViews();

        _$.utils.addDomObserver(this.$el, () => {
            this.onResize(true);
            this.navUpdate();
            this.render();
        }, true);

        $(window).on("resize." + _$.appName, this.onResize.bind(this));
        this.add();
    }

    function remove () {
        $(window).off("resize." + _$.appName);
        Backbone.View.prototype.remove.call(this);
    }

    function render () {
        var that = this;

        if (this.$(".cardSelect_content-album").children().length) {
            //_$.utils.fadeOut($(".cardSelect_content-album-card"), reset.call(that, true));
            reset.call(that, true)
        } else {
            console.log("no cards");
            reset.call(that);
        }

        function reset (empty) {
            console.log("reset");
            if (empty) {
                this.$(".cardSelect_content-album").empty();
            }

            console.log(this.maxVisibleCards, this.albumCardViews);

            var albumCardView;
            for (var i = 0, ii = this.maxVisibleCards; i < ii; i++) {
                if (i === this.albumCardViews.length) {
                    this.$(".cardSelect_content-album").removeClass("flex-justify-sb").addClass("flex-justify-start");
                    break;
                } else if (i === ii - 1) {
                    this.$(".cardSelect_content-album").removeClass("flex-justify-start").addClass("flex-justify-sb");
                }

                albumCardView = this.albumCardViews[i * this.currentPage];
                this.$(".cardSelect_content-album").append(albumCardView.$el);
                //_$.utils.fadeIn(albumCardView.$el, null, 0.5, 0.15 * i);
            }

            return this;
        }
    }

    function newGame () {
        _$.state.game   = new Model_Game();
        _$.state.screen = new Screen_Game();
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

    function onResize (event, noRender) {
        this.maxVisibleCards = Math.floor(this.$(".cardSelect_content-album").width() / CARD_WIDTH) - 1;
        this.maxPages        = Math.ceil(this.uniqueCopies.length / this.maxVisibleCards);
        
        if (!noRender) {
            this.render();
        }
    }

    function navUpdate () {
        if (this.currentPage === 1) {
            this.$(".cardSelect_content-nav-prevBtn").fadeOut();
        } else {
            this.$(".cardSelect_content-nav-prevBtn").fadeIn();
        }

        if (this.currentPage === this.maxPages) {
            this.$(".cardSelect_content-nav-prevBtn").fadeOut();
        } else {
            this.$(".cardSelect_content-nav-prevBtn").fadeIn();
        }
    }
});
