define([
    "jquery",
    "underscore", 
    "backbone",
    "models/model_user",
    "views/screen",
    "views/screen_rulesSelect",
    "text!templates/templ_title.html",
    "global",
    "tweenMax"
], function Screen_Title ($, _, Backbone, Model_User, Screen, Screen_RulesSelect, Templ_Title, _$) {
    return Screen.extend({
        // Instead of generating a new element, bind to the existing skeleton of
        // the App already present in the HTML.
        id        : "screen_title",

        // Our template for the line of statistics at the bottom of the app.
        template : _.template(Templ_Title),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
            "click .title_startBtn" : function () { this.transitionOut("rulesSelect"); }
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
            _$.utils.addDomObserver(this.$el, this.playIntro.bind(this), true);
        } else if (options.fullIntro) {
            _$.utils.addDomObserver(this.$el, this.playIntro.bind(this), true);
        } else {
            _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
        }

        this.add();
    }

    function playIntro () {
        _$.events.trigger("stopUserEvents");

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
        this.introTL.set(_.map(logoPaths, "path"), { attr: { fill: "rgba(255, 255, 255, 0)", stroke: "rgba(255, 255, 255, 0)", strokeWidth: 0 } }, 0);
        this.introTL.to(_.map(logoPaths, "path"), 2, { attr: { stroke: "rgba(255, 255, 255, 1)" } }, 1);
        this.introTL.add(logoTl, 1);
        this.introTL.to(_.map(logoPaths, "path"), 2, { attr: { fill: "rgba(255, 255, 255, 1)" } }, 4);
        this.introTL.from(this.$(".title_startBtn"), 0.5, { opacity : 0, scale: 1.25, clearProps: "all" }, "-=2");

        _.each(logoPaths, function (logoPath) {
            let dummyObject = { value: 0 };

            logoTl.to(dummyObject, 8, {
                value    : logoPath.pathLength,
                onUpdate : function () {
                    logoPath.path.setAttribute("stroke-dasharray", dummyObject.value + " " + (logoPath.pathLength - dummyObject.value));
                }
            }, 0);
        });
        
        this.introTL.addLabel("enterFooter", "-=6");
        this.introTL.add(_$.ui.footer.toggleMenu("show"), "enterFooter");
        this.introTL.add(_$.ui.footer.toggleSocial("show"), "enterFooter+=1");
        this.introTL.set(_$.ui.footer.text, { clearProps:"display" }, "enterFooter+=2.5");
        this.introTL.from(_$.ui.footer.text, 1, { opacity: 0, x: 20, clearProps: "all" }, "enterFooter+=2.5");
        this.introTL.call(function () {
            _$.ui.footer.menu.find(".footer_menu-homeBtn").addClass("is--active");
        }, [], null, "enterFooter+=3.5");
        this.introTL.call(() => {
            _$.events.trigger("startUserEvents");
            _$.events.trigger("addFX");
        }, [], null, "enterFooter");

        return this;
    }

    function transitionIn () {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        tl.add(_$.ui.footer.toggleLogo("hide"));
        tl.to(_$.ui.footer.text, 1, { opacity: 0, x: 20 }, 0);
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
            _$.events.trigger("startUserEvents");
        }, [], null, "enterFooter");

        return this;
    }

    function transitionOut (nextScreen) {
        _$.events.trigger("stopUserEvents");
        
        if (this.introTL.time() !== this.introTL.duration()) {
            this.introTL.progress(1);
        }

        var tl = new TimelineMax();
        tl.call(() => { _$.ui.footer.menu.find(".footer_menu-element").removeClass("is--active"); });
        tl.add(_$.ui.footer.toggleSocial("hide"));
        tl.add(_$.ui.footer.toggleMenu("hide"), "-=1.5");
        tl.add(_$.ui.footer.toggleLogo("show"), "-=1.5");
        tl.to(this.$(".title_startBtn"), 0.5, { opacity : 0, scale: 1.25 }, 0);
        tl.to(this.$(".title_logo"), 1, { opacity : 0, scale: 1.25 }, 0.5);
        tl.call(onTransitionComplete.bind(this));

        function onTransitionComplete () {
            if (nextScreen === "rulesSelect") {
                _$.utils.addDomObserver(this.$el, () => {
                    _$.events.trigger("startUserEvents");
                    _$.ui.screen = new Screen_RulesSelect();
                }, true, "remove");
                this.remove();
            }
        }
    }
});
