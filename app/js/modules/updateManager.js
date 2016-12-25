define(["underscore", "global"], function updateManager (_, _$) {
    var PATCH_HISTORY = [
        { version: "0.1.0", name: "Beta", flag: "beta", patch: _.identity }
    ];

    return {
        update
    };

    function update (saveData) {
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

    function _pipe (...fns) {
        return function (x) {
            return fns.reduce(function (prev, func) {
                return func(prev);
            }, x) ;
        };
    }
});
