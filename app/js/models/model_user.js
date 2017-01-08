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
            bgmVolume   : 1,
            sfxVolume   : 0.5
        },

        initialize,
        setup,
        setAvatarPath
    });

    function initialize () {
        var avatarUrl = _$.assets.get("img.avatars.user_default").src;
        this.setAvatarPath(avatarUrl);
        this.set("album", new Coll_Album());
        
        this.dataLoaded = false;
    }

    function setup (options) {
        var name          = _$.utils.getRandomName();
        var characterName = name.match(/[^\_\d]/g).join("");
        var avatarUrl     = _$.assets.get("img.avatars.user_" + characterName.toLowerCase()).src;

        this.set({ name });
        this.setAvatarPath(avatarUrl);
        this.dataLoaded = true;
    }

    function setAvatarPath (url) {
        _$.utils.getBase64Image(url, (base64URL) => {
            this.set({ avatar: base64URL });
            fetch(this.get("avatar")); // Pre-load the user's avatar
        });
    }
});
