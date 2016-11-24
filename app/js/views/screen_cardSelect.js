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
    return Screen.extend({
        id        : "screen_cardSelect",

        // Our template for the line of statistics at the bottom of the app.
        template : _.template(Templ_CardSelect),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
            "click .cardSelect_content-confirm-choice-yesBtn" : "newGame"
        },

        initialize : initialize,
        render     : render,
        newGame    : newGame
    });

    function initialize (options) {
        var cardList         = _$.utils.getCardList();
        this.userAlbum       = _$.state.user.get("album");
        this.uniqueCopies    = _.uniqBy(this.userAlbum.models, "attributes.cardId");
        this.albumCardViews  = [];
        this.maxVisibleCards = 6;

        this.$el.append(this.template({
            ownedCardsCount: this.userAlbum.length,
            totalCardsCount: cardList.length,
            uniqueCopiesCount: this.uniqueCopies.length
        }));

        var cardBG = $(_$.assets.get("svg.ui.cardBG"));
        this.$(".cardSelect_header-deck-card").append(cardBG);

        this.render();
        this.add();
    }

    function render () {
        var card;
        var copiesCount;
        var albumCardView;

        for (var i = 0, ii = this.uniqueCopies.length; i < ii; i++) {
            card          = this.uniqueCopies[i];
            copiesCount   = this.userAlbum.where({ cardId: card.get("cardId") }).length;
            albumCardView = new Elem_AlbumCard({ card, copiesCount });

            this.albumCardViews.push(albumCardView);
            this.$(".cardSelect_content-album").append(albumCardView.el);
        }

        return this;
    }

    function newGame () {
        _$.state.game   = new Model_Game();
        _$.state.screen = new Screen_Game();
        this.remove();
    }
});
