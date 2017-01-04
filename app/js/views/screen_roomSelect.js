define([
    "jquery",
    "underscore", 
    "backbone",
    "global",
    "views/screen",
    "text!templates/templ_roomSelect.html"
], function Screen_RoomSelect ($, _, Backbone, _$, Screen, Templ_RoomSelect) {
    return Screen.extend({
        id        : "screen_roomSelect",

        // Our template for the line of statistics at the bottom of the app.
        template  : _.template(Templ_RoomSelect),

        // Delegated events for creating new items, and clearing completed ones.
        events    : {
            "keyup .setting-roomName input"                      : _.debounce(function (e) { this.validateInput(e.target); }, 250),
            "click .roomSelect_content-screenNav-choice-backBtn" : function () { this.transitionOut("title"); },
            "click .roomSelect_content-screenNav-choice-nextBtn" : "toNextStep",
            "blur .setting-roomName input" : function (e) {
                this.showHelp();
            },
            "mouseenter .roomSelect_content-screenNav-choice-element" : function () {
                _$.audio.audioEngine.playSFX("uiHover");
            },
            "click .roomSelect_content-screenNav-choice-element,.roomSelect_content-settings-setting" : function () {
                _$.audio.audioEngine.playSFX("uiConfirm");
            },
            "focus .setting-roomName input" : function () {
                _$.audio.audioEngine.playSFX("uiInput");
            }
        },

        initialize,
        remove,

        toNextStep,
        transitionIn,
        transitionOut,
        showHelp,
        validateInput
    });

    function initialize (options) {
        _$.ui.roomSelect  = this;
        this.settings     = null;
        this.modeDropdown = null;

        this.$el.html(this.template());
        this.showHelp();

        this.$(".roomSelect_content-screenNav-choice-backBtn").hide();
        _$.utils.addDomObserver(this.$el, this.transitionIn.bind(this), true);
        this.add();
    }

    function remove () {
        delete _$.ui.roomSelect;
        Screen.prototype.remove.call(this);
        this.modeDropdown.remove();

        if (_$.ui.rulesSelect) {
            _$.ui.rulesSelect.remove();
        }
        
        if (_$.ui.cardSelect) {
            _$.ui.cardSelect.remove();
        }
    }

    function toNextStep () {
        var settings = {};
        var modeSetting;

        settings.roomName = this.$(".setting-roomName input").val().trim();

        modeSetting       = this.modeDropdown.currentOption[0].className.replace("modeSetting-", "");
        settings.mode     = modeSetting;

        if (_$.ui.rulesSelect && this.settings &&
            this.settings.roomName === settings.roomName &&
            this.settings.mode && settings.mode) {
            proceed.call(this);
            return;
        }

        this.settings = settings;

        if (settings.mode === "create") {
            _$.comm.socketManager.emit("createRoom", settings, onResponse.bind(this));
        } else if (settings.mode === "join") {
            _$.comm.socketManager.emit("joinRoom", settings, onResponse.bind(this));
        }

        function onResponse (response) {
            if (response.type === "ok") {
                proceed.call(this);
            } else if (response.type === "error") {
                this.$(".setting-roomName input").addClass("is--invalid");
                this.$(".roomSelect_content-screenNav").css({ pointerEvents: "none" }).slideUp();
                this.showHelp(response.msg, true);
            }
        }

        function proceed () {
            _$.state.room = this.settings;
            this.transitionOut("rulesSelect", { readOnly: _$.state.room.mode === "join" });
        }
    }

    function transitionIn () {
        _$.events.trigger("stopUserEvents");
        this.modeDropdown = this.createDropdown({
            selector         : ".setting-mode",
            dropdownSelector : ".roomSelect_content-settings-setting-select",
            onUpdate         : this.validateInput.bind(this, this.$(".setting-roomName input")[0])
        });

        var tl = new TimelineMax();
        tl.set(this.$el, { clearProps: "display" });
        tl.set(this.$(".roomSelect_content-settings"), { clearProps: "opacity" });
        tl.set(this.$(".roomSelect_content-settings-setting"), { opacity: 0 });
        tl.call(() => {
            this.$(".roomSelect_header").slideDown(500);
        });
        tl.staggerTo(this.$(".roomSelect_content-settings-setting"), 0.5, { opacity: 1, clearProps:"all" }, 0.1, tl.recent().endTime() + 0.5);
        tl.call(() => {
            this.validateInput(this.$(".setting-roomName input")[0]);
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
            this.$(".roomSelect_content-screenNav").slideUp(500);
        }, null, [], "-=1.5");
        tl.to(this.$(".roomSelect_content-settings"), 0.5, { opacity: 0 }, tl.recent().endTime() + 0.5);
        tl.call(() => {
            this.$(".roomSelect_header").slideUp(500);
        });
        tl.call(() => {
            TweenMax.set(this.$el, { display: "none" });
            this.changeScreen(nextScreen, options);
        }, null, [], tl.recent().endTime() + 0.5);

        return this;
    }

    function validateInput (input) {
        var value = $(input).val().trim();
        var check;

        if (input === this.$(".setting-roomName input")[0]) {
            check = value.length && !value.match(/\W/g);
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

        if (this.$(".setting-roomName input").hasClass("is--invalid")) {
            if (this.$(".roomSelect_content-screenNav").is(":visible")) {
                this.$(".roomSelect_content-screenNav").css({ pointerEvents: "none" }).slideUp();
            }
        } else {
            if (!this.$(".roomSelect_content-screenNav").is(":visible")) {
                this.$(".roomSelect_content-screenNav").css({ pointerEvents: "" }).slideDown();
            }
        }
    }

    function showHelp (msgName, asIs) {
        var defaultMsg = "Give a name to the room you want to create, or enter the name of the room you want to join.";
        var text;

        if (!msgName) {
            text = defaultMsg;
        } else if (asIs) {
            text = msgName;
        } else {
            switch (msgName) {
                case "":
                    text = "";
                    break;
            }
        }

        this.$(".roomSelect_header-help").html(text);
    }
});
