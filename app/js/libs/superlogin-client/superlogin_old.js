(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(["axios", "eventemitter2", "global"], factory) :
    (global.Superlogin = factory());
}(this, function () {
    'use strict';

    /*Object.defineProperty(exports, "__esModule", {
        value: true
    });*/

    var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

    var _axios = require('axios');

    var _axios2 = _interopRequireDefault(_axios);

    /*var _debug2 = require('debug');

    var _debug3 = _interopRequireDefault(_debug2);*/

    var _eventemitter = require('eventemitter2');

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

    function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

    var _$ = require("global");
    var debug = {
        log: _$.debug.log.bind(null, 'superlogin:log'),
        info: _$.debug.log.bind(null, 'superlogin:info'),
        warn: _$.debug.warn.bind(null, 'superlogin:warn'),
        error: _$.debug.error.bind(null, 'superlogin:error')
    };

    // Capitalizes the first letter of a string
    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    function checkEndpoint(url, endpoints) {
        var parser = window.document.createElement('a');
        parser.href = url;
        for (var i = 0; i < endpoints.length; i += 1) {
            if (parser.host === endpoints[i]) {
                return true;
            }
        }
        return false;
    }

    function parseError(err) {
        // if no connection can be established we don't have any data thus we need to forward the original error.
        if (err && err.response && err.response.data) {
            return err.response.data;
        }
        return err;
    }

    var Superlogin = function (_EventEmitter) {
        _inherits(Superlogin, _EventEmitter);

        function Superlogin() {
            _classCallCheck(this, Superlogin);

            var _this = _possibleConstructorReturn(this, (Superlogin.__proto__ || Object.getPrototypeOf(Superlogin)).call(this));

            _this._oauthComplete = false;
            _this._config = {};
            _this._refreshInProgress = false;
            _this._http = _axios2.default.create();
            return _this;
        }

        _createClass(Superlogin, [{
            key: 'configure',
            value: function configure() {
                var _this2 = this;

                var config = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

                config.baseUrl = config.baseUrl || '/auth';
                config.baseUrl = config.baseUrl.replace(/\/$/, ''); // remove trailing /
                if (!config.endpoints || !(config.endpoints instanceof Array)) {
                    config.endpoints = [];
                }
                if (!config.noDefaultEndpoint) {
                    config.endpoints.push(window.location.host);
                }
                config.providers = config.providers || [];

                if (config.storage === 'session') {
                    this.storage = window.sessionStorage;
                } else {
                    this.storage = window.localStorage;
                }

                this._config = config;

                // Setup the new session
                this._session = JSON.parse(this.storage.getItem('superlogin.session'));

                this._httpInterceptor();

                // Check expired
                if (config.checkExpired) {
                    this.checkExpired();
                    this.validateSession().then(function () {
                        _this2._onLogin(_this2._session);
                    }).catch(function () {
                        // ignoring
                    });
                }
            }
        }, {
            key: '_httpInterceptor',
            value: function _httpInterceptor() {
                var _this3 = this;

                var request = function request(req) {
                    var config = _this3.getConfig();
                    var session = _this3.getSession();
                    if (!session || !session.token) {
                        return Promise.resolve(req);
                    }

                    if (req.skipRefresh) {
                        return Promise.resolve(req);
                    }

                    return _this3.checkRefresh().then(function () {
                        if (checkEndpoint(req.url, config.endpoints)) {
                            req.headers.Authorization = 'Bearer ' + session.token + ':' + session.password;
                        }
                        return req;
                    });
                };

                var responseError = function responseError(error) {
                    var config = _this3.getConfig();

                    // if there is not config obj in in the error it means we cannot check the endpoints.
                    // This happens for example if there is no connection at all because axion just forwards the raw error.
                    if (!error || !error.config) {
                        return Promise.reject(error);
                    }

                    // If there is an unauthorized error from one of our endpoints and we are logged in...
                    if (checkEndpoint(error.config.url, config.endpoints) && error.response.status === 401 && _this3.authenticated()) {
                        debug.warn('Not authorized');
                        _this3._onLogout('Session expired');
                    }
                    return Promise.reject(error);
                };
                // clear interceptors from a previous configure call
                this._http.interceptors.request.eject(this._httpRequestInterceptor);
                this._http.interceptors.response.eject(this._httpResponseInterceptor);

                this._httpRequestInterceptor = this._http.interceptors.request.use(request.bind(this));
                this._httpResponseInterceptor = this._http.interceptors.response.use(null, responseError.bind(this));
            }
        }, {
            key: 'authenticated',
            value: function authenticated() {
                return !!(this._session && this._session.user_id);
            }
        }, {
            key: 'getConfig',
            value: function getConfig() {
                return this._config;
            }
        }, {
            key: 'validateSession',
            value: function validateSession() {
                var _this4 = this;

                if (!this.authenticated()) {
                    return Promise.reject();
                }
                return this._http.get(this._config.baseUrl + '/session').catch(function (err) {
                    _this4._onLogout('Session expired');
                    throw parseError(err);
                });
            }
        }, {
            key: 'getSession',
            value: function getSession() {
                if (!this._session) {
                    console.log(this);
                    this._session = JSON.parse(this.storage.getItem('superlogin.session'));
                }
                return this._session ? Object.assign(this._session) : null;
            }
        }, {
            key: 'setSession',
            value: function setSession(session) {
                this._session = session;
                this.storage.setItem('superlogin.session', JSON.stringify(this._session));
                debug.info('New session set');
            }
        }, {
            key: 'deleteSession',
            value: function deleteSession() {
                this.storage.removeItem('superlogin.session');
                this._session = null;
            }
        }, {
            key: 'getDbUrl',
            value: function getDbUrl(dbName) {
                if (this._session.userDBs && this._session.userDBs[dbName]) {
                    return this._session.userDBs[dbName];
                }
                return null;
            }
        }, {
            key: 'getHttp',
            value: function getHttp() {
                return this._http;
            }
        }, {
            key: 'confirmRole',
            value: function confirmRole(role) {
                if (!this._session || !this._session.roles || !this._session.roles.length) return false;
                return this._session.roles.indexOf(role) !== -1;
            }
        }, {
            key: 'confirmAnyRole',
            value: function confirmAnyRole(roles) {
                if (!this._session || !this._session.roles || !this._session.roles.length) return false;
                for (var i = 0; i < roles.length; i += 1) {
                    if (this._session.roles.indexOf(roles[i]) !== -1) return true;
                }
                return false;
            }
        }, {
            key: 'confirmAllRoles',
            value: function confirmAllRoles(roles) {
                if (!this._session || !this._session.roles || !this._session.roles.length) return false;
                for (var i = 0; i < roles.length; i += 1) {
                    if (this._session.roles.indexOf(roles[i]) === -1) return false;
                }
                return true;
            }
        }, {
            key: 'checkRefresh',
            value: function checkRefresh() {
                // Get out if we are not authenticated or a refresh is already in progress
                if (this._refreshInProgress) {
                    return Promise.resolve();
                }
                if (!this._session || !this._session.user_id) {
                    return Promise.reject();
                }
                var issued = this._session.issued;
                var expires = this._session.expires;
                var threshold = isNaN(this._config.refreshThreshold) ? 0.5 : this._config.refreshThreshold;
                var duration = expires - issued;
                var timeDiff = this._session.serverTimeDiff || 0;
                if (Math.abs(timeDiff) < 5000) {
                    timeDiff = 0;
                }
                var estimatedServerTime = Date.now() + timeDiff;
                var elapsed = estimatedServerTime - issued;
                var ratio = elapsed / duration;
                if (ratio > threshold) {
                    debug.info('Refreshing session');
                    return this.refresh().then(function (session) {
                        debug.log('Refreshing session sucess', session);
                        return session;
                    }).catch(function (err) {
                        debug.error('Refreshing session failed', err);
                        throw err;
                    });
                }
                return Promise.resolve();
            }
        }, {
            key: 'checkExpired',
            value: function checkExpired() {
                // This is not necessary if we are not authenticated
                if (!this.authenticated()) {
                    return;
                }
                var expires = this._session.expires;
                var timeDiff = this._session.serverTimeDiff || 0;
                // Only compensate for time difference if it is greater than 5 seconds
                if (Math.abs(timeDiff) < 5000) {
                    timeDiff = 0;
                }
                var estimatedServerTime = Date.now() + timeDiff;
                if (estimatedServerTime > expires) {
                    this._onLogout('Session expired');
                }
            }
        }, {
            key: 'refresh',
            value: function refresh() {
                var _this5 = this;

                var session = this.getSession();
                this._refreshInProgress = true;
                return this._http.post(this._config.baseUrl + '/refresh', {}).then(function (res) {
                    _this5._refreshInProgress = false;
                    if (res.data.token && res.data.expires) {
                        Object.assign(session, res.data);
                        _this5.setSession(session);
                        _this5._onRefresh(session);
                    }
                    return session;
                }).catch(function (err) {
                    _this5._refreshInProgress = false;
                    throw parseError(err);
                });
            }
        }, {
            key: 'authenticate',
            value: function authenticate() {
                var _this6 = this;

                return new Promise(function (resolve) {
                    var session = _this6.getSession();
                    if (session) {
                        resolve(session);
                    } else {
                        _this6.on('login', function (newSession) {
                            resolve(newSession);
                        });
                    }
                });
            }
        }, {
            key: 'login',
            value: function login(credentials) {
                var _this7 = this;

                if (!credentials.username || !credentials.password) {
                    return Promise.reject({ error: 'Username or Password missing...' });
                }
                return this._http.post(this._config.baseUrl + '/login', credentials, { skipRefresh: true }).then(function (res) {
                    res.data.serverTimeDiff = res.data.issued - Date.now();
                    _this7.setSession(res.data);
                    _this7._onLogin(res.data);
                    return res.data;
                }).catch(function (err) {
                    _this7.deleteSession();

                    throw parseError(err);
                });
            }
        }, {
            key: 'register',
            value: function register(registration) {
                var _this8 = this;

                return this._http.post(this._config.baseUrl + '/register', registration, { skipRefresh: true }).then(function (res) {
                    if (res.data.user_id && res.data.token) {
                        res.data.serverTimeDiff = res.data.issued - Date.now();
                        _this8.setSession(res.data);
                        _this8._onLogin(res.data);
                    }
                    _this8._onRegister(registration);
                    return res.data;
                }).catch(function (err) {
                    throw parseError(err);
                });
            }
        }, {
            key: 'logout',
            value: function logout(msg) {
                var _this9 = this;

                return this._http.post(this._config.baseUrl + '/logout', {}).then(function (res) {
                    _this9._onLogout(msg || 'Logged out');
                    return res.data;
                }).catch(function (err) {
                    _this9._onLogout(msg || 'Logged out');
                    if (err.data.status !== 401) {
                        throw parseError(err);
                    }
                });
            }
        }, {
            key: 'logoutAll',
            value: function logoutAll(msg) {
                var _this10 = this;

                return this._http.post(this._config.baseUrl + '/logout-all', {}).then(function (res) {
                    _this10._onLogout(msg || 'Logged out');
                    return res.data;
                }).catch(function (err) {
                    _this10._onLogout(msg || 'Logged out');
                    if (err.data.status !== 401) {
                        throw parseError(err);
                    }
                });
            }
        }, {
            key: 'logoutOthers',
            value: function logoutOthers() {
                return this._http.post(this._config.baseUrl + '/logout-others', {}).then(function (res) {
                    return res.data;
                }).catch(function (err) {
                    throw parseError(err);
                });
            }
        }, {
            key: 'socialAuth',
            value: function socialAuth(provider) {
                var providers = this._config.providers;
                if (providers.indexOf(provider) === -1) {
                    return Promise.reject({ error: 'Provider ' + provider + ' not supported.' });
                }
                var url = this._config.baseUrl + '/' + provider;
                return this._oAuthPopup(url, { windowTitle: 'Login with ' + capitalizeFirstLetter(provider) });
            }
        }, {
            key: 'tokenSocialAuth',
            value: function tokenSocialAuth(provider, accessToken) {
                var _this11 = this;

                var providers = this._config.providers;
                if (providers.indexOf(provider) === -1) {
                    return Promise.reject({ error: 'Provider ' + provider + ' not supported.' });
                }
                return this._http.post(this._config.baseUrl + '/' + provider + '/token', { access_token: accessToken }).then(function (res) {
                    if (res.data.user_id && res.data.token) {
                        res.data.serverTimeDiff = res.data.issued - Date.now();
                        _this11.setSession(res.data);
                        _this11._onLogin(res.data);
                    }
                    return res.data;
                }).catch(function (err) {
                    throw parseError(err);
                });
            }
        }, {
            key: 'tokenLink',
            value: function tokenLink(provider, accessToken) {
                var providers = this._config.providers;
                if (providers.indexOf(provider) === -1) {
                    return Promise.reject({ error: 'Provider ' + provider + ' not supported.' });
                }
                var linkURL = this._config.baseUrl + '/link/' + provider + '/token';
                return this._http.post(linkURL, { access_token: accessToken }).then(function (res) {
                    return res.data;
                }).catch(function (err) {
                    throw parseError(err);
                });
            }
        }, {
            key: 'link',
            value: function link(provider) {
                var providers = this._config.providers;
                if (providers.indexOf(provider) === -1) {
                    return Promise.reject({ error: 'Provider ' + provider + ' not supported.' });
                }
                if (this.authenticated()) {
                    var session = this.getSession();
                    var baseUrl = this._config.baseUrl;
                    var linkURL = baseUrl + '/link/' + provider + '?bearer_token=' + session.token + ':' + session.password;
                    var windowTitle = 'Link your account to ' + capitalizeFirstLetter(provider);
                    return this._oAuthPopup(linkURL, { windowTitle: windowTitle });
                }
                return Promise.reject({ error: 'Authentication required' });
            }
        }, {
            key: 'unlink',
            value: function unlink(provider) {
                var providers = this._config.providers;
                if (providers.indexOf(provider) === -1) {
                    return Promise.reject({ error: 'Provider ' + provider + ' not supported.' });
                }
                if (this.authenticated()) {
                    return this._http.post(this._config.baseUrl + '/unlink/' + provider).then(function (res) {
                        return res.data;
                    }).catch(function (err) {
                        throw parseError(err);
                    });
                }
                return Promise.reject({ error: 'Authentication required' });
            }
        }, {
            key: 'verifyEmail',
            value: function verifyEmail(token) {
                if (!token || typeof token !== 'string') {
                    return Promise.reject({ error: 'Invalid token' });
                }
                return this._http.get(this._config.baseUrl + '/verify-email/' + token).then(function (res) {
                    return res.data;
                }).catch(function (err) {
                    throw parseError(err);
                });
            }
        }, {
            key: 'forgotPassword',
            value: function forgotPassword(email) {
                return this._http.post(this._config.baseUrl + '/forgot-password', { email: email }, { skipRefresh: true }).then(function (res) {
                    return res.data;
                }).catch(function (err) {
                    throw parseError(err);
                });
            }
        }, {
            key: 'resetPassword',
            value: function resetPassword(form) {
                var _this12 = this;

                return this._http.post(this._config.baseUrl + '/password-reset', form, { skipRefresh: true }).then(function (res) {
                    if (res.data.user_id && res.data.token) {
                        _this12.setSession(res.data);
                        _this12._onLogin(res.data);
                    }
                    return res.data;
                }).catch(function (err) {
                    throw parseError(err);
                });
            }
        }, {
            key: 'changePassword',
            value: function changePassword(form) {
                if (this.authenticated()) {
                    return this._http.post(this._config.baseUrl + '/password-change', form).then(function (res) {
                        return res.data;
                    }).catch(function (err) {
                        throw parseError(err);
                    });
                }
                return Promise.reject({ error: 'Authentication required' });
            }
        }, {
            key: 'changeEmail',
            value: function changeEmail(newEmail) {
                if (this.authenticated()) {
                    return this._http.post(this._config.baseUrl + '/change-email', { newEmail: newEmail }).then(function (res) {
                        return res.data;
                    }).catch(function (err) {
                        throw parseError(err);
                    });
                }
                return Promise.reject({ error: 'Authentication required' });
            }
        }, {
            key: 'validateUsername',
            value: function validateUsername(username) {
                return this._http.get(this._config.baseUrl + '/validate-username/' + encodeURIComponent(username)).then(function () {
                    return true;
                }).catch(function (err) {
                    throw parseError(err);
                });
            }
        }, {
            key: 'validateEmail',
            value: function validateEmail(email) {
                return this._http.get(this._config.baseUrl + '/validate-email/' + encodeURIComponent(email)).then(function () {
                    return true;
                }).catch(function (err) {
                    throw parseError(err);
                });
            }
        }, {
            key: '_oAuthPopup',
            value: function _oAuthPopup(url, options) {
                var _this13 = this;

                return new Promise(function (resolve, reject) {
                    _this13._oauthComplete = false;
                    options.windowName = options.windowTitle || 'Social Login';
                    options.windowOptions = options.windowOptions || 'location=0,status=0,width=800,height=600';
                    var _oauthWindow = window.open(url, options.windowName, options.windowOptions);
                    var _oauthInterval = setInterval(function () {
                        if (_oauthWindow.closed) {
                            clearInterval(_oauthInterval);
                            if (!_this13._oauthComplete) {
                                _this13.authComplete = true;
                                reject({ error: 'Authorization cancelled' });
                            }
                        }
                    }, 500);

                    window.superlogin = {};
                    window.superlogin.oauthSession = function (error, session, link) {
                        if (!error && session) {
                            session.serverTimeDiff = session.issued - Date.now();
                            _this13.setSession(session);
                            _this13._onLogin(session);
                            return resolve(session);
                        } else if (!error && link) {
                            _this13._onLink(link);
                            return resolve(capitalizeFirstLetter(link) + ' successfully linked.');
                        }
                        _this13._oauthComplete = true;
                        return reject(error);
                    };
                });
            }
        }, {
            key: '_onLogin',
            value: function _onLogin(msg) {
                debug.info('Login', msg);
                this.emit('login', msg);
            }
        }, {
            key: '_onLogout',
            value: function _onLogout(msg) {
                this.deleteSession();
                debug.info('Logout', msg);
                this.emit('logout', msg);
            }
        }, {
            key: '_onLink',
            value: function _onLink(msg) {
                debug.info('Link', msg);
                this.emit('link', msg);
            }
        }, {
            key: '_onRegister',
            value: function _onRegister(msg) {
                debug.info('Register', msg);
                this.emit('register', msg);
            }
        }, {
            key: '_onRefresh',
            value: function _onRefresh(msg) {
                debug.info('Refresh', msg);
                this.emit('refresh', msg);
            }
        }]);

        return Superlogin;
    }(_eventemitter.EventEmitter2);

    return Superlogin;
}));
