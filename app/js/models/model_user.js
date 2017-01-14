define(["underscore", "backbone", "global", "collections/coll_album"], function Model_User (_, Backbone, _$, Coll_Album) {
    return Backbone.Model.extend({
        defaults : {
            userId      : null,
            name        : null,
            email       : null,
            avatar      : null,
            album       : null,
            difficulty  : "easy",
            placingMode : "dragDrop",
            gameStats   : {
                won  : 0,
                lost : 0,
                draw : 0
            },
            bgmVolume     : 1,
            sfxVolume     : 0.5,
            notifVolume   : 0.5,
            notifyMode    : "always",
            inactiveAudio : "muteAll"
        },

        initialize,
        setup,
        setAvatarPath,
        getPlayerInfo
    });

    function initialize () {
        _$.events.once("userDataLoaded", () => {
            if (!this.get("avatar") && !this.avatarURL) {
                var avatarUrl = _$.assets.get("img.avatars.user_default").src;
                this.setAvatarPath(avatarUrl);
            }
        });
        
        this.set("album", new Coll_Album());
        this.dataLoaded = false;
        this.avatarUrl  = null;
        this.isInGame   = false;
        this.isInLounge = false;
    }

    function setup (options) {
        var name          = _$.utils.getRandomName();
        var characterName = name.match(/[^\_\d]/g).join("");
        var avatarUrl     = _$.assets.get("img.avatars.user_" + characterName.toLowerCase()).src;

        this.set({ name });
        this.setAvatarPath(avatarUrl);
        this.dataLoaded = true;

        _$.events.trigger("userDataLoaded:setup");
    }

    function setAvatarPath (url) {
        this.avatarURL = url;
        _$.utils.getBase64Image(url, (base64URL) => {
            this.set({ avatar: base64URL });
            fetch(this.get("avatar")); // Pre-load the user's avatar
        });
    }

    function getPlayerInfo () {
        return {
            userId    : this.get("userId"),
            name      : this.get("name"),
            avatar    : this.get("avatar"),
            albumSize : this.get("album").length
        };
    }
});
