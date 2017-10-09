import Backbone from 'backbone';

import _$ from 'store';

export default Backbone.Model.extend({
    defaults : {
        type       : "computer",
        user       : null,
        name       : null,
        avatar     : null,
        deck       : null,
        points     : 5,
        rankPoints : 0
    }
});
