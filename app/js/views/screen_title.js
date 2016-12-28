define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "models/model_user",
    "text!templates/templ_title.html",
    "tweenMax"
], function Screen_Title ($, _, Backbone, _$, Model_User, Templ_Title) {
    var Screen = require("views/screen");

    return Screen.extend({
        // Instead of generating a new element, bind to the existing skeleton of
        // the App already present in the HTML.
        id        : "screen_title",

        // Our template for the line of statistics at the bottom of the app.
        template : _.template(Templ_Title),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
            "click .title_startBtn" : function () {
                this.transitionOut("rulesSelect");
                _$.audio.audioEngine.playSFX("titleStart");
            },
            "mouseenter .title_startBtn" : function () {
                _$.audio.audioEngine.playSFX("uiHover");
            }
        },

        initialize,
        playIntro,
        transitionIn,
        transitionOut
    });

    function initialize (options = {}) {
        var logo = $(_$.assets.get("svg.ui.logo"));

        this.introTL = null;

        this.$el.html(this.template());
        this.$(".title_logo").append(logo);

        if (options.setup) {
            _$.state.user = new Model_User();

            if (_$.utils.getLocalStorage(_$.app.name) && !options.resetUser) {
                _$.app.loadData();
            } else {
                _$.state.user.setup();
            }
        }

        _$.audio.audioEngine.setBGM("bgm.menus");
        _$.audio.audioEngine.playBGM({ fadeDuration: 2 });
        
        if (options.fullIntro) {
            _$.utils.addDomObserver(this.$el, this.playIntro.bind(this), true);
        } else {
            _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
        }

        this.add();
    }

    function playIntro () {
        _$.events.trigger("stopUserEvents");
        $(window).one("click touchstart", skipIntro.bind(this));
        _$.events.once("gamepad", skipIntro, this);

        var logoPaths = [];
        this.$(".svg-logo").find("path[fill!=none]").each(function () {
            logoPaths.push({
                path: this,
                pathLength: this.getTotalLength()
            });
        });

        this.introTL = new TimelineMax();
        var logoTl   = new TimelineMax();

        this.introTL.to(_$.dom, 2, { opacity : 1, clearProps: "opacity" });
        this.introTL.add(_$.ui.footer.toggleLogo("hide"), 0);
        this.introTL.set(_.map(logoPaths, "path"), { attr: { fill: "rgba(255, 255, 255, 0)", stroke: "rgba(255, 255, 255, 0)", strokeWidth: 0 } }, 0);
        this.introTL.to(_.map(logoPaths, "path"), 2, { attr: { stroke: "rgba(255, 255, 255, 1)" } }, 1);
        this.introTL.call(() => { _$.audio.audioEngine.playSFX("titleLogo", { volume: 0.5 }); }, [], null, 0);
        this.introTL.add(logoTl, 1);
        this.introTL.to(_.map(logoPaths, "path"), 2, { attr: { fill: "rgba(255, 255, 255, 1)" } }, 4);
        this.introTL.call(() => { _$.audio.audioEngine.playSFX("titleIntro"); }, [], null, 4);
        this.introTL.from(this.$(".title_startBtn"), 0.5, { opacity : 0, scale: 1.25, clearProps: "all" }, "-=2");
        this.introTL.addLabel("enterFooter", "-=6");
        this.introTL.add(_$.ui.footer.toggleMenu("show"), "enterFooter");
        this.introTL.add(_$.ui.footer.toggleSocial("show"), "enterFooter+=1");
        this.introTL.set(_$.ui.footer.text, { clearProps:"display" }, "enterFooter+=2.5");
        this.introTL.from(_$.ui.footer.text, 1, { opacity: 0, x: 20, clearProps: "all" }, "enterFooter+=2.5");
        this.introTL.call(function () {
            _$.ui.footer.menu.find(".footer_menu-homeBtn").addClass("is--active");
        }, [], null, "enterFooter+=3.5");
        this.introTL.call(() => {
            _$.events.trigger("addFX");
        }, [], null, "enterFooter");
        this.introTL.call(() => {
            $(window).off("click touchstart", skipIntro.bind(this));
            _$.events.off("gamepad", skipIntro, this);
            _$.events.trigger("startUserEvents");
        });

        _.each(logoPaths, function (logoPath) {
            let dummyObject = { value: 0 };

            logoTl.to(dummyObject, 8, {
                value    : logoPath.pathLength,
                onUpdate : function () {
                    logoPath.path.setAttribute("stroke-dasharray", dummyObject.value + " " + (logoPath.pathLength - dummyObject.value));
                }
            }, 0);
        });

        return this;

        function skipIntro () {
            $(window).off("click touchstart", skipIntro.bind(this));
            _$.events.off("gamepad", skipIntro, this);
            this.introTL.progress(1);
        }
    }

    function transitionIn () {
        _$.events.trigger("stopUserEvents");
        $(window).one("click touchstart", skipTransition.bind(this));
        _$.events.once("gamepad", skipTransition, this);

        var tl = new TimelineMax();
        tl.add(_$.ui.footer.toggleLogo("hide"));
        tl.to(_$.ui.footer.text, 1, { opacity: 0, x: 20 }, 0);
        tl.call(() => { _$.audio.audioEngine.playSFX("titleLogo"); });
        tl.from(this.$(".title_logo"), 1, { opacity : 0, scale: 1.25, clearProps: "all" });
        tl.from(this.$(".title_startBtn"), 0.5, { opacity : 0, scale: 1.25, clearProps: "all" });
        tl.add(_$.ui.footer.toggleMenu("show"), "enterFooter");
        tl.add(_$.ui.footer.toggleSocial("show"), "enterFooter+=1");
        tl.set(_$.ui.footer.text, { clearProps: "display" }, "enterFooter+=2.5");
        tl.to(_$.ui.footer.text, 1, { opacity: 1, x: 0, clearProps: "all" }, "enterFooter+=2.5");
        tl.call(function () {
            _$.ui.footer.menu.find(".footer_menu-homeBtn").addClass("is--active");
        }, [], null, "enterFooter+=3.5");
        tl.call(() => {
            $(window).off("click touchstart", skipTransition.bind(this));
            _$.events.off("gamepad", skipTransition, this);
            _$.events.trigger("startUserEvents");
        }, [], null, "enterFooter");

        return this;

        function skipTransition () {
            $(window).off("click touchstart", skipTransition.bind(this));
            _$.events.off("gamepad", skipTransition, this);
            tl.progress(1);
        }
    }

    function transitionOut (nextScreen, options) {
        _$.events.trigger("stopUserEvents");
        
        var tl = new TimelineMax();
        tl.call(() => { _$.ui.footer.menu.find(".footer_menu-element").removeClass("is--active"); });
        tl.add(_$.ui.footer.toggleSocial("hide"));
        tl.add(_$.ui.footer.toggleMenu("hide"), "-=1.5");
        tl.add(_$.ui.footer.toggleLogo("show"), "-=1.5");
        tl.to(this.$(".title_startBtn"), 0.5, { opacity : 0, scale: 1.25 }, 0);
        tl.to(this.$(".title_logo"), 1, { opacity : 0, scale: 1.25 }, 0.5);
        tl.call(() => { _$.audio.audioEngine.playSFX("titleLogo"); }, [], null, 0.5);
        tl.call(this.changeScreen.bind(this, nextScreen, options));

        return this;
    }
});
