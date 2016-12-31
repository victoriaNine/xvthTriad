define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "views/screen_overlayMenu",
    "views/screen_overlayHelp",
    "views/screen_overlayAbout",
    "text!templates/templ_footer.html"
], function Elem_Footer ($, _, Backbone, _$, Screen_OverlayMenu, Screen_OverlayHelp, Screen_OverlayAbout, Templ_Footer) {
    return Backbone.View.extend({
        tagName : "footer",
        id      : "footer",

        template : _.template(Templ_Footer),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
            "click .footer_logo"          : "toggleFooter",
            "click .footer_menu-homeBtn"  : "toTitleScreen",
            "click .footer_menu-menuBtn"  : function (e) { this.toggleMainMenu(); },
            "click .footer_menu-helpBtn"  : function (e) { this.toggleHelpPage(); },
            "click .footer_menu-aboutBtn" : function (e) { this.toggleAboutPage(); },
            "click .footer_menu-element,.footer_social-element,.footer_logo" : function () {
                _$.audio.audioEngine.playSFX("uiConfirm");
            },
            "mouseenter .footer_menu-element,.footer_social-element,.footer_logo" : function () {
                _$.audio.audioEngine.playSFX("uiHover");
            },
            "click .footer_social-fbBtn"  : function () { _$.utils.openSharePopup("facebook"); },
            "click .footer_social-ttBtn"  : function () { _$.utils.openSharePopup("twitter"); },
            "click .footer_social-rdtBtn" : function () { _$.utils.openSharePopup("reddit"); },
            "click .footer_social-tbrBtn" : function () { _$.utils.openSharePopup("tumblr"); }
        },

        initialize,
        toggleAll,
        toggleLogo,
        toggleMenu,
        toggleSocial,

        toggleFooter,
        toTitleScreen,
        toggleMainMenu,
        toggleHelpPage,
        toggleAboutPage
    });

    function initialize (options) {
        this.$el.html(this.template());
        _$.dom.append(this.$el);

        this.isOpen = false;
        this.logo   = this.$(".footer_logo");
        this.menu   = this.$(".footer_menu");
        this.social = this.$(".footer_social");
        this.text   = this.$(".footer_text");

        var logo = $(_$.assets.get("svg.ui.logo"));
        this.logo.append(logo);
    }

    function toggleMainMenu (nextScreen) {
        if (_$.ui.menu) {
            if (_$.ui.screen.id === "screen_title") {
                this.toggleLogo("hide");
                this.isOpen = false;
            }
            _$.events.once("mainMenuClosed", () => {
                delete _$.ui.menu;
                this.$(".footer_menu-menuBtn").removeClass("is--active");
                if (_$.ui.screen.id === "screen_title") {
                    this.$(".footer_menu-homeBtn").addClass("is--active");
                }
            });

            _$.ui.menu.transitionOut(nextScreen, { fromMenu: true });
            _$.audio.audioEngine.playSFX("menuClose");
        } else {
            if (_$.ui.help) {
                _$.events.once("helpPageClosed", () => {
                     proceed.call(this);
                });

                this.toggleHelpPage();
            } else {
                proceed.call(this);
            }

            function proceed () {
                this.$(".footer_menu-element").removeClass("is--active");
                _$.events.once("mainMenuOpen", () => {
                    if (_$.ui.screen.id === "screen_title") {
                        this.toggleLogo("show");
                        this.isOpen = true;
                    }

                    this.$(".footer_menu-element").removeClass("is--active");
                    this.$(".footer_menu-menuBtn").addClass("is--active");
                });

                _$.ui.menu = new Screen_OverlayMenu();
                _$.audio.audioEngine.playSFX("menuOpen");
            }
        }
    }

    function toggleHelpPage (nextScreen) {
        if (_$.ui.help) {
            if (_$.ui.screen.id === "screen_title") {
                this.toggleLogo("hide");
                this.isOpen = false;
            }
            
            _$.events.once("helpPageClosed", () => {
                delete _$.ui.help;
                this.$(".footer_menu-helpBtn").removeClass("is--active");

                if (_$.ui.menu) {
                    this.$(".footer_menu-menuBtn").addClass("is--active");
                } else if (_$.ui.screen.id === "screen_title") {
                    this.$(".footer_menu-homeBtn").addClass("is--active");
                }
            });

            _$.ui.help.transitionOut(nextScreen, { fromMenu: true });
        } else {
            if (_$.ui.menu) {
                _$.events.once("mainMenuClosed", () => {
                     proceed.call(this);
                });

                this.toggleMainMenu();
            } else {
                proceed.call(this);
            }

            function proceed () {
                this.$(".footer_menu-element").removeClass("is--active");
                _$.events.once("helpPageOpen", () => {
                    if (_$.ui.screen.id === "screen_title") {
                        this.toggleLogo("show");
                        this.isOpen = true;
                    }

                    this.$(".footer_menu-element").removeClass("is--active");
                    this.$(".footer_menu-helpBtn").addClass("is--active");
                });

                _$.ui.help = new Screen_OverlayHelp();
            }
        }
    }

    function toggleAboutPage (nextScreen) {
        if (_$.ui.about) {
            if (_$.ui.screen.id === "screen_title") {
                this.toggleLogo("hide");
                this.isOpen = false;
            }
            
            _$.events.once("aboutPageClosed", () => {
                delete _$.ui.about;
                this.$(".footer_menu-aboutBtn").removeClass("is--active");

                if (_$.ui.menu) {
                    this.$(".footer_menu-menuBtn").addClass("is--active");
                } else if (_$.ui.help) {
                    this.$(".footer_menu-helpBtn").addClass("is--active");
                } else if (_$.ui.screen.id === "screen_title") {
                    this.$(".footer_menu-homeBtn").addClass("is--active");
                }
            });

            _$.ui.about.transitionOut(nextScreen, { fromMenu: true });
        } else {
            this.$(".footer_menu-element").removeClass("is--active");
            _$.events.once("aboutPageOpen", () => {
                if (_$.ui.screen.id === "screen_title") {
                    this.toggleLogo("show");
                    this.isOpen = true;
                }
                this.$(".footer_menu-aboutBtn").addClass("is--active");
            });

            _$.ui.about = new Screen_OverlayAbout();
        }
    }

    function toTitleScreen () {
        if (_$.ui.menu) {
            this.toggleMainMenu("title");
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

        if (_$.state.inGame) {
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

    function toggleLogo (state) {
        var el = this.logo;
        var tl = new TimelineMax();

        el.addClass("is--tweening");
        if (state === "show") {
            tl.add(_showElement(el));
        } else if (state === "hide") {
            tl.add(_hideElement(el));
        }

        tl.call(function () {
            el.removeClass("is--tweening");
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
                tl.add(_showElement($(this)), i * 0.15);
            } else if (state === "hide") {
                tl.add(_hideElement($(this)), (nbElement - i) * 0.15);
            }
        });

        return tl;
    }

    function _showElement (element) {
        var tl = new TimelineMax();

        tl.set(element, { clearProps: "display" });
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
