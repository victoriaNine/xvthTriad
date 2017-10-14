# The Fifteenth Triad

A browser game based on Final Fantasy VIII's "Triple Triad" card game and set in the universe of the franchise's 15th installment.
Sandbox personal project (concept, development, design & audio). My goal was to try out technologies I hadn't used before (the entire back-end side, with the exception of Express), learn to work with a tooling stack different from my day-to-day one, and experiment with both familiar and unfamiliar front-end technologies.

Features:
- Player account creation
- Solo mode (vs computer AI)
- Versus mode (vs player)
- Multiplayer mode (online network)
- Persistence layers: the player can load and export their data in the LocalStorage from a generated encrypted save file or a database
- A nice UI
- Gamepad support (with the Gamepad API)
*Update: Dropped as it doesn't enhance the UX. Partial support is still available.*

## Technologies used
### Heavy-lifting
- [Backbone](http://backbonejs.org)
- [Webpack](https://webpack.js.org)
- ~~[Grunt](https://gruntjs.com/)~~ Formerly
- ~~[RequireJS](http://requirejs.org/)~~ Formerly

### Front-end
- [GSAP](https://greensock.com/gsap)
- [SASS](sass-lang.com)
- [Seriously.JS](https://github.com/brianchirls/Seriously.js): WebGL real-time effect compositing
- [Arpad](https://github.com/PhobosRising/node-arpad): Generates ELO scores for the leaderboards
- [flag-icon](https://github.com/lipis/flag-icon-css): For user profile flags
- [FontAwesome](http://fontawesome.io/)
- Localstorage: Persistence layer for the user's data (non-registered player)
- Canvas API: Background visuals compositing
- WebAudio API: Used with a simple, custom audio engine with separate channels for music, sound effects and notifications
- Gamepad API: Allows control of the UI with a PlayStation or XBox USB controller

### Back-end
- [Express](https://expressjs.com)
- [Socket.io](https://socket.io): Allows real-time gameplay and discussion with other players
- [Superlogin](https://github.com/colinskow/superlogin): Manages user accounts and sessions
- [cron](https://github.com/kelektiv/node-cron): Updates the leaderboards automatically at regular intervals
- [pouchdb](https://pouchdb.com): Persistence layer for the players' data (registered players)

### Helpers
- [lodash](https://lodash.com)
- [moment.js](https://momentjs.com) to setup the Cron jobs server-side
- [Modernizr](https://modernizr.com)

### Others
- Photoshop: Design
- Cubase: Audio
