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
    var self;

    return Screen.extend({
        id       : "screen_title",
        template : _.template(Templ_Title),
        events   : {
            "click .title_startBtn" : function () {
                _$.app.track("send", "event", {
                    eventCategory : "titleEvent",
                    eventAction   : "clickStart"
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
            "focus .title_overlay-signup-form-field-input,.title_overlay-login-form-field-input" : function () {
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
                    _$.audio.audioEngine.playSFX("logout");
                    _$.audio.audioEngine.playSFX("gameGain");
                    this.$(".title_account-logoutBtn").text("See you!");
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
            "click .title_overlay-passwordReset-closeBtn" : function (e) {
                e.preventDefault();
                this.closeOverlay("passwordReset");
            },
            "submit .title_overlay-signup-form"        : "doSignup",
            "submit .title_overlay-login-form"         : "loginConfirmAction",
            "click .title_overlay-login-forgotPwd"     : "toForgotPassword",
            "submit .title_overlay-passwordReset-form" : "doPasswordReset"
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
        doPasswordReset,
        resetPassword,
        updateAccountLayout,
        toForgotPassword,
        sendPasswordMail
    });

    function initialize (options = {}) {
        self = this;

        Screen.prototype.initialize.call(this);

        this.introTL            = null;
        this.accountTemplate    = _.template(Templ_TitleAccount);
        this.loginConfirmAction = this.doLogin;
        this.signedUp           = false;
        this.resetToken         = null;

        this.$el.html(this.template());
        this.$(".title_logo").append($(_$.assets.get("svg.ui.logo")));

        // If the flag for the initialization flow is on
        if (options.setup) {
            // We create a new user
            _$.state.user = new Model_User();

            // If there is game data in the storage and the data is valid
            if (_$.utils.getLocalStorage(_$.app.name) && _$.app.checkDataType(_$.utils.getLocalStorage(_$.app.name))) {
                // If that data is session data
                if (_$.comm.sessionManager.getSession()) {
                    // We check whether the session is still valid
                    _$.comm.sessionManager.validateSession().then(() => {
                        // If the session is still valid
                        // We start checking its validity routinely
                        _$.comm.sessionManager.setValidateInterval();

                        // We setup a listener to catch when the data is done loading from the database
                        _$.events.once("userDataLoaded", () => {
                            // We logout the user from other potential sessions and refresh the current one
                            _$.comm.sessionManager.logoutOthers().then(_$.comm.sessionManager.refresh.bind( _$.comm.sessionManager)).then(() => {
                                // We add the logout event listener
                                _$.comm.sessionManager.once("logout", (...args) => {
                                    _$.ui.screen.onLogout(...args);
                                });

                                // And we emit the login event to the game server
                                _$.comm.socketManager.emit("login", _$.comm.sessionManager.getSession().user_id);
                            }).catch((error) => {
                                _$.debug.error("screen_title.js@133", error);
                            });

                            // We go on with the initialization flow
                            proceed.call(this);
                        });

                        // We start loading the data
                        _$.app.loadData().catch((error) => {
                            _$.debug.error("screen_title.js@142", error);
                            setupNewUser.call(this);
                        });
                    }).catch((error) => {
                        _$.debug.error("screen_title.js@146", error);
                        _$.events.once("initialized", () => {
                            _$.audio.audioEngine.playSFX("menuOpen");
                            this.info({
                                titleBold    : "Session",
                                titleRegular : "expired",
                                msg          : "You have been logged out"
                            });
                        });

                        // Otherwise there is no data to load, so we create a new user profile
                        setupNewUser.call(this);
                    });
                } else {
                    // Otherwise it's savefile data
                    // We setup a listener to catch when the data from the savefile is done loading
                    _$.events.once("userDataLoaded", () => {
                        // We go on with the initialization flow
                        proceed.call(this);
                    });

                    // We start loading the data
                    _$.app.loadData().catch((error) => {
                        _$.debug.error("screen_title.js@169", error);
                        setupNewUser.call(this);
                    });
                }
            } else {
                // If there is data but it is invalid, we prepare an error overlay
                if (_$.utils.getLocalStorage(_$.app.name) && !_$.app.checkDataType(_$.utils.getLocalStorage(_$.app.name))) {
                    _$.events.once("initialized", () => {
                        _$.audio.audioEngine.playSFX("menuOpen");
                        this.error({
                            msg    : "Invalid save data",
                            action : "close"
                        });
                    });
                } else {
                  // Otherwise the user has no data to load, so we prepare a welcome overlay
                  _$.events.once("initialized", () => {
                      _$.audio.audioEngine.playSFX("gameGain");
                      this.info({
                          titleBold : "Welcome!",
                          msg       : "First timer? Feel free to check the tutorials in the Help section.",
                          btnMsg    : "Got it!"
                      });
                  });
                }

                // Since there is no data to load, we create a new user profile
                setupNewUser.call(this);
            }
        } else {
            // If the data has already been loaded before, just continue
            proceed.call(this);
        }

        function setupNewUser () {
            // We remove any previous listener
            _$.events.off("userDataLoaded");

            // Otherwise there is no data to load, so we create a new user profile
            // We setup a listener to catch when the profile has been created
            _$.events.once("userDataLoaded", () => {
                // We go on with the initialization flow
                proceed.call(this);
            });

            // We setup the profile
            _$.state.user.setup();
        }

        function proceed () {
            if (options.setup) {
                _$.audio.audioEngine.channels.bgm.setVolume(_$.state.user.get("bgmVolume"));
                _$.audio.audioEngine.channels.sfx.setVolume(_$.state.user.get("sfxVolume"));
                _$.audio.audioEngine.setBGM("bgm.menus");
                _$.audio.audioEngine.playBGM({ fadeDuration: 2 });
            }

            // We add a listener to the login event
            _$.comm.sessionManager.once("login", _onLogin);

            _$.events.on("updateOnlineCount", (event, data) => {
                this.$(".title_account-info-playerCount-onlineCount").text(data.msg);
            });

            _$.events.on("updateLoungeCount", (event, data) => {
                this.$(".title_account-info-playerCount-loungeCount").text(data.msg);
            });

            if (options.fullIntro) {
                _$.utils.addDomObserver(this.$el, this.playIntro.bind(this), true);
            } else {
                _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
            }

            this.updateAccountLayout();
            this.add();
        }
    }

    function remove () {
        _$.comm.sessionManager.off("login", _onLogin);
        _$.events.off("updateOnlineCount");
        _$.events.off("updateLoungeCount");
        Screen.prototype.remove.call(this);
    }

    function _onLogin (...args) {
        // We start checking its validity routinely
        _$.comm.sessionManager.setValidateInterval();

        // We add the logout event listner
        _$.comm.sessionManager.once("logout", (...args) => {
            _$.ui.screen.onLogout(...args);
        });

        // We setup a listener to catch when the data is done loading from the database
        _$.events.once("userDataLoaded", (...args) => {
            // We update the interface
            self.$(".title_overlay-login-message").text("Welcome back, " + _$.state.user.get("name") + "!");
            self.closeOverlay("login");
            self.updateAccountLayout();

            // We update the audio levels to the user's saved settings
            _$.audio.audioEngine.channels.bgm.setVolume(_$.state.user.get("bgmVolume"));
            _$.audio.audioEngine.channels.sfx.setVolume(_$.state.user.get("sfxVolume"));
            _$.audio.audioEngine.channels.notif.setVolume(_$.state.user.get("notifVolume"));

            // We logout the user from other potential sessions
            _$.comm.sessionManager.logoutOthers().then((...args) => {
                // And we emit the login event to the game server
                _$.comm.socketManager.emit("login", _$.comm.sessionManager.getSession().user_id);
            }).catch((error) => {
                _$.debug.error("screen_title.js@263", error);
            });
        });

        // We start loading the data
        _$.app.loadData().catch((error) => {
            _$.debug.error("screen_title.js@276", error);
        });
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
        this.introTL.set(_.map(logoPaths, "path"), { attr: { fill: "rgba(255, 255, 255, 0)", stroke: "rgba(255, 255, 255, 0)", strokeWidth: 0 } }, 0);
        this.introTL.to(_.map(logoPaths, "path"), 2, { attr: { stroke: "rgba(255, 255, 255, 1)" } }, 1);
        this.introTL.call(() => { _$.audio.audioEngine.playSFX("titleLogo", { volume: 0.5 }); }, [], null, 0);
        this.introTL.add(logoTl, 1);
        this.introTL.to(_.map(logoPaths, "path"), 2, { attr: { fill: "rgba(255, 255, 255, 1)" } }, 4);
        this.introTL.call(() => { _$.audio.audioEngine.playSFX("titleIntro"); }, [], null, 4);
        this.introTL.from(this.$(".title_startBtn"), 0.5, { opacity : 0, scale: 1.25, clearProps: "all" }, "-=2");
        this.introTL.addLabel("enterFooter", "-=5");
        this.introTL.add(_$.ui.footer.toggleMenu("show"), "enterFooter");
        this.introTL.add(_$.ui.footer.toggleSocial("show"), "enterFooter+=0.5");
        this.introTL.set(_$.ui.footer.text, { clearProps:"display" }, "enterFooter+=2");
        this.introTL.from(_$.ui.footer.text, 1, { opacity: 0, x: 20, clearProps: "all" }, "enterFooter+=2");
        this.introTL.from(this.$(".title_account"), 0.5, { opacity: 0, x: 20, clearProps: "all" }, "enterFooter+=2");
        this.introTL.call(function () {
            _$.ui.footer.menu.find(".footer_menu-homeBtn").addClass("is--active");
        }, [], null, "enterFooter+=3");
        this.introTL.call(() => {
            $(window).off("click touchstart", skipIntro.bind(this));
            _$.events.off("gamepad", skipIntro, this);
            _$.events.trigger("startUserEvents");
            _$.events.trigger("initialized");
        });

        logoPaths.forEach(logoPath => {
            let dummyObject = { value: 0 };

            logoTl.to(dummyObject, 8, {
                value    : logoPath.pathLength,
                onUpdate : () => {
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
        tl.call(() => { _$.audio.audioEngine.playSFX("titleLogo"); });
        tl.from(this.$(".title_logo"), this.transitionSettings.slides, { opacity : 0, scale: 1.25, clearProps: "all" });
        tl.from(this.$(".title_startBtn"), this.transitionSettings.slides, { opacity : 0, scale: 1.25, clearProps: "all" });
        tl.addLabel("enterFooter", `-=${this.transitionSettings.slides * 2}`);
        tl.add(_$.ui.footer.toggleMenu("show"), "enterFooter");
        tl.add(_$.ui.footer.toggleSocial("show"), `enterFooter+=${this.transitionSettings.slides}`);
        tl.set(_$.ui.footer.text, { clearProps: "display" }, `enterFooter+=${this.transitionSettings.slides * 4}`);
        tl.to(_$.ui.footer.text, this.transitionSettings.longScroll, { opacity: 1, x: 0, clearProps: "all" }, `enterFooter+=${this.transitionSettings.slides * 4}`);
        tl.from(this.$(".title_account"), this.transitionSettings.slides, { opacity: 0, x: 20, clearProps: "all" }, `enterFooter+=${this.transitionSettings.slides * 5}`);
        tl.call(() => {
            _$.ui.footer.menu.find(".footer_menu-homeBtn").addClass("is--active");
        }, [], null, `enterFooter+=${this.transitionSettings.slides * 6}`);
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
        this.checkBGMCrossfade(nextScreen);

        var tl = new TimelineMax();
        tl.call(() => {
            _$.audio.audioEngine.playSFX("titleStart");
            _$.ui.footer.menu.find(".footer_menu-element").removeClass("is--active");
        });

        tl.to(this.$(".title_account"), this.transitionSettings.slides, { opacity: 0, x: 20 }, 0);
        tl.to(this.$(".title_startBtn"), this.transitionSettings.slides, { opacity: 0, scale: 1.25 }, 0);
        tl.to(this.$(".title_logo"), this.transitionSettings.slides * 1.5, { opacity: 0, scale: 1.25 }, this.transitionSettings.slides);
        tl.call(() => { _$.audio.audioEngine.playSFX("titleLogo"); }, [], null, this.transitionSettings.slides);
        tl.add(this.checkFooterUpdate(nextScreen), 0);
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
        tl.call(() => { this.$(overlaySelector + "-confirmBtn," + overlaySelector + "-closeBtn").slideDown(this.transitionSettings.slides * 1000); }, [], null, `+=${this.transitionSettings.slides * 2}`);
        if (overlayName === "login") {
            tl.from(this.$(".title_overlay-login-forgotPwd"), this.transitionSettings.slides, { opacity: 0, y: 20, clearProps: "all" }, `+=${this.transitionSettings.staggers * 2}`);
        }
        tl.call(() => {
            _$.events.trigger("startUserEvents");
            overlay.find("input").eq(0).focus();
        });
    }

    function closeOverlay (overlayName) {
        _$.events.trigger("stopUserEvents");
        var overlaySelector = ".title_overlay-" + overlayName;
        var overlay         = this.$(overlaySelector);

        var tl = new TimelineMax();
        if (overlayName === "login") {
            tl.to(this.$(".title_overlay-login-forgotPwd"), this.transitionSettings.slides, { opacity: 0, y: 20 });
        }
        tl.call(() => {
            this.$(overlaySelector + "-confirmBtn," + overlaySelector + "-closeBtn").slideUp(this.transitionSettings.slides * 1000);
            this.$(overlaySelector + " input").blur();
        }, [], null, `-=${this.transitionSettings.staggers * 2}`);
        tl.call(() => { overlay.removeClass("is--active"); }, [], null, `+=${this.transitionSettings.slides}`);
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
        }, [], null, `+=${this.transitionSettings.slides * 2}`);
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
            _$.events.once(_$.audio.audioEngine.getBGM("bgm.win").events.ended, () => {
                _$.audio.audioEngine.currentBGM.rampToVolume({ to: _$.audio.audioEngine.currentBGM.defaultVolume, duration: 1 });
            });
            _$.audio.audioEngine.currentBGM.rampToVolume({ to: "-=0.75", duration: this.transitionSettings.slides });
            _$.audio.audioEngine.playBGM({ name: "bgm.win" });
            _$.audio.audioEngine.playSFX("gameGain");

            this.$(".title_overlay-signup-confirmBtn").text("Success!");
            this.$(".title_overlay-signup-message").text("Thank you! A confirmation mail was sent to " + data.email);
            this.$(".title_overlay-signup-confirmBtn, .title_overlay-signup-closeBtn").slideUp(this.transitionSettings.slides * 1000);
            setTimeout(() => { this.$(".title_overlay-signup-closeBtn").slideDown(this.transitionSettings.slides * 1000); }, 1000);

            this.signedUp = true;
        }).catch((error) => {
            var errorString = _.map(_.omit(error.validationErrors, "confirmPassword"), error => error.join(". ")).join("<br>");
            errorString = errorString.replace("username", "login").replace("Username", "Login");

            _$.audio.audioEngine.playSFX("uiError");
            this.$(".title_overlay-signup-confirmBtn").text("Error");
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
            _$.audio.audioEngine.playSFX("login");
            _$.audio.audioEngine.playSFX("gameGain", { delay: 0.1 });
            this.$(".title_overlay-login-confirmBtn").text("Success!");
        }).catch((error) => {
            _$.audio.audioEngine.playSFX("uiError");
            this.$(".title_overlay-login-confirmBtn").text("Error");
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

        this.$(".title_overlay-login-form .field-password input").val("");
        this.$(".title_overlay-login-form-field-input").removeClass("is--invalid");

        var tl = new TimelineMax();
        tl.to(this.$(".title_overlay-login-message, .title_overlay-login-forgotPwd, .title_overlay-login-confirmBtn"), this.transitionSettings.slides, { opacity: 0 });
        tl.to(this.$(".title_overlay-login-form " + fromField), this.transitionSettings.staggers * 2, { opacity: 0, x: fromPos }, 0);
        tl.set(this.$(".title_overlay-login-form " + fromField), { display:"none", clearProps:"opacity, x" });
        tl.set(this.$(".title_overlay-login-form " + toField), { clearProps:"display, x" });
        tl.from(this.$(".title_overlay-login-form " + toField), this.transitionSettings.staggers * 2, { opacity: 0, x: toPos, clearProps:"all" });
        tl.call(() => {
            this.$(".title_overlay-login-message").text(messageTxt);
            this.$(".title_overlay-login-forgotPwd").text(forgotPwdTxt);
            this.$(".title_overlay-login-confirmBtn").text(confirmBtnTxt);
        });
        tl.to(this.$(".title_overlay-login-message, .title_overlay-login-forgotPwd, .title_overlay-login-confirmBtn"), this.transitionSettings.slides, { opacity: 1, clearProps:"opacity" });
        tl.call(() => { _$.events.trigger("startUserEvents"); });
    }

    function sendPasswordMail () {
        this.$(".title_overlay-login-form-field-input").removeClass("is--invalid");
        this.$(".title_overlay-login-confirmBtn").text("Sending mail...");
        var userId = this.$(".title_overlay-login-form .field-login input").val();
        var email  = this.$(".title_overlay-login-form .field-email input").val();

        if (email || userId) {
            _$.comm.sessionManager.forgotPassword(email, userId).then((response) => {
                _$.audio.audioEngine.playSFX("gameGain");
                this.$(".title_overlay-login-confirmBtn").text("Success!");
                this.$(".title_overlay-login-message").text("Password recovery email sent to " + response.email + ".");
            }).catch((error) => {
                onError.call(this, error.message || error.error);
            });
        }

        function onError (message) {
            _$.audio.audioEngine.playSFX("uiError");
            this.$(".title_overlay-login-confirmBtn").text("Error");
            setTimeout(() => { this.$(".title_overlay-login-confirmBtn").text("Send"); }, 1000);

            this.$(".title_overlay-login-form-field-input").addClass("is--invalid");
            this.$(".title_overlay-login-message").text(message);
        }

        return false;
    }

    function doPasswordReset () {
      _$.app.track("send", "event", {
          eventCategory : "accountEvent",
          eventAction   : "passwordReset",
          dimension1    : _$.state.user.get("difficulty"),
          metric0       : _$.state.user.get("album").length,
          metric1       : JSON.stringify(_$.state.user.get("gameStats"))
      });

      this.$(".title_overlay-passwordReset-form-field-input").removeClass("is--invalid");
      this.$(".title_overlay-passwordReset-message").text("");
      this.$(".title_overlay-passwordReset-confirmBtn").text("Resetting...");

      _$.comm.sessionManager.resetPassword({
          token: this.resetToken,
          password: this.$(".title_overlay-passwordReset-form .field-password input").val(),
          confirmPassword: this.$(".title_overlay-passwordReset-form .field-confirmPassword input").val()
      }).then((session) => {
          _$.audio.audioEngine.playSFX("gameGain");
          this.$(".title_overlay-passwordReset-confirmBtn").text("Success!");
          this.$(".title_overlay-passwordReset-message").text("Password successfully reset!");
          this.$(".title_overlay-passwordReset-confirmBtn, .title_overlay-passwordReset-closeBtn").slideUp(this.transitionSettings.slides * 1000);
          setTimeout(() => { this.$(".title_overlay-passwordReset-closeBtn").slideDown(this.transitionSettings.slides * 1000); }, 1000);

          this.resetToken = null;
      }).catch((error) => {
          var errors = error.validationErrors.token ? { ...error.validationErrors, token: ["Invalid token"] } : error.validationErrors;
          var errorString = _.map(errors, error => error.join(". ")).join("<br>");

          _$.audio.audioEngine.playSFX("uiError");
          this.$(".title_overlay-passwordReset-confirmBtn").text("Error");
          setTimeout(() => { this.$(".title_overlay-passwordReset-confirmBtn").text("Reset"); }, 1000);

          if (_.has(error.validationErrors, "password")) {
              this.$(".title_overlay-passwordReset-form .field-password input").addClass("is--invalid");
          }

          if (_.has(error.validationErrors, "confirmPassword")) {
              this.$(".title_overlay-passwordReset-form .field-confirmPassword input").addClass("is--invalid");
          }

          this.$(".title_overlay-passwordReset-message").html(errorString);
      });

      return false;
    }

    function resetPassword (token) {
      this.resetToken = token;
      this.openOverlay("passwordReset");
    }

    function updateAccountLayout () {
        var accountLayout = $(this.accountTemplate({
            isLoggedIn : !!_$.state.user.get("userId"),
            userName   : _$.state.user.get("name")
        }));

        if (this.$(".title_account").length) {
            var tl = new TimelineMax();
            tl.to(this.$(".title_account"), this.transitionSettings.slides, { opacity: 0, x: 20 });
            tl.call(() => {
                _$.utils.addDomObserver(this.$(".title_account"), proceed.bind(this), true, "remove");
                this.$(".title_account").remove();
            });
        } else {
            proceed.call(this);
        }

        function proceed () {
            _$.utils.addDomObserver(accountLayout, () => {
                TweenMax.from(this.$(".title_account"), this.transitionSettings.slides, { opacity: 0, x: 20, clearProps: "all" });
            }, true);

            _$.comm.socketManager.emit("getOnlineCount", null, (data) => {
                this.$(".title_account-info-playerCount-onlineCount").text(data.msg);
            });

            _$.comm.socketManager.emit("getLoungeCount", null, (data) => {
                this.$(".title_account-info-playerCount-loungeCount").text(data.msg);
            });
            this.$el.append(accountLayout);
        }
    }
});
