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
    "tweenMax",
    "draggable"
], function Screen_CardSelect ($, _, Backbone, Model_Game, Screen, Screen_Game, Elem_AlbumCard, Templ_CardSelect, _$) {
    var CARD_WIDTH = 180;

    return Screen.extend({
        id        : "screen_cardSelect",

        // Our template for the line of statistics at the bottom of the app.
        template  : _.template(Templ_CardSelect),

        // Delegated events for creating new items, and clearing completed ones.
        events    : {
            "click .cardSelect_content-confirm-choice-yesBtn" : "newGame",
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
        emptyAlbumCardViews
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
            this.onResize(null, true);
            this.render();
            this.navUpdate();
        }, true);

        _$.events.on("resize", this.onResize.bind(this));
        _$.events.on("resizeStart", this.emptyAlbumCardViews.bind(this));
        this.add();
    }

    function remove () {
        _$.events.off("resize", this.onResize.bind(this));
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

            albumCardView = this.albumCardViews[currentId];
            this.$(".cardSelect_content-album").append(albumCardView.$el);
            _$.utils.fadeIn(albumCardView.$el, null, 0.5, 0.15 * i);
        }

        return this;
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
});
