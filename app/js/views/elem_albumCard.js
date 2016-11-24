define([
    "jquery",
    "underscore", 
    "backbone",
    "gsap",
    "global",
    "text!templates/templ_albumCard.html",
    "views/elem_card"
], function Elem_AlbumCard ($, _, Backbone, GSAP, _$, Templ_AlbumCard, Elem_Card) {
    return Backbone.View.extend({
        tagName               : "li",
        className             : "cardSelect_content-album-card",

        template : _.template(Templ_AlbumCard),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
        },

        initialize       : initialize,
        render           : render
    });

    function initialize (options) {
        this.cardView = new Elem_Card({ model: options.card });
        this.$el.append(this.template({
            name: options.card.get("name"),
            copiesCount: options.copiesCount
        }));

        this.$(".cardSelect_content-album-card-visual").append(this.cardView.$el);
    }

    function render () {
        return this;
    }
});
