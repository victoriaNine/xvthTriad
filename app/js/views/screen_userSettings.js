define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "views/screen",
    "collections/coll_album",
    "text!templates/templ_userSettings.ejs"
], function Screen_UserSettings ($, _, Backbone, _$, Screen, Coll_Album, Templ_UserSettings) {
    return Screen.extend({
        id        : "screen_userSettings",

        // Our template for the line of statistics at the bottom of the app.
        template  : _.template(Templ_UserSettings),

        // Delegated events for creating new items, and clearing completed ones.
        events    : {
            "click .userSettings_content-save-choice-saveBtn"    : "saveGame",
            "click .userSettings_content-save-choice-cancelBtn"  : "resetChanges",
            "click .userSettings_content-save-choice-exportBtn"  : "exportSaveFile",
            "click .userSettings_content-save-choice-resetAlbumBtn" : function () {
                this.confirmAction = this.resetAlbum;
                this.toggleConfirm("show");
            },
            "click .userSettings_content-save-choice-deleteAccountBtn" : function () {
                this.confirmAction = this.deleteAccount;
                this.toggleConfirm("show");
            },
            "click .userSettings_content-save-choice-backBtn"    : function () { this.transitionOut("title"); },
            "click .userSettings_content-load-choice-loadBtn"    : "loadGame",
            "click .userSettings_content-load-choice-cancelBtn"  : function () {
                this.$(".setting-import input").val("");
                this.toggleLoad("hide");
            },
            "click .userSettings_content-confirm-choice-confirmBtn" : function () { this.confirmAction(); },
            "click .userSettings_content-confirm-choice-cancelBtn"  : function () {this.toggleConfirm("hide"); },
            "keyup .setting-name input,.setting-email input,.setting-newPassword input,.setting-confirmPassword input" : _.debounce(function (e) { this.validateInput(e.target); }, 250),
            "change .setting-avatar input,.setting-import input"    : function (e) { this.validateInput(e.target); },
            "change .setting-bgm input,.setting-sfx input"          : "updateVolume",
            "input .setting-bgm input,.setting-sfx input"           : "updateVolume",
            "mouseenter .userSettings_content-save-choice-element,.userSettings_content-load-choice-element,.userSettings_content-confirm-choice-element" : function () {
                _$.audio.audioEngine.playSFX("uiHover");
            },
            "click .userSettings_content-save-choice-element,.userSettings_content-load-choice-element,.userSettings_content-confirm-choice-element,.setting-difficulty,.setting-placingMode,.setting-avatar,.setting-import" : function () {
                _$.audio.audioEngine.playSFX("uiConfirm");
            },
            "focus .setting-name input,.setting-email input,.setting-newPassword input,.setting-confirmPassword input" : function () {
                _$.audio.audioEngine.playSFX("uiInput");
            },
            "click .setting-import .userSettings_content-settings-setting-label" : function () {
                this.$(".setting-import input").val("");
                this.toggleLoad("hide");
                this.validateInput(this.$(".setting-import input")[0]);
            },
            "click .setting-avatar .userSettings_content-settings-setting-label" : function () {
                this.$(".setting-avatar input").val("");
                this.validateInput(this.$(".setting-avatar input")[0]);
            }
        },

        initialize,
        remove,

        toggleLoad,
        toggleConfirm,

        saveGame,
        resetChanges,
        loadGame,
        exportSaveFile,
        resetAlbum,
        deleteAccount,
        updateVolume,

        transitionIn,
        transitionOut,
        validateInput
    });

    function initialize (options) {
        this.$el.html(this.template({
            isLoggedIn : _$.comm.sessionManager.getSession(),
            userName   : _$.state.user.get("name"),
            email      : _$.state.user.get("email"),
            avatarSrc  : _$.state.user.get("avatar"),
            wonCount   : _$.state.user.get("gameStats").won,
            lostCount  : _$.state.user.get("gameStats").lost,
            drawCount  : _$.state.user.get("gameStats").draw,
            bgmVolume  : Math.floor(_$.audio.audioEngine.channels.bgm.volume * 100),
            sfxVolume  : Math.floor(_$.audio.audioEngine.channels.sfx.volume * 100)
        }));

        this.difficultyDropdown  = null;
        this.placingModeDropdown = null;
        this.confirmAction       = null;

        _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
        this.add();
    }

    function remove () {
        Screen.prototype.remove.call(this);
        this.difficultyDropdown.remove();
        this.placingModeDropdown.remove();
    }

    function saveGame () {
        var settings = {};
        var difficultySetting;
        var placingModeSetting;

        settings.name          = this.$(".setting-name input").val().trim();
        settings.avatar        = this.$(".setting-avatar input")[0].files[0];
        settings.email         = this.$(".setting-email input").val().trim();

        difficultySetting      = this.difficultyDropdown.currentOption[0].className.replace("difficultySetting-", "");
        settings.difficulty    = difficultySetting;
        placingModeSetting     = this.placingModeDropdown.currentOption[0].className.replace("placingModeSetting-", "");
        settings.placingMode   = placingModeSetting;

        settings.bgmVolume     = this.$(".setting-bgm input").val() / 100;
        settings.sfxVolume     = this.$(".setting-sfx input").val() / 100;

        this.$(".userSettings_header-help").text("");

        if (settings.avatar) {
            var url = URL.createObjectURL(settings.avatar);
            _$.utils.getBase64Image(url, (base64URL) => {
                _$.state.user.set({ avatar: base64URL });
                this.$(".userSettings_header-avatar-img").css("backgroundImage", "url(" + base64URL + ")");
                proceed.call(this);
            });
        } else {
            proceed.call(this);
        }

        function proceed () {
            _$.state.user.set({
                name        : settings.name,
                difficulty  : settings.difficulty,
                placingMode : settings.placingMode,
                bgmVolume   : settings.bgmVolume,
                sfxVolume   : settings.sfxVolume
            });
            
            _$.app.track("set", {
                "dimension0" : "difficulty",
                "dimension1" : "placingMode",
                "metric0"    : "albumSize",
                "metric1"    : "gameStats"
            });

            _$.app.track("send", "event", {
                eventCategory : "userSettingsEvent",
                eventAction   : "saveGame",
                dimension0    : _$.state.user.get("difficulty"),
                dimension1    : _$.state.user.get("placingMode"),
                metric0       : _$.state.user.get("album").length,
                metric1       : JSON.stringify(_$.state.user.get("gameStats"))
            });
            
            _$.events.on("userDataSaved", () => {
                _$.audio.audioEngine.playSFX("gameGain");
                this.$(".userSettings_header-help").text("Changes saved!");

                if (_$.comm.sessionManager.getSession()) {
                    _$.state.user.set("email", settings.email);
                }
            });

            if (_$.comm.sessionManager.getSession()) {
                var accountData = {
                    currentPassword : this.$(".setting-currentPassword input").val().trim(),
                    newPassword     : this.$(".setting-newPassword input").val().trim(),
                    confirmPassword : this.$(".setting-confirmPassword input").val().trim(),
                    newEmail        : settings.email
                };

                if (!accountData.newPassword) {
                    delete accountData.password;
                    delete accountData.newPassword;
                    delete accountData.confirmPassword;

                    this.$(".setting-currentPassword input, setting-confirmPassword input").val("");
                }

                if (accountData.newEmail === _$.state.user.get("email")) {
                    delete accountData.newEmail;
                }

                _$.app.saveData(accountData, (error) => {
                    this.$(".userSettings_header-help").text(error.message || error.error);
                });
            } else {
                _$.app.saveData();
            }
        }
    }

    function resetChanges () {
        this.$(".setting-name input").val(_$.state.user.get("name"));
        this.$(".setting-email input").val(_$.state.user.get("email"));
        this.$(".setting-avatar input, .setting-import input").val("");
        this.$(".setting-bgm input").val(_$.state.user.get("bgmVolume") * 100).change();
        this.$(".setting-sfx input").val(_$.state.user.get("sfxVolume") * 100).change();
        this.difficultyDropdown.reset();
        this.placingModeDropdown.reset();
    }

    function loadGame () {
        if (!_$.debug.debugMode) {
            _$.app.track("send", "event", {
                eventCategory : "userSettingsEvent",
                eventAction   : "loadGame"
            });
        }

        var file = this.$(".setting-import input")[0].files[0];
        _$.app.importSave(file, () => {
            _$.audio.audioEngine.stopBGM({ fadeDuration: 1 });
            TweenMax.to(_$.dom, 1, { opacity: 0,
                onComplete: () => {
                    if (_$.audio.audioEngine.currentBGM.getState() === "ended") {
                        proceed.call(this);
                    } else {
                        _$.events.once("bgmEnded", proceed.bind(this));
                    }
                }
            });

            function proceed () {
                this.transitionOut("title", { fullIntro: true });
            }
        });
    }

    function exportSaveFile () {
        _$.app.track("set", {
            "dimension0" : "difficulty",
            "metric0"    : "albumSize",
            "metric1"    : "gameStats"
        });
        _$.app.track("send", "event", {
            eventCategory : "userSettingsEvent",
            eventAction   : "exportSaveFile",
            dimension0    : _$.state.user.get("difficulty"),               // difficulty
            metric0       : _$.state.user.get("album").length,             // albumSize
            metric1       : JSON.stringify(_$.state.user.get("gameStats")) // gameStats
        });

        _$.app.exportSave();
    }

    function resetAlbum () {
        _$.app.track("set", {
            "dimension0" : "difficulty",
            "metric0"    : "albumSize",
            "metric1"    : "gameStats"
        });
        _$.app.track("send", "event", {
            eventCategory : "userSettingsEvent",
            eventAction   : "resetAlbum",
            dimension0    : _$.state.user.get("difficulty"),               // difficulty
            metric0       : _$.state.user.get("album").length,             // albumSize
            metric1       : JSON.stringify(_$.state.user.get("gameStats")) // gameStats
        });

        this.confirmAction = null;
        this.toggleConfirm("hide");
        _$.state.user.set("album", new Coll_Album());

        _$.events.on("userDataSaved", () => {
            _$.audio.audioEngine.playSFX("gameGain");
            this.$(".userSettings_header-help").text("Card album reset.");
            _$.events.trigger("startUserEvents");
        });

        _$.events.trigger("stopUserEvents");
        _$.app.saveData();
    }

    function deleteAccount () {
        _$.app.track("set", {
            "dimension0" : "difficulty",
            "metric0"    : "albumSize",
            "metric1"    : "gameStats"
        });
        _$.app.track("send", "event", {
            eventCategory : "userSettingsEvent",
            eventAction   : "deleteAccount",
            dimension0    : _$.state.user.get("difficulty"),
            metric0       : _$.state.user.get("album").length,
            metric1       : JSON.stringify(_$.state.user.get("gameStats"))
        });

        this.confirmAction = null;
        this.toggleConfirm("hide");

        _$.events.once("initialized", () => {
            _$.audio.audioEngine.playSFX("gameGain");
            _$.ui.screen.info(null, {
                titleBold    : "Account",
                titleRegular : "deleted",
                msg          : "Thanks for playing The Fifteenth Triad!"
            });
        });

        setTimeout(() => {
            if (_$.comm.sessionManager.getSession()) {
                _$.comm.sessionManager.removeUser();
            } else {
                window.localStorage.removeItem(_$.app.name);
                _$.audio.audioEngine.stopBGM({ fadeDuration: 1 });
                TweenMax.to(_$.dom, 1, { opacity: 0,
                    onComplete: () => {
                        if (_$.audio.audioEngine.currentBGM.getState() === "ended") {
                            proceed.call(this);
                        } else {
                            _$.events.once("bgmEnded", proceed.bind(this));
                        }
                    }
                });
            }
        }, 400);

        function proceed () {
            this.transitionOut("title", { setup: true, fullIntro: true });
        }
    }

    function updateVolume (event) {
        var id    = event.target.id;
        var value = event.target.value;
        
        if (id === "bgmVolume") {
            _$.audio.audioEngine.channels.bgm.setVolume(value / 100);
        } else if (id === "sfxVolume") {
            _$.audio.audioEngine.channels.sfx.setVolume(value / 100);
            if (event.type === "change") {
                _$.audio.audioEngine.playSFX("cardFlip");
            }
        }

        this.$("label[for=\"" + id + "\"]").html(value);
    }

    function transitionIn () {
        _$.events.trigger("stopUserEvents");
        this.difficultyDropdown = this.createDropdown({
            selector              : ".setting-difficulty",
            dropdownSelector      : ".userSettings_content-settings-setting-select",
            defaultOptionSelector : ".difficultySetting-" + _$.state.user.get("difficulty")
        });


        this.placingModeDropdown = this.createDropdown({
            selector              : ".setting-placingMode",
            dropdownSelector      : ".userSettings_content-settings-setting-select",
            defaultOptionSelector : ".placingModeSetting-" + _$.state.user.get("placingMode")
        });

        this.resetChanges();

        var tl = new TimelineMax();
        tl.set(this.$(".userSettings_content-settings"), { clearProps: "opacity" });
        tl.set(this.$(".userSettings_content-settings-setting, .userSettings_header-avatar"), { opacity: 0 });
        tl.call(() => {
            this.$(".userSettings_header").slideDown(500);
        });
        tl.to(this.$(".userSettings_header-avatar"), 0.5, { opacity: 1, clearProps:"all" }, tl.recent().endTime() + 0.5);
        tl.staggerTo(this.$(".userSettings_content-settings-setting"), 0.5, { opacity: 1, clearProps:"all" }, 0.1, tl.recent().endTime() - 0.5);
        tl.call(() => {
            this.$(".userSettings_content-save").slideDown(500);
            _$.events.trigger("startUserEvents");
        });

        return this;
    }

    function transitionOut (nextScreen, options) {
        _$.events.trigger("stopUserEvents");

        var tl = new TimelineMax();
        if (_$.ui.footer.isOpen) {
            tl.add(_$.ui.footer.toggleFooter(), 0);
        }
        tl.call(() => {
            this.$(".userSettings_content-save, .userSettings_content-load").slideUp(500);
        }, null, [], "-=1.5");
        tl.to(this.$(".userSettings_content-settings, .userSettings_header-avatar"), 0.5, { opacity: 0 }, tl.recent().endTime() + 0.5);
        tl.call(() => {
            this.$(".userSettings_header").slideUp(500);
        });
        tl.call(() => {
            this.changeScreen(nextScreen, options);
        }, null, [], tl.recent().endTime() + 0.5);

        return this;
    }

    function toggleLoad (state) {
        if (state === "show") {
            this.$(".userSettings_content-load").css({pointerEvents: ""}).slideDown();
            this.$(".userSettings_content-save").css({pointerEvents: "none"}).slideUp();
        } else if (state === "hide") {
            this.$(".userSettings_content-load").css({pointerEvents: "none"}).slideUp();
            this.$(".userSettings_content-save").css({pointerEvents: ""}).slideDown();
        }
    }

    function toggleConfirm (state) {
        if (state === "show") {
            this.$(".userSettings_content-confirm").css({pointerEvents: ""}).slideDown();
            this.$(".userSettings_content-save").css({pointerEvents: "none"}).slideUp();
        } else if (state === "hide") {
            this.$(".userSettings_content-confirm").css({pointerEvents: "none"}).slideUp();
            this.$(".userSettings_content-save").css({pointerEvents: ""}).slideDown();
        }
    }

    function validateInput (input) {
        var value = $(input).val().trim();
        var check;

        if (input === this.$(".setting-name input")[0]) {
            check = value.length;
        } else if (input === this.$(".setting-email input")[0]) {
            check = value.match(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}$/);
        } else if (input === this.$(".setting-newPassword input")[0]) {
            check = !value.length || value.length >= 6;
        }  else if (input === this.$(".setting-confirmPassword input")[0]) {
            check = value === this.$(".setting-newPassword input").val().trim();
        }  else if (input === this.$(".setting-avatar input")[0]) {
            check = !input.files.length || !!input.files[0].name.match(/\.jpg|\.jpeg|\.png|\.gif$/);
        } else if (input === this.$(".setting-import input")[0]) {
            check = !input.files.length || input.files[0].name.endsWith("." + _$.app.saveExt);
        }

        if (check) {
            if ($(input).hasClass("is--invalid")) {
                $(input).removeClass("is--invalid");
            }
        } else {
            if (!$(input).hasClass("is--invalid")) {
                $(input).addClass("is--invalid");
            }
        }

        if (this.$(".userSettings_content-settings-setting-input").hasClass("is--invalid")) {
            if (this.$(".userSettings_content-save").is(":visible")) {
                this.$(".userSettings_content-save").css({pointerEvents: "none"}).slideUp();
            }

            if (this.$(".userSettings_content-load").is(":visible")) {
                this.$(".userSettings_content-load").css({pointerEvents: "none"}).slideUp();
            }
        } else {
            if (input === $(".setting-import input")[0]) {
                if (!input.files.length && this.$(".userSettings_content-load").is(":visible")) {
                    this.toggleLoad("hide");
                } else if (input.files.length && !this.$(".userSettings_content-load").is(":visible")) {
                    this.toggleLoad("show");
                }
            } else if (!this.$(".userSettings_content-save, .userSettings_content-load, .userSettings_content-confirm").is(":visible")) {
                this.$(".userSettings_content-save").css({ pointerEvents: "" }).slideDown();
            }
        }
    }
});
