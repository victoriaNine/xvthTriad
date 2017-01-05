define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "views/elem_card",
    "text!templates/templ_endGameCard.ejs"
], function Elem_EndGameCard ($, _, Backbone, _$, Elem_Card, Templ_EndGameCard) {
    return Backbone.View.extend({
        tagName               : "li",
        className             : "game_overlay-endGame-album-card",

        template : _.template(Templ_EndGameCard),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
            "mouseenter .card-red" : function (e) { TweenMax.set(e.currentTarget, { scale: "1.1" }); },
            "mouseleave .card-red" : function (e) { TweenMax.set(e.currentTarget, { scale: "1" }); },
            "click .card"          : "selectCard"
        },

        initialize,
        selectCard
    });

    function initialize (options) {
        this.selected  = false;
        this.deckIndex = options.deckIndex;
        this.cardView  = new Elem_Card({ model: options.card }, { checkOwner: true });

        this.$el.html(this.template({
            name: this.cardView.model.get("name")
        }));

        this.$(".game_overlay-endGame-album-card-visual").append(this.cardView.$el);

        _$.utils.addDomObserver(this.$el, () => {
            if (!_$.state.game.get("cardsToTrade") ||
                _$.state.game.get("winner") !== _$.state.game.get("players").user ||
                this.cardView.model.get("owner") !== _$.state.game.get("players").opponent) {
                this.undelegateEvents();
            }
        }, true);
    }

    function selectCard () {
        this.selected = !this.selected;
        TweenMax.set(this.$(".card"), { scale: "1" });
        this.cardView.flip();
        _$.events.trigger("endGameCardSelected", { endGameCardView: this, selected: this.selected });
    }
});
