define(["underscore", "global"], function updateManager (_, _$) {
    const PATCH_HISTORY = [
        { version: "1.0.0", flag: "beta", patch: _.identity },
        { version: "1.0.1", flag: "beta", patch: patch_1_0_1 }
    ];

    class UpdateManager {
        update (saveData) {
            var saveVersion    = saveData.version;
            var updateFrom     = _.findIndex(PATCH_HISTORY, { version: saveVersion });
            var updateTo       = PATCH_HISTORY.length;
            var patchesToApply = _.slice(PATCH_HISTORY, updateFrom, updateTo);

            if (!patchesToApply.length) {
                return saveData;
            } else {
                var patchFns = _.map(patchesToApply, "patch");
                return _pipe(...patchFns)(saveData);
            }
        }
    }

    function _pipe (...fns) {
        return function (x) {
            return fns.reduce(function (prev, func) {
                return func(prev);
            }, x) ;
        };
    }

    function patch_1_0_1 (userData) {
        userData.placingMode = "dragDrop";
        return userData;
    }

    return UpdateManager;
});
