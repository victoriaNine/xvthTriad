define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "views/screen",
    "text!templates/templ_overlayMenu.ejs"
], function Screen_OverlayMenu ($, _, Backbone, _$, Screen, Templ_OverlayMenu) {
    return Screen.extend({
        id       : "screen_overlayMenu",
        template : _.template(Templ_OverlayMenu),
        events   : {
            "mouseenter .menu_element" : function (e) {
                TweenMax.to($(e.currentTarget).find(".menu_element-bg"), 0.2, { y: -50 });
            },
            "mouseleave .menu_element" : function (e) {
                TweenMax.to($(e.currentTarget).find(".menu_element-bg"), 0.2, { y: 0, clearProps: "all" });
            },
            "mouseenter .menu_element:not(.is--disabled)" : function (e) {
                _$.audio.audioEngine.playSFX("menuHover");
            },
            "click .menu_soloMode"     : "toSoloMode",
            "click .menu_versusMode"   : "toVersusMode",
            "click .menu_loungeRoom"   : "toLoungeRoom",
            "click .menu_cardAlbum"    : "toCardAlbum",
            "click .menu_userSettings" : "toUserSettings"
        },

        initialize,
        transitionIn,
        transitionOut,
        toSoloMode,
        toVersusMode,
        toLoungeRoom,
        toCardAlbum,
        toUserSettings
    });

    function initialize (options) {
        Screen.prototype.initialize.call(this);
        
        this.$el.html(this.template());
        TweenMax.set(this.$(".menu_element"), { pointerEvents: "none" });
        _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
        this.add();
    }

    function transitionIn () {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        tl.staggerFrom(this.$(".menu_element"), 0.4, { opacity: 0, clearProps: "opacity" }, 0.1);
        tl.staggerFrom(this.$(".menu_element-bg"), 0.4, { opacity: 0, y: 50, clearProps: "all" }, 0.1, 0.2);
        tl.call(() => {
            _$.events.trigger("startUserEvents");
            _$.events.trigger("mainMenuOpen");
            TweenMax.set(this.$(".menu_element"), { clearProps: "pointerEvents" });
        }, null, [], "-=0.4");

        return this;
    }

    function transitionOut (nextScreen) {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        tl.set(this.$(".menu_element"), { pointerEvents: "none" });
        tl.staggerTo(this.$(".menu_element-bg"), 0.4, { opacity: 0, y: 50 }, -0.1);
        tl.staggerTo(this.$(".menu_element"), 0.4, { opacity: 0 }, -0.1, 0.2);
        tl.call(onTransitionComplete.bind(this));

        function onTransitionComplete () {
            _$.utils.addDomObserver(this.$el, () => {
                _$.events.trigger("startUserEvents");
                _$.events.trigger("mainMenuClosed");

                if (nextScreen && nextScreen !== _$.ui.screen.id.replace("screen_", "")) {
                    _$.ui.screen.transitionOut(nextScreen, { fromMenu: true });
                }
            }, true, "remove");
            this.remove();
        }

        return this;
    }

    function toSoloMode     () { _$.ui.footer.toggleMainMenu("rulesSelect"); }
    function toVersusMode   () { _$.ui.footer.toggleMainMenu("roomSelect"); }
    function toLoungeRoom   () { _$.ui.footer.toggleMainMenu("lounge"); }
    function toCardAlbum    () { _$.ui.footer.toggleMainMenu("cardAlbum"); }
    function toUserSettings () { _$.ui.footer.toggleMainMenu("userSettings"); }
});
