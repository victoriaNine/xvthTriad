define([
    "jquery",
    "underscore",
    "backbone",
    "global",
    "views/screen_overlayMenu",
    "views/screen_overlayRankings",
    "views/screen_overlayHelp",
    "views/screen_overlayAbout",
    "text!templates/templ_footer.ejs"
], function Elem_Footer ($, _, Backbone, _$, Screen_OverlayMenu, Screen_OverlayRankings, Screen_OverlayHelp, Screen_OverlayAbout, Templ_Footer) {
    return Backbone.View.extend({
        tagName  : "footer",
        id       : "footer",
        template : _.template(Templ_Footer),
        events   : {
            "click .footer_logo"             : "toggleFooter",
            "click .footer_menu-homeBtn"     : "toTitleScreen",
            "click .footer_menu-menuBtn"     : function (e) { this.toggleMainMenu(); },
            "click .footer_menu-rankingsBtn" : function (e) { this.toggleRankings(); },
            "click .footer_menu-helpBtn"     : function (e) { this.toggleHelpPage(); },
            "click .footer_menu-aboutBtn"    : function (e) { this.toggleAboutPage(); },
            "click .footer_menu-element,.footer_social-element,.footer_logo" : function () {
                _$.audio.audioEngine.playSFX("uiConfirm");
            },
            "mouseenter .footer_menu-element,.footer_social-element,.footer_logo" : function () {
                _$.audio.audioEngine.playSFX("uiHover");
            },
            "click .footer_social-fbBtn"  : function () {
                _$.utils.openSharePopup("facebook");
                _$.app.track("send", "event", {
                    eventCategory: "socialShareEvent",
                    eventAction: "footerFacebook"
                });
            },
            "click .footer_social-ttBtn"  : function () {
                _$.utils.openSharePopup("twitter");
                _$.app.track("send", "event", {
                    eventCategory: "socialShareEvent",
                    eventAction: "footerTwitter"
                });
            },
            "click .footer_social-rdtBtn" : function () {
                _$.utils.openSharePopup("reddit");
                _$.app.track("send", "event", {
                    eventCategory: "socialShareEvent",
                    eventAction: "footerReddit"
                });
             },
            "click .footer_social-tbrBtn" : function () {
                _$.utils.openSharePopup("tumblr");
                _$.app.track("send", "event", {
                    eventCategory: "socialShareEvent",
                    eventAction: "footerTumblr"
                });
            },
            "click .footer_text-volume" : function (e) {
                _$.utils.toggleMute(e.currentTarget);
            }
        },

        initialize,
        toggleAll,
        toggleLogo,
        toggleMenu,
        toggleSocial,

        toggleFooter,
        toTitleScreen,
        toggleMainMenu,
        toggleRankings,
        toggleHelpPage,
        toggleAboutPage
    });

    function initialize (options) {
        this.$el.html(this.template());
        _$.dom.append(this.$el);

        this.isOpen = true;
        this.logo   = this.$(".footer_logo");
        this.menu   = this.$(".footer_menu");
        this.social = this.$(".footer_social");
        this.text   = this.$(".footer_text");

        this.queuedAnimations = {
            logo   : [],
            menu   : [],
            social : [],
            text   : []
        };

        this.logo.append($(_$.assets.get("svg.ui.logo")));
    }

    function toggleMainMenu (nextScreen, noTracking, toSection) {
        if (_$.ui.menu) {
            if (!noTracking) {
                _$.app.track("send", "event", {
                    eventCategory : "footerEvent",
                    eventAction   : "closeMenu"
                });
            }

            this.toggleLogo("hide");
            _$.events.once("mainMenuClosed", () => {
                delete _$.ui.menu;
                this.$(".footer_menu-menuBtn").removeClass("is--active");

                if (_$.ui.rankings || toSection === "toRankings") {
                    this.$(".footer_menu-rankingsBtn").addClass("is--active");
                } else if (_$.ui.help || toSection === "toHelp") {
                    this.$(".footer_menu-helpBtn").addClass("is--active");
                } else if (_$.ui.screen.id === "screen_title") {
                    this.$(".footer_menu-homeBtn").addClass("is--active");
                }
            });

            _$.ui.menu.transitionOut(nextScreen, { fromMenu: true });
            _$.audio.audioEngine.playSFX("menuClose");
        } else {
            if (!noTracking) {
                _$.app.track("send", "event", {
                    eventCategory : "footerEvent",
                    eventAction   : "openMenu"
                });
            }

            if (_$.ui.rankings) {
                _$.events.once("rankingsClosed", () => {
                     proceed.call(this);
                });

                this.toggleRankings(null, false, "toMenu");
            } else if (_$.ui.help) {
                _$.events.once("helpPageClosed", () => {
                     proceed.call(this);
                });

                this.toggleHelpPage(null, false, "toMenu");
            } else {
                proceed.call(this);
            }
        }

        function proceed () {
            this.$(".footer_menu-element").removeClass("is--active");
            this.toggleLogo("show");

            _$.events.once("mainMenuOpen", () => {
                this.$(".footer_menu-element").removeClass("is--active");
                this.$(".footer_menu-menuBtn").addClass("is--active");
            });

            _$.ui.menu = new Screen_OverlayMenu();
            _$.audio.audioEngine.playSFX("menuOpen");
        }
    }

    function toggleRankings (nextScreen, noTracking, toSection) {
        if (_$.ui.rankings) {
            if (!noTracking) {
                _$.app.track("send", "event", {
                    eventCategory : "footerEvent",
                    eventAction   : "closeRankings"
                });
            }

            _$.events.once("rankingsClosed", () => {
                delete _$.ui.rankings;
                this.$(".footer_menu-rankingsBtn").removeClass("is--active");

                if (_$.ui.menu || toSection === "toMenu") {
                    this.$(".footer_menu-menuBtn").addClass("is--active");
                } else if (_$.ui.help || toSection === "toHelp") {
                    this.$(".footer_menu-helpBtn").addClass("is--active");
                } else if (_$.ui.screen.id === "screen_title") {
                    this.$(".footer_menu-homeBtn").addClass("is--active");
                }
            });

            _$.ui.rankings.transitionOut(nextScreen, { fromMenu: true });
        } else {
            if (!noTracking) {
                _$.app.track("send", "event", {
                    eventCategory : "footerEvent",
                    eventAction   : "openRankings"
                });
            }

            if (_$.ui.menu) {
                _$.events.once("mainMenuClosed", () => {
                     proceed.call(this);
                });

                this.toggleMainMenu(null, false, "toRankings");
            } else if (_$.ui.help) {
                _$.events.once("helpPageClosed", () => {
                     proceed.call(this);
                });

                this.toggleHelpPage(null, false, "toRankings");
            } else {
                proceed.call(this);
            }
        }

        function proceed () {
            this.$(".footer_menu-element").removeClass("is--active");

            _$.events.once("rankingsOpen", () => {
                this.$(".footer_menu-element").removeClass("is--active");
                this.$(".footer_menu-rankingsBtn").addClass("is--active");
            });

            _$.ui.rankings = new Screen_OverlayRankings();
        }
    }

    function toggleHelpPage (nextScreen, noTracking, toSection) {
        if (_$.ui.help) {
            if (!noTracking) {
                _$.app.track("send", "event", {
                    eventCategory : "footerEvent",
                    eventAction   : "closeHelp"
                });
            }

            _$.events.once("helpPageClosed", () => {
                delete _$.ui.help;
                this.$(".footer_menu-helpBtn").removeClass("is--active");

                if (_$.ui.menu || toSection === "toMenu") {
                    this.$(".footer_menu-menuBtn").addClass("is--active");
                } else if (_$.ui.rankings || toSection === "toRankings") {
                    this.$(".footer_rankings-menuBtn").addClass("is--active");
                } else if (_$.ui.screen.id === "screen_title") {
                    this.$(".footer_menu-homeBtn").addClass("is--active");
                }
            });

            _$.ui.help.transitionOut(nextScreen, { fromMenu: true });
        } else {
            if (!noTracking) {
                _$.app.track("send", "event", {
                    eventCategory: "footerEvent",
                    eventAction: "openHelp"
                });
            }

            if (_$.ui.menu) {
                _$.events.once("mainMenuClosed", () => {
                     proceed.call(this);
                });

                this.toggleMainMenu(null, false, "toHelp");
            } else if (_$.ui.rankings) {
                _$.events.once("rankingsClosed", () => {
                     proceed.call(this);
                });

                this.toggleRankings(null, false, "toHelp");
            } else {
                proceed.call(this);
            }
        }

        function proceed () {
            this.$(".footer_menu-element").removeClass("is--active");

            _$.events.once("helpPageOpen", () => {
                this.$(".footer_menu-element").removeClass("is--active");
                this.$(".footer_menu-helpBtn").addClass("is--active");
            });

            _$.ui.help = new Screen_OverlayHelp();
        }
    }

    function toggleAboutPage (nextScreen, noTracking) {
        if (_$.ui.about) {
            if (!noTracking) {
                _$.app.track("send", "event", {
                    eventCategory : "footerEvent",
                    eventAction   : "closeAbout"
                });
            }

            _$.events.once("aboutPageClosed", () => {
                delete _$.ui.about;
                this.$(".footer_menu-aboutBtn").removeClass("is--active");

                if (_$.ui.menu) {
                    this.$(".footer_menu-menuBtn").addClass("is--active");
                } else if (_$.ui.rankings) {
                    this.$(".footer_menu-rankingsBtn").addClass("is--active");
                } else if (_$.ui.help) {
                    this.$(".footer_menu-helpBtn").addClass("is--active");
                } else if (_$.ui.screen.id === "screen_title") {
                    this.$(".footer_menu-homeBtn").addClass("is--active");
                }
            });

            _$.ui.about.transitionOut(nextScreen, { fromMenu: true });
        } else {
            if (!noTracking) {
                _$.app.track("send", "event", {
                    eventCategory : "footerEvent",
                    eventAction   : "openAbout"
                });
            }

            this.$(".footer_menu-element").removeClass("is--active");

            _$.events.once("aboutPageOpen", () => {
                this.$(".footer_menu-aboutBtn").addClass("is--active");
            });

            _$.ui.about = new Screen_OverlayAbout();
        }
    }

    function toTitleScreen () {
        if (_$.ui.menu) {
            this.toggleMainMenu("title");
        } else if (_$.ui.rankings) {
            this.toggleRankings("title");
        } else if (_$.ui.help) {
            this.toggleHelpPage("title");
        } else if (_$.ui.about) {
            this.toggleAboutPage("title");
        } else {
            if (_$.ui.screen.id !== "screen_title") {
                _$.ui.screen.transitionOut("title", { fromMenu: true });
            }
        }
    }

    function toggleFooter () {
        _$.events.trigger("stopUserEvents");
        var tl = new TimelineMax();

        if (_$.state.user.isInGame) {
            if (this.isOpen) {
                tl.add(this.toggleSocial("hide"));
            } else {
                tl.add(this.toggleSocial("show"));
            }
        } else {
            if (this.isOpen) {
                tl.add(this.toggleSocial("hide"));
                tl.add(this.toggleMenu("hide"), "-=1.5");
            } else {
                tl.add(this.toggleMenu("show"));
                tl.add(this.toggleSocial("show"), "-=1.5");
            }
        }

        tl.call(() => { _$.events.trigger("startUserEvents"); });
        this.isOpen = !this.isOpen;

        return tl.timeScale(2);
    }

    function toggleAll (state) {
        var tl = new TimelineMax();

        if (state === "show") {
            tl.add(this.toggleLogo("show"));
            tl.add(this.toggleMenu("show"), "-=1.5");
            tl.add(this.toggleSocial("show"), "-=1.5");
        } else if (state === "hide") {
            tl.add(this.toggleSocial("hide"));
            tl.add(this.toggleMenu("hide"), "-=1.5");
            tl.add(this.toggleLogo("hide"), "-=1.5");
        }

        return tl;
    }

    function toggleLogo (state, fromQueue) {
        var el = this.logo;

        if (el.hasClass("is--tweening") && !fromQueue) {
            this.queuedAnimations.logo.push(state);
            return;
        } else if (fromQueue) {
            this.queuedAnimations.logo.splice(0, 1);
        }

        var tl = new TimelineMax();
        tl.call(() => { el.addClass("is--tweening"); });

        if (state === "show") { tl.add(_showElement(el)); }
        else if (state === "hide") { tl.add(_hideElement(el)); }

        tl.call(() => {
            el.removeClass("is--tweening");

            if (this.queuedAnimations.logo.length) {
                this.toggleLogo(this.queuedAnimations.logo[0], true);
            }
        });

        return tl;
    }

    function toggleMenu (state) {
        return _staggerToggle(this.menu.find(".footer_menu-element"), state);
    }

    function toggleSocial (state) {
        return _staggerToggle(this.social.find(".footer_social-element"), state);
    }

    function _staggerToggle (elements, state) {
        var tl = new TimelineMax();
        var nbElement = elements.length;

        $(elements).each(function (i) {
            if (state === "show") {
                tl.add(_showElement($(this)), i * 0.1);
            } else if (state === "hide") {
                tl.add(_hideElement($(this)), (nbElement - i) * 0.1);
            }
        });

        return tl;
    }

    function _showElement (element) {
        var tl = new TimelineMax();

        tl.set(element, { clearProps: "all" });
        tl.set(element, { overflow: "hidden" });
        tl.from(element, 0.5, { width: 0, borderWidth: 0 }, 0);
        tl.from(element, 1.5, { opacity: 0 });
        tl.from(element, 1, { height: 0, padding :0, margin: 0, ease: Power3.easeOut }, 0.5);
        tl.set(element, { clearProps: "all" }, "+=.1");

        return tl;
    }

    function _hideElement (element) {
        var tl = new TimelineMax();

        tl.set(element, { overflow: "hidden" });
        tl.to(element, 1.5, { opacity:0 });
        tl.to(element, 1, { height:0, padding:0, margin:0, ease: Power3.easeOut }, 0);
        tl.to(element, 0.5, { width: 0, borderWidth: 0 }, 0.5);
        tl.set(element, { display: "none", clearProps: "height,width,overflow,borderWidth,padding,margin,opacity" }, "+=.1");

        return tl;
    }
});
