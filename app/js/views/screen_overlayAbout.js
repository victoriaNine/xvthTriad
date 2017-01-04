define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "views/screen",
    "text!templates/templ_overlayAbout.html"
], function Screen_OverlayAbout ($, _, Backbone, _$, Screen, Templ_OverlayAbout) {
    return Screen.extend({
        tagName : "section",
        id      : "screen_overlayAbout",

        template : _.template(Templ_OverlayAbout),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
            "click .about_prevBtn" : "close",
            "click .about_social-element,.about_prevBtn,.about_credits" : function () {
                _$.audio.audioEngine.playSFX("uiConfirm");
            },
            "mouseenter .about_social-element,.about_prevBtn,.about_credits" : function () {
                _$.audio.audioEngine.playSFX("uiHover");
            },
            "click .about_social-fbBtn"  : function () {
                _$.utils.openSharePopup("facebook");
                _$.app.track("send", "event", {
                    eventCategory: "socialShareEvent",
                    eventAction: "aboutFacebook"
                });
            },
            "click .about_social-ttBtn"  : function () {
                _$.utils.openSharePopup("twitter");
                _$.app.track("send", "event", {
                    eventCategory: "socialShareEvent",
                    eventAction: "aboutTwitter"
                });
            },
            "click .about_social-rdtBtn" : function () {
                _$.utils.openSharePopup("reddit");
                _$.app.track("send", "event", {
                    eventCategory: "socialShareEvent",
                    eventAction: "aboutReddit"
                });
             },
            "click .about_social-tbrBtn" : function () {
                _$.utils.openSharePopup("tumblr");
                _$.app.track("send", "event", {
                    eventCategory: "socialShareEvent",
                    eventAction: "aboutTumblr"
                });
            },
            "click .about_credits" : function () {
                _$.app.track("send", "event", {
                    eventCategory: "aboutEvent",
                    eventAction: "clickCredits"
                });
            },
            "click .about_credits" : function () {
                _$.app.track("send", "event", {
                    eventCategory: "aboutEvent",
                    eventAction: "clickLegal"
                });
            }
        },

        initialize,
        transitionIn,
        transitionOut,
        close,
        toggleLine
    });

    function initialize (options) {
        this.$el.html(this.template({ appVersion: _$.app.version, appVersionFlag: _$.app.versionFlag }));
        this.line = this.$(".about_line");
        this.logo = this.$(".about_logo");

        var logo = $(_$.assets.get("svg.ui.logo"));
        this.logo.append(logo);

        _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
        this.add();
    }

    function transitionIn () {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        tl.call(() => { this.logo.addClass("is--tweening"); });
        tl.from(this.$el, 0.4, { opacity: 0, clearProps: "all" });
        tl.from(this.$(".about_bg"), 0.4, { opacity: 0, scale: 1.25, clearProps: "all" }, "-=0.2");
        tl.add(this.toggleLine("show"));
        tl.from(this.logo, 0.4, { opacity: 0, scale: 1.25, clearProps: "all" }, "-=1");
        tl.from($(".about_text, .about_credits, .about_legal"), 0.4, { opacity: 0, y: -20, clearProps: "all" }, tl.recent().endTime());
        tl.from($(".about_version"), 0.4, { opacity: 0, x: 20, clearProps: "all" }, tl.recent().startTime());
        tl.call(() => { _$.audio.audioEngine.playSFX("menuOpen"); }, [], null, tl.recent().endTime() - 0.4);
        tl.staggerFrom($(".about_social-element"), 0.4, { opacity: 0, y: 20, clearProps: "all" }, 0.1, "-=0.2");
        tl.from(this.$(".about_prevBtn"), 0.5, { opacity : 0, scale: 1.25, clearProps: "all" });
        tl.call(() => {
            this.$el.addClass("is--showingLogo");
            this.logo.removeClass("is--tweening");
            _$.events.trigger("startUserEvents");
            _$.events.trigger("aboutPageOpen");
        });

        return this;
    }

    function transitionOut (nextScreen) {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        tl.call(() => {
            this.logo.addClass("is--tweening");
            this.$el.removeClass("is--showingLogo");
        });
        tl.to(this.$(".about_prevBtn"), 0.5, { opacity : 0, scale: 1.25 });
        tl.staggerTo($(".about_social-element"), 0.4, { opacity: 0, y: 20 }, -0.1);
        tl.call(() => { _$.audio.audioEngine.playSFX("menuClose"); }, [], null, "-=0.2");
        tl.to($(".about_text, .about_credits, .about_legal"), 0.4, { opacity: 0, y: -20 });
        tl.to($(".about_version"), 0.4, { opacity: 0, x: 20 }, tl.recent().startTime());
        tl.to(this.logo, 0.4, { opacity: 0, scale: 1.25 });
        tl.add(this.toggleLine("hide"), "-=0.4");
        tl.to(this.$(".about_bg"), 0.4, { opacity: 0, scale: 1.25 }, "-=1");
        tl.to(this.$el, 0.4, { opacity: 0 }, "-=0.2");
        tl.call(onTransitionComplete.bind(this));

        function onTransitionComplete () {
            _$.utils.addDomObserver(this.$el, () => {
                _$.events.trigger("startUserEvents");
                _$.events.trigger("aboutPageClosed");

                if (nextScreen && nextScreen !== _$.ui.screen.id.replace("screen_", "")) {
                    _$.ui.screen.transitionOut(nextScreen, { fromMenu: true });
                }
            }, true, "remove");
            this.remove();
        }

        return this;
    }

    function toggleLine (state) {
        var el = this.line;
        var tl = new TimelineMax();

        if (state === "show") {
            tl.set(el, { clearProps:"display" });
            tl.from(el, 1.5, { opacity:0, width:0, ease: Power3.easeOut, clearProps:"all" });
        } else if (state === "hide") {
            tl.to(el, 1.5, { width: 0, opacity: 0 });
            tl.set(el, { display:"none", clearProps:"width,opacity" }, "+=.1");
        }

        return tl;
    }

    function close () {
        _$.ui.footer.toggleAboutPage();
    }
});
