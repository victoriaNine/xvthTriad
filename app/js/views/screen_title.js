define([
    "jquery",
    "underscore", 
    "backbone",
    "models/model_user",
    "models/model_game",
    "views/screen_cardSelect",
    "text!templates/templ_title.html",
    "global",
    "gsap"
], function Screen_Title ($, _, Backbone, User, Game, Screen_CardSelect, Templ_Title, _$) {
    return Backbone.View.extend({
        // Instead of generating a new element, bind to the existing skeleton of
        // the App already present in the HTML.
        tagName   : "section",
        className : "screen",
        id        : "screen_title",

        // Our template for the line of statistics at the bottom of the app.
        template : _.template(Templ_Title),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
            "click .title_startBtn" : "cardSelect"
        },

        initialize : initialize,
        render     : render,
        cardSelect : cardSelect
    });

    function initialize (options) {
        if (options.firstInit) {
            _$.state.user = new User();
            _$.utils.addDomObserver(this.$el, () => {
                TweenMax.to(_$.dom, 2, { opacity : 1, clearProps: "opacity", delay: 0 });
                this.render();
            }, true);
        }

        this.ui      = {};
        this.ui.logo = $(_$.assets.get("svg.ui.logo"));

        this.$el.append(this.template());
        this.$(".title_logo").append(this.ui.logo);
        $(_$.dom).append(this.$el);
    }

    function render () {
        var logoPaths = [];

        this.ui.logo.find("path[fill!=none]").each(function () {
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
        mainTl.add(_$.utils.toggleFooter({menu: "show"}), "enterFooter");
        mainTl.add(_$.utils.toggleFooter({social: "show"}), "enterFooter+=1");
        mainTl.set($(".footer_text"), { display:"" }, "enterFooter+=2.5");
        mainTl.from($(".footer_text"), 1, { opacity:0, x:20, clearProps:"all" }, "enterFooter+=2.5");
        mainTl.call(function () {
            $(".footer_menu-homeBtn").addClass("is--active");
        }, [], null, "enterFooter+=3.5");
        mainTl.call(function () {
            _$.events.trigger("addFX");
        });

        return this;
    }

    function cardSelect () {
        $(".footer_menu-homeBtn").removeClass("is--active");

        var tl = new TimelineMax();
        tl.add(_$.utils.toggleFooter({social: "hide"}));
        tl.add(_$.utils.toggleFooter({menu: "hide"}), "-=1.5");
        tl.add(_$.utils.toggleFooter({logo: "show"}), "-=1.5");
        tl.call(onTransitionComplete.bind(this));

        function onTransitionComplete () {
            _$.state.screen = new Screen_CardSelect();
            this.remove();
        }
    }
});
