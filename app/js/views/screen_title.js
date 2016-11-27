define([
    "jquery",
    "underscore", 
    "backbone",
    "models/model_user",
    "models/model_game",
    "views/screen",
    "views/screen_cardSelect",
    "text!templates/templ_title.html",
    "global",
    "tweenMax"
], function Screen_Title ($, _, Backbone, Model_User, Model_Game, Screen, Screen_CardSelect, Templ_Title, _$) {
    return Screen.extend({
        // Instead of generating a new element, bind to the existing skeleton of
        // the App already present in the HTML.
        id        : "screen_title",

        // Our template for the line of statistics at the bottom of the app.
        template : _.template(Templ_Title),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
            "click .title_startBtn" : "cardSelect"
        },

        initialize : initialize,
        render     : render,

        setupApp   : setupApp,
        cardSelect : cardSelect
    });

    function initialize (options) {
        if (options.firstInit) {
            this.setupApp();
        }

        var logo = $(_$.assets.get("svg.ui.logo"));

        this.$el.html(this.template());
        this.$(".title_logo").append(logo);
        this.add();
    }

    function render () {
        var logoPaths = [];

        this.$(".svg-logo").find("path[fill!=none]").each(function () {
            logoPaths.push({
                path: this,
                pathLength: this.getTotalLength()
            });
        });

        var mainTl = new TimelineMax({ delay: 1 });
        var logoTl = new TimelineMax();

        mainTl.set(_.map(logoPaths, "path"), { attr: { fill: "rgba(255, 255, 255, 0)", stroke: "rgba(255, 255, 255, 0)", strokeWidth: 0 } });
        mainTl.to(_.map(logoPaths, "path"), 2, { attr: { stroke: "rgba(255, 255, 255, 1)" } }, 0);
        mainTl.add(logoTl, 0);
        mainTl.to(_.map(logoPaths, "path"), 2, { attr: { fill: "rgba(255, 255, 255, 1)" } }, 4);
        mainTl.from(this.$(".title_startBtn"), 0.5, { opacity : 0, scale: 1.25, clearProps: "all" }, "-=2");

        _.each(logoPaths, function (logoPath) {
            let test = {value: 0};

            logoTl.to(test, 8, {
                value: logoPath.pathLength,
                onUpdateParams: ["{self}"],
                onUpdate: function (tween) {
                    logoPath.path.setAttribute("stroke-dasharray", tween.target.value + " " + (logoPath.pathLength - tween.target.value));
                }
            }, 0);
        });
        
        mainTl.addLabel("enterFooter", "-=6");
        mainTl.add(_$.state.footer.toggleMenu("show"), "enterFooter");
        mainTl.add(_$.state.footer.toggleSocial("show"), "enterFooter+=1");
        mainTl.set(_$.state.footer.text, { display:"" }, "enterFooter+=2.5");
        mainTl.from(_$.state.footer.text, 1, { opacity:0, x:20, clearProps:"all" }, "enterFooter+=2.5");
        mainTl.call(function () {
            _$.state.footer.menu.find(".footer_menu-homeBtn").addClass("is--active");
        }, [], null, "enterFooter+=3.5");
        mainTl.call(() => {
            _$.events.trigger("startUserEvents");
            _$.events.trigger("addFX");
        });

        return this;
    }

    function setupApp () {
        _$.events.trigger("stopUserEvents");

        _$.state.user = new Model_User();
        _$.utils.addDomObserver(this.$el, () => {
            TweenMax.to(_$.dom, 2, { opacity : 1, clearProps: "opacity", delay: 0 });
            this.render();
        }, true);
    }

    function cardSelect () {
        _$.events.trigger("stopUserEvents");
        _$.state.footer.menu.find(".footer_menu-homeBtn").removeClass("is--active");

        var tl = new TimelineMax();
        tl.add(_$.state.footer.toggleSocial("hide"));
        tl.add(_$.state.footer.toggleMenu("hide"), "-=1.5");
        tl.add(_$.state.footer.toggleLogo("show"), "-=1.5");
        tl.to(this.$(".title_startBtn"), 0.5, { opacity : 0, scale: 1.25 }, 0);
        tl.to(this.$(".title_logo"), 1, { opacity : 0, scale: 1.25 }, 0.5);
        tl.call(onTransitionComplete.bind(this));

        function onTransitionComplete () {
            _$.utils.addDomObserver(this.$el, () => {
                _$.state.screen = new Screen_CardSelect();
                _$.events.trigger("startUserEvents");
            }, true, "remove");
            this.remove();
        }
    }
});
