define([
    "jquery",
    "underscore", 
    "backbone",
    "models/model_user",
    "models/model_game",
    "views/screen",
    "views/screen_game",
    "text!templates/templ_cardSelect.html",
    "global",
    "gsap"
], function Screen_CardSelect ($, _, Backbone, Model_User, Model_Game, Screen, Screen_Game, Templ_CardSelect, _$) {
    return Screen.extend({
        // Instead of generating a new element, bind to the existing skeleton of
        // the App already present in the HTML.
        tagName   : "section",
        className : "screen",
        id        : "screen_cardSelect",

        // Our template for the line of statistics at the bottom of the app.
        template : _.template(Templ_CardSelect),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
            "click .title_startBtn" : "newGame"
        },

        initialize : initialize,
        render     : render,
        newGame    : newGame
    });

    function initialize (options) {
        var collection       = _$.state.user.get("collection");
        var totalCards       = _$.utils.getCardList();
        var ownedCardsString = collection.length + "/" + totalCards.length;

        this.ui = {};

        this.$el.append(this.template({ ownedCardsString: ownedCardsString }));
        this.add();
    }

    function render () {
        return this;
    }

    function newGame () {
        _$.state.game   = new Model_Game();
        _$.state.screen = new Screen_Game();
        this.remove();
    }
});
