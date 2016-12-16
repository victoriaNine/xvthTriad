define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "views/screen",
    "text!templates/templ_menu.html",
    "tweenMax"
], function Screen_OverlayMenu ($, _, Backbone, _$, Screen, Templ_Menu) {
    return Screen.extend({
        tagName : "section",
        id      : "screen_overlayMenu",

        template : _.template(Templ_Menu),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
            "mouseenter .menu_element" : function (e) { TweenMax.to($(e.currentTarget).find(".menu_element-bg"), 0.4, { y: -50 }); },
            "mouseleave .menu_element" : function (e) { TweenMax.to($(e.currentTarget).find(".menu_element-bg"), 0.4, { y: 0, clearProps: "all" }); },
            "click .menu_soloMode"     : "toSoloMode",
            "click .menu_userSettings" : "toUserSettings"
        },

        initialize,
        transitionIn,
        transitionOut,
        toSoloMode,
        toUserSettings
    });

    function initialize (options) {
        this.$el.html(this.template());

        _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
        this.add();
    }

    function transitionIn () {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        tl.staggerFrom(this.$(".menu_element"), 0.4, { opacity: 0, clearProps: "all" }, 0.1);
        tl.staggerFrom(this.$(".menu_element-bg"), 0.4, { opacity: 0, y: 50, clearProps: "all" }, 0.1, 0.2);
        tl.call(() => {
            _$.events.trigger("startUserEvents");
            _$.events.trigger("mainMenuOpen");
        });

        return this;
    }

    function transitionOut (nextScreen) {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        tl.staggerTo(this.$(".menu_element-bg"), 0.4, { opacity: 0, y: 50 }, -0.1, 0.2);
        tl.staggerTo(this.$(".menu_element"), 0.4, { opacity: 0 }, -0.1);
        tl.call(onTransitionComplete.bind(this));

        function onTransitionComplete () {
            _$.utils.addDomObserver(this.$el, () => {
                _$.events.trigger("startUserEvents");
                _$.events.trigger("mainMenuClosed");

                if (nextScreen && _$.ui.screen.id !== "screen_" + nextScreen) {
                    _$.ui.screen.transitionOut(nextScreen);
                }
            }, true, "remove");
            this.remove();
        }

        return this;
    }

    function toSoloMode () {
        this.$(".menu_soloMode").css({ pointerEvents: "none" });
        _$.ui.footer.toggleMainMenu("rulesSelect");
    }

    function toUserSettings () {
        /*this.$(".menu_userSettings").css({ pointerEvents: "none" });
        _$.ui.footer.toggleMainMenu("userSettings");*/
    }
});
