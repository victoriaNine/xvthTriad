define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "models/model_user",
    "views/screen",
    "text!templates/templ_title.ejs",
    "text!templates/templ_titleAccount.ejs"
], function Screen_Title ($, _, Backbone, _$, Model_User, Screen, Templ_Title, Templ_TitleAccount) {
    return Screen.extend({
        // Instead of generating a new element, bind to the existing skeleton of
        // the App already present in the HTML.
        id        : "screen_title",

        // Our template for the line of statistics at the bottom of the app.
        template : _.template(Templ_Title),

        // Delegated events for creating new items, and clearing completed ones.
        events           : {
            "click .title_startBtn" : function () {
                _$.app.track("send", "event", {
                    eventCategory: "titleEvent",
                    eventAction: "clickStart"
                });

                _$.audio.audioEngine.playSFX("menuOpen");
                _$.ui.footer.toggleMainMenu(null, false);
            },
            "mouseenter .title_startBtn,.title_account-element,.title_overlay-signup-btn,.title_overlay-login-btn" : function () {
                _$.audio.audioEngine.playSFX("uiHover");
            },
            "click .title_account-element,.title_overlay-signup-btn,.title_overlay-login-btn" : function () {
                _$.audio.audioEngine.playSFX("uiConfirm");
            },
            "focus .title_overlay-signup-form-field-input,title_overlay-login-form-field-input" : function () {
                _$.audio.audioEngine.playSFX("uiInput");
            },
            "click .title_account-signupBtn" : function () {
                this.openOverlay("signup");
            },
            "click .title_account-loginBtn" : function () {
                this.openOverlay("login");
            },
            "click .title_account-logoutBtn" : function () {
                _$.app.track("set", {
                    "dimension0" : "difficulty",
                    "metric0"    : "albumSize",
                    "metric1"    : "gameStats"
                });
                _$.app.track("send", "event", {
                    eventCategory : "accountEvent",
                    eventAction   : "logout",
                    dimension1    : _$.state.user.get("difficulty"),
                    metric0       : _$.state.user.get("album").length,
                    metric1       : JSON.stringify(_$.state.user.get("gameStats"))
                });

                this.$(".title_account-logoutBtn").text("Signing out...");

                _$.comm.sessionManager.once("logout", (event, message) => {
                    this.$(".title_account-logoutBtn").text("See you!");
                    _$.audio.audioEngine.playSFX("gameGain");
                });

                _$.comm.sessionManager.logout();
            },
            "click .title_overlay-signup-closeBtn" : function (e) {
                e.preventDefault();
                this.closeOverlay("signup");
            },
            "click .title_overlay-login-closeBtn" : function (e) {
                e.preventDefault();
                this.closeOverlay("login");
            },
            "submit .title_overlay-signup-form"      : "doSignup",
            "submit .title_overlay-login-form"       : "loginConfirmAction",
            "click .title_overlay-login-forgotPwd"   : "toForgotPassword"
        },

        initialize,
        remove,
        playIntro,
        transitionIn,
        transitionOut,
        openOverlay,
        closeOverlay,
        doSignup,
        doLogin,
        updateAccountLayout,
        toForgotPassword,
        sendPasswordMail
    });

    function initialize (options = {}) {
        this.introTL            = null;
        this.accountTemplate    = _.template(Templ_TitleAccount);
        this.loginConfirmAction = this.doLogin;
        this.signedUp           = false;

        if (options.setup) {
            _$.state.user = new Model_User();

            if (_$.utils.getLocalStorage(_$.app.name)) {
                _$.app.loadData();
            } else {
                _$.state.user.setup();
            }
        }

        _$.comm.sessionManager.on("login", () => {
            _$.events.once("userDataLoaded", () => {
                if (this.$(".title_overlay-login").hasClass("is--active")) {
                    this.$(".title_overlay-login-message").text("Welcome back, " + _$.state.user.get("name") + "!");
                    _$.audio.audioEngine.channels.bgm.setVolume(_$.state.user.get("bgmVolume"));
                    _$.audio.audioEngine.channels.sfx.setVolume(_$.state.user.get("sfxVolume"));
                    
                    this.closeOverlay("login");
                }

                this.updateAccountLayout();
                _$.comm.sessionManager.logoutOthers();
            });

            _$.app.loadData();
        });

        this.$el.html(this.template());
        var logo = $(_$.assets.get("svg.ui.logo"));
        this.$(".title_logo").append(logo);

        if (_$.state.user.dataLoaded) {
            proceed.call(this);
        } else {
            _$.events.once("userDataLoaded", () => {
                proceed.call(this);
            });
        }

        function proceed () {
            this.updateAccountLayout();

            _$.audio.audioEngine.channels.bgm.setVolume(_$.state.user.get("bgmVolume"));
            _$.audio.audioEngine.channels.sfx.setVolume(_$.state.user.get("sfxVolume"));
            _$.audio.audioEngine.setBGM("bgm.menus");

            _$.audio.audioEngine.playBGM({ fadeDuration: 2 });
            
            if (options.fullIntro) {
                _$.utils.addDomObserver(this.$el, this.playIntro.bind(this), true);
            } else {
                _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
            }

            this.add();
        }
    }

    function remove () {
        _$.comm.sessionManager.removeAllListeners("login");
        Screen.prototype.remove.call(this);
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
        this.introTL.from(this.$(".title_account"), 0.5, { opacity: 0, x: 20, clearProps: "all" }, "enterFooter+=2.5");
        this.introTL.call(function () {
            _$.ui.footer.menu.find(".footer_menu-homeBtn").addClass("is--active");
        }, [], null, "enterFooter+=3.5");
        this.introTL.call(() => {
            $(window).off("click touchstart", skipIntro.bind(this));
            _$.events.off("gamepad", skipIntro, this);
            _$.events.trigger("startUserEvents");
            _$.events.trigger("initialized");
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
        tl.from(this.$(".title_account"), 0.5, { opacity: 0, x: 20, clearProps: "all" }, "enterFooter+=2.5");
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
        tl.call(() => {
            _$.audio.audioEngine.playSFX("titleStart");
            _$.ui.footer.menu.find(".footer_menu-element").removeClass("is--active");
        });
        tl.add(_$.ui.footer.toggleSocial("hide"));
        tl.add(_$.ui.footer.toggleMenu("hide"), "-=1.5");
        tl.add(_$.ui.footer.toggleLogo("show"), "-=1.5");
        tl.to(this.$(".title_account"), 0.5, { opacity: 0, x: 20 }, 0);
        tl.to(this.$(".title_startBtn"), 0.5, { opacity: 0, scale: 1.25 }, 0);
        tl.to(this.$(".title_logo"), 1, { opacity: 0, scale: 1.25 }, 0.5);
        tl.call(() => { _$.audio.audioEngine.playSFX("titleLogo"); }, [], null, 0.5);
        tl.call(this.changeScreen.bind(this, nextScreen, options));

        return this;
    }

    function openOverlay (overlayName) {
        _$.events.trigger("stopUserEvents");
        var overlaySelector = ".title_overlay-" + overlayName;
        var overlay         = this.$(overlaySelector);

        if (overlayName === "signup") {
            this.$(".title_overlay-signup-form .field-name input").val(_$.state.user.get("name"));
            this.signedUp = false;
        }

        var tl = new TimelineMax();
        tl.call(() => { overlay.addClass("is--active"); });
        tl.call(() => { this.$(overlaySelector + "-confirmBtn," + overlaySelector + "-closeBtn").slideDown(400); }, [], null, "+=0.8");
        if (overlayName === "login") {
            tl.from(this.$(".title_overlay-login-forgotPwd"), 0.4, { opacity: 0, y: 20, clearProps: "all" }, "+=0.2");
        }
        tl.call(() => { _$.events.trigger("startUserEvents"); });
    }

    function closeOverlay (overlayName) {
        _$.events.trigger("stopUserEvents");
        var overlaySelector = ".title_overlay-" + overlayName;
        var overlay         = this.$(overlaySelector);

        var tl = new TimelineMax();
        if (overlayName === "login") {
            tl.to(this.$(".title_overlay-login-forgotPwd"), 0.4, { opacity: 0, y: 20 });
        }
        tl.call(() => {
            this.$(overlaySelector + "-confirmBtn," + overlaySelector + "-closeBtn").slideUp(400);
            this.$(overlaySelector + " input").blur();
        }, [], null, "-=0.2");
        tl.call(() => { overlay.removeClass("is--active"); }, [], null, "+=0.4");
        tl.call(() => {
            if (_$.comm.sessionManager.getSession()) {
                overlay.remove();
            } else {
                this.$(overlaySelector + " input").each(function () {
                    $(this).val($(this).attr("value") || "");
                    $(this).removeClass("is--invalid");
                });

                this.$(overlaySelector + "-message").text("");
                if (overlayName === "login") {
                    TweenMax.set(this.$(".title_overlay-login-forgotPwd"), { clearProps: "all" });

                    if (this.loginConfirmAction !== this.doLogin) {
                        this.toForgotPassword();
                    }
                }
            }

            _$.events.trigger("startUserEvents");
        }, [], null, "+=0.8");
    }

    function doSignup (e) {
        if (this.signedUp) {
            e.preventDefault();
            return false;
        }

        _$.app.track("send", "event", {
            eventCategory : "accountEvent",
            eventAction   : "register",
            dimension1    : _$.state.user.get("difficulty"),
            metric0       : _$.state.user.get("album").length,
            metric1       : JSON.stringify(_$.state.user.get("gameStats"))
        });

        var data = {
            name            : this.$(".title_overlay-signup-form .field-name input").val(),
            username        : this.$(".title_overlay-signup-form .field-login input").val(),
            email           : this.$(".title_overlay-signup-form .field-email input").val(),
            password        : this.$(".title_overlay-signup-form .field-password input").val(),
            confirmPassword : this.$(".title_overlay-signup-form .field-password input").val(),
            profile         : _.omit(_$.utils.getUserData(), ["version", "userId", "name"])
        };
        
        this.$(".title_overlay-signup-form-field-input").removeClass("is--invalid");
        this.$(".title_overlay-signup-message").text("");
        this.$(".title_overlay-signup-confirmBtn").text("Signing up...");

        _$.comm.sessionManager.register(data).then((response) => {
            _$.audio.audioEngine.playSFX("gameGain");
            this.$(".title_overlay-signup-confirmBtn").text("Success!");
            this.$(".title_overlay-signup-message").text("Thank you! A confirmation mail was sent to " + data.email + ".");
            this.$(".title_overlay-signup-confirmBtn, .title_overlay-signup-closeBtn").slideUp(200);
            setTimeout(() => { this.$(".title_overlay-signup-closeBtn").slideDown(200); }, 1000);

            this.signedUp = true;
        }).catch((error) => {
            var errorString = _.map(_.omit(error.validationErrors, "confirmPassword"), (error) => { return error.join(". "); }).join("<br>");
            errorString = errorString.replace("username", "login").replace("Username", "Login");

            _$.audio.audioEngine.playSFX("uiError");
            this.$(".title_overlay-signup-confirmBtn").text("Error!");
            setTimeout(() => { this.$(".title_overlay-signup-confirmBtn").text("Confirm"); }, 1000);

            if (_.has(error.validationErrors, "name")) {
                this.$(".title_overlay-signup-form .field-name input").addClass("is--invalid");
            }

            if (_.has(error.validationErrors, "username")) {
                this.$(".title_overlay-signup-form .field-login input").addClass("is--invalid");
            }

            if (_.has(error.validationErrors, "password")) {
                this.$(".title_overlay-signup-form .field-password input").addClass("is--invalid");
            }

            if (_.has(error.validationErrors, "email")) {
                this.$(".title_overlay-signup-form .field-email input").addClass("is--invalid");
            }
            
            this.$(".title_overlay-signup-message").html(errorString);
        });

        return false;
    }

    function doLogin () {
        _$.app.track("send", "event", {
            eventCategory : "accountEvent",
            eventAction   : "login",
            dimension1    : _$.state.user.get("difficulty"),
            metric0       : _$.state.user.get("album").length,
            metric1       : JSON.stringify(_$.state.user.get("gameStats"))
        });

        this.$(".title_overlay-login-form-field-input").removeClass("is--invalid");
        this.$(".title_overlay-login-message").text("");
        this.$(".title_overlay-login-confirmBtn").text("Signing in...");

        _$.comm.sessionManager.login({
            username: this.$(".title_overlay-login-form .field-login input").val(),
            password: this.$(".title_overlay-login-form .field-password input").val()
        }).then((session) => {
            _$.audio.audioEngine.playSFX("gameGain");
            this.$(".title_overlay-login-confirmBtn").text("Success!");
        }).catch((error) => {
            _$.audio.audioEngine.playSFX("uiError");
            this.$(".title_overlay-login-confirmBtn").text("Error!");
            setTimeout(() => { this.$(".title_overlay-login-confirmBtn").text("Confirm"); }, 1000);

            this.$(".title_overlay-login-form-field-input").addClass("is--invalid");
            this.$(".title_overlay-login-message").text(error.message || error.error);
        });

        return false;
    }

    function toForgotPassword () {
        _$.app.track("send", "event", {
            eventCategory : "accountEvent",
            eventAction   : "forgotPassword",
            dimension1    : _$.state.user.get("difficulty"),
            metric0       : _$.state.user.get("album").length,
            metric1       : JSON.stringify(_$.state.user.get("gameStats"))
        });

        _$.events.trigger("stopUserEvents");

        var direction = (this.loginConfirmAction === this.doLogin) ? "sendMail" : "login";
        var fromField;
        var toField;
        var messageTxt;
        var forgotPwdTxt;
        var confirmBtnTxt;
        var fromPos;
        var toPos;

        if (direction === "sendMail") {
            this.loginConfirmAction = this.sendPasswordMail;

            fromField     = ".field-password";
            toField       = ".field-email";
            messageTxt    = "Enter your login or the email address linked to your account.";
            forgotPwdTxt  = "I remember!";
            confirmBtnTxt = "Send";
            fromPos       = "-100%";
            toPos         = "100%";
        } else {
            this.loginConfirmAction = this.doLogin;

            fromField     = ".field-email";
            toField       = ".field-password";
            messageTxt    = "";
            forgotPwdTxt  = "Forgot your password?";
            confirmBtnTxt = "Confirm";
            fromPos       = "100%";
            toPos         = "-100%";
        }

        this.$(".title_overlay-login-form .field-login input").val("");
        this.$(".title_overlay-login-form-field-input").removeClass("is--invalid");

        var tl = new TimelineMax();
        tl.to(this.$(".title_overlay-login-message, .title_overlay-login-forgotPwd, .title_overlay-login-confirmBtn"), 0.4, { opacity: 0 });
        tl.to(this.$(".title_overlay-login-form " + fromField), 0.2, { opacity: 0, x: fromPos }, 0);
        tl.set(this.$(".title_overlay-login-form " + fromField), { display:"none", clearProps:"opacity, x" });
        tl.set(this.$(".title_overlay-login-form " + toField), { clearProps:"display, x" });
        tl.from(this.$(".title_overlay-login-form " + toField), 0.2, { opacity: 0, x: toPos, clearProps:"all" });
        tl.call(() => {
            this.$(".title_overlay-login-message").text(messageTxt);
            this.$(".title_overlay-login-forgotPwd").text(forgotPwdTxt);
            this.$(".title_overlay-login-confirmBtn").text(confirmBtnTxt);
        });
        tl.to(this.$(".title_overlay-login-message, .title_overlay-login-forgotPwd, .title_overlay-login-confirmBtn"), 0.4, { opacity: 1, clearProps:"opacity" });
        tl.call(() => { _$.events.trigger("startUserEvents"); });
    }

    function sendPasswordMail () {
        this.$(".title_overlay-login-form-field-input").removeClass("is--invalid");
        this.$(".title_overlay-login-confirmBtn").text("Sending mail...");
        var userId = this.$(".title_overlay-login-form .field-login input").val();
        var email  = this.$(".title_overlay-login-form .field-email input").val();

        if (email || !userId) {
            proceed.call(this);
        } else {
            _$.comm.sessionManager.getUser(userId).then((user) => {
                email = user.email;
                proceed.call(this);
            }).catch((error) => {
                onError.call(this, error.message || error.error);
            });
        }

        function proceed () {
            _$.comm.sessionManager.forgotPassword(email).then((response) => {
                _$.audio.audioEngine.playSFX("gameGain");
                this.$(".title_overlay-login-confirmBtn").text("Success!");
                this.$(".title_overlay-login-message").text("Password recovery email sent to " + email + ".");
            }).catch((error) => {
                onError.call(this, error.message || error.error);
            });
        }

        function onError (message) {
            _$.audio.audioEngine.playSFX("uiError");
            this.$(".title_overlay-login-confirmBtn").text("Error!");
            setTimeout(() => { this.$(".title_overlay-login-confirmBtn").text("Send"); }, 1000);

            this.$(".title_overlay-login-form-field-input").addClass("is--invalid");
            this.$(".title_overlay-login-message").text(message);
        }

        return false;
    }

    function updateAccountLayout () {
        var accountLayout = $(this.accountTemplate({
            isLoggedIn : _$.comm.sessionManager.getSession(),
            userName   : _$.state.user.get("name")
        }));

        if (this.$(".title_account").length) {
            var tl = new TimelineMax();
            tl.to(this.$(".title_account"), 0.5, { opacity: 0, x: 20 });
            tl.call(() => {
                _$.utils.addDomObserver(this.$(".title_account"), proceed.bind(this), true, "remove");
                this.$(".title_account").remove();
            });
        } else {
            proceed.call(this);
        }

        function proceed () {
            _$.utils.addDomObserver(accountLayout, () => {
                TweenMax.from(this.$(".title_account"), 0.5, { opacity: 0, x: 20, clearProps: "all" });
            }, true);

            this.$el.append(accountLayout);
        }
    }
});
