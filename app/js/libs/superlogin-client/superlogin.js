define([
    "axios",
    "eventemitter2",
    "underscore",
    "global"
], function superlogin (axios, EventEmitter2, _, _$) {
    const debug = {
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
        const parser = window.document.createElement('a');
        parser.href = url;
        for (let i = 0; i < endpoints.length; i += 1) {
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

    class Superlogin extends EventEmitter2 {
        constructor(config = {}, noInit = false) {
            super();

            this._oauthComplete = false;
            this._config = config;
            this._refreshInProgress = false;
            this._http = axios.create();

            if (!noInit) {
                this.configure(this._config);
            }
        }

        configure(config) {
            config         = this._config || {};
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

            this._config          = config;
            this._session         = null;
            this.hasBeenActive    = false;
            this.refreshScheduled = false;
            this.initialized      = false;

            _$.app.decodeData(JSON.parse(this.storage.getItem(_$.app.name)), "session").then((sessionData) => {
                this._session = sessionData;
                this._httpInterceptor();

                // Check expired
                if (config.checkExpired) {
                    this.checkExpired();
                    this.validateSession()
                    .then(() => {
                        this._onLogin(this._session);
                    })
                    .catch(() => {
                        // ignoring
                    });
                }

                $(window).on("mousemove mousedown touchstart touchmove keydown", _.debounce(() => {
                    if (this.authenticated() && !this.hasBeenActive) {
                        this.hasBeenActive = true;
                    }
                }, 250, { maxWait: 5000 }));

                this.initialized = true;
                this.emit("initialized");
            }).catch((error) => {
                debug.error("superlogin.js@101");
            });
        }

        setValidateInterval () {
            if (!this.validateInterval) {
                this.validateInterval = setInterval(() => {
                    if (this.checkExpired()) {
                        debug.log("checkExpired");
                        this._onLogout('sessionExpired');
                        return;
                    }

                    this.validateSession().catch((error) => {
                        debug.log("validateInterval");
                        this._onLogout(error);
                    });
                }, 5000);
            }
        }

        clearValidateInterval () {
            if (this.validateInterval) {
                clearInterval(this.validateInterval);
                this.validateInterval = null;
            }
        }

        _httpInterceptor() {
            const request = req => {
                const config    = this.getConfig();
                const session   = this.getSession();

                if (!session || !session.token) {
                    return Promise.resolve(req);
                }

                if (req.skipRefresh) {
                    return Promise.resolve(req);
                }

                return this.checkRefresh().then(() => {
                    if (checkEndpoint(req.url, config.endpoints)) {
                        req.headers.Authorization = `Bearer ${session.token}:${session.password}`;
                    }
                    return req;
                });
            };

            const responseError = error => {
                const config = this.getConfig();

                // if there is not config obj in in the error it means we cannot check the endpoints.
                // This happens for example if there is no connection at all because axion just forwards the raw error.
                if (!error || !error.config) {
                    return Promise.reject(error);
                }

                // If there is an unauthorized error from one of our endpoints and we are logged in...
                if (checkEndpoint(error.config.url, config.endpoints) &&
                    error.response && error.response.status === 401 && this.authenticated()) {
                    debug.warn('Not authorized');
                    this._onLogout('sessionExpired');
                }
                return Promise.reject(error);
            };
            // clear interceptors from a previous configure call
            this._http.interceptors.request.eject(this._httpRequestInterceptor);
            this._http.interceptors.response.eject(this._httpResponseInterceptor);

            this._httpRequestInterceptor = this._http.interceptors.request.use(request.bind(this));
            this._httpResponseInterceptor = this._http.interceptors.response.use(null, responseError.bind(this));
        }

        authenticated() {
            return !!(this._session && this._session.user_id);
        }

        getConfig() {
            return this._config;
        }

        validateSession() {
            if (!this.authenticated()) {
                return Promise.reject();
            }
            return this._http.get(`${this._config.baseUrl}/session`)
            .then(res => {
                if (res.data.error) {
                    this.deleteSession();
                    throw parseError(res.data.error);
                } else {
                    return res.data;
                }
            })
            .catch(err => {
                this.deleteSession();
                throw parseError(err);
            });
        }

        getSession() {
            return this._session ? Object.assign(this._session) : null;
        }

        setSession(session) {
            this._session = session;

            return _$.app.encodeData(this._session, "session").then((encodedData) => {
                this.storage.setItem(_$.app.name, JSON.stringify(encodedData));
                debug.info('New session set');
                return session;
            });
        }

        deleteSession() {
            this.clearValidateInterval();
            this.storage.removeItem(_$.app.name);
            this._session = null;
        }

        getDbUrl(dbName) {
            if (this._session && this._session.userDBs && this._session.userDBs[dbName]) {
                return this._session.userDBs[dbName];
            }
            return null;
        }

        getHttp() {
            return this._http;
        }

        confirmRole(role) {
            if (!this._session || !this._session.roles || !this._session.roles.length) return false;
            return this._session.roles.indexOf(role) !== -1;
        }

        confirmAnyRole(roles) {
            if (!this._session || !this._session.roles || !this._session.roles.length) return false;
            for (let i = 0; i < roles.length; i += 1) {
                if (this._session.roles.indexOf(roles[i]) !== -1) return true;
            }
            return false;
        }

        confirmAllRoles(roles) {
            if (!this._session || !this._session.roles || !this._session.roles.length) return false;
            for (let i = 0; i < roles.length; i += 1) {
                if (this._session.roles.indexOf(roles[i]) === -1) return false;
            }
            return true;
        }

        checkRefresh() {
            // Get out if we are not authenticated or a refresh is already in progress
            if (this._refreshInProgress) {
                return Promise.resolve();
            }
            if (!this._session || !this._session.user_id) {
                return Promise.reject();
            }

            const issued = this._session.issued;
            const expires = this._session.expires;
            const threshold = isNaN(this._config.refreshThreshold) ? 0.5 : this._config.refreshThreshold;
            const duration = expires - issued;
            let timeDiff = this._session.serverTimeDiff || 0;
            if (Math.abs(timeDiff) < 5000) {
                timeDiff = 0;
            }
            const estimatedServerTime = Date.now() + timeDiff;
            const elapsed = estimatedServerTime - issued;
            const ratio = elapsed / duration;
            //debug.log("checkRefresh -- ratio:", ratio, "-- hasBeenActive:", this.hasBeenActive, "-- refreshScheduled:", this.refreshScheduled);
            if (this.hasBeenActive && !this.refreshScheduled) {
                this.hasBeenActive    = false;
                this.refreshScheduled = true;
                //debug.log("checkRefresh -- the user has been active. scheduling a lease renewal.");
            }

            if (ratio > threshold && this.refreshScheduled) {
                //debug.log("checkRefresh -- the user has been active during the session lifetime. renewing the session's lease.");
                return this.refresh(true);
            }
            return Promise.resolve();
        }

        checkExpired() {
            // This is not necessary if we are not authenticated
            if (!this.authenticated()) {
                return;
            }
            const expires = this._session.expires;
            let timeDiff = this._session.serverTimeDiff || 0;
            // Only compensate for time difference if it is greater than 5 seconds
            if (Math.abs(timeDiff) < 5000) {
                timeDiff = 0;
            }
            const estimatedServerTime = Date.now() + timeDiff;
            return estimatedServerTime > expires;
        }

        refresh(renewLease) {
            const session = this.getSession();
            this._refreshInProgress = true;
            debug.info('Refreshing session -- renewLease:', renewLease);
            return this._http.post(`${this._config.baseUrl}/refresh`, { renewLease })
                .then(res => {
                    this._refreshInProgress = false;
                    if (renewLease) {
                        this.refreshScheduled = false;
                    }
                    debug.log('Refreshing session sucess', session);
                    if (res.data.token && res.data.expires) {
                        Object.assign(session, res.data);
                        return this.setSession(session).then(() => {
                            this._onRefresh(session);
                            return session;
                        });
                    } else {
                        return session;
                    }
                })
                .catch(err => {
                    this._refreshInProgress = false;
                    debug.error('Refreshing session failed', err);
                    throw parseError(err);
                });
        }

        authenticate() {
            return new Promise(resolve => {
                const session = this.getSession();
                if (session) {
                    resolve(session);
                } else {
                    this.on('login', newSession => {
                        resolve(newSession);
                    });
                }
            });
        }

        login(credentials) {
            if (!credentials.username || !credentials.password) {
                return Promise.reject({ error: 'Username or Password missing...' });
            }
            
            return this._http.post(`${this._config.baseUrl}/login`, credentials, { skipRefresh: true })
                .then(res => {
                    if (res.data.error) {
                        this.deleteSession();
                        throw parseError(res.data);
                    } else {
                        res.data.serverTimeDiff = res.data.issued - Date.now();
                        return this.setSession(res.data).then(() => {
                            this._onLogin(res.data);
                            return res.data;
                        });
                    }
                })
                .catch(err => {
                    this.deleteSession();
                    throw parseError(err);
                });
        }

        register(registration) {
            return this._http.post(`${this._config.baseUrl}/register`, registration, { skipRefresh: true })
                .then(res => {
                    if (res.data.error) {
                        throw parseError(res.data);
                    }

                    if (res.data.user_id && res.data.token) {
                        res.data.serverTimeDiff = res.data.issued - Date.now();
                        this.setSession(res.data).then(() => {
                            this._onLogin(res.data);
                            this._onRegister(registration);
                            return res.data;
                        });
                    }
                    this._onRegister(registration);
                    return res.data;
                })
                .catch(err => {
                    throw parseError(err);
                });
        }

        logout(msg) {
            return this._http.post(`${this._config.baseUrl}/logout`, {})
                .then(res => {
                    this._onLogout(msg || 'logout');
                    return res.data;
                })
                .catch(err => {
                    this._onLogout(msg || 'logout');
                    if (err.data && err.data.status !== 401) {
                        throw parseError(err);
                    }
                });
        }

        logoutAll(msg) {
            return this._http.post(`${this._config.baseUrl}/logout-all`, {})
                .then(res => {
                    this._onLogout(msg || 'logout');
                    return res.data;
                })
                .catch(err => {
                    this._onLogout(msg || 'logout');
                    if (err.data && err.data.status !== 401) {
                        throw parseError(err);
                    }
                });
        }

        logoutOthers() {
            return this._http.post(`${this._config.baseUrl}/logout-others`, {})
                .then(res => res.data)
                .catch(err => {
                    throw parseError(err);
                });
        }

        socialAuth(provider) {
            const providers = this._config.providers;
            if (providers.indexOf(provider) === -1) {
                return Promise.reject({ error: `Provider ${provider} not supported.` });
            }
            const url = `${this._config.baseUrl}/${provider}`;
            return this._oAuthPopup(url, { windowTitle: `Login with ${capitalizeFirstLetter(provider)}` });
        }

        tokenSocialAuth(provider, accessToken) {
            const providers = this._config.providers;
            if (providers.indexOf(provider) === -1) {
                return Promise.reject({ error: `Provider ${provider} not supported.` });
            }
            return this._http.post(`${this._config.baseUrl}/${provider}/token`, { access_token: accessToken })
                .then(res => {
                    if (res.data.user_id && res.data.token) {
                        res.data.serverTimeDiff = res.data.issued - Date.now();
                        this.setSession(res.data).then(() => {
                            this._onLogin(res.data);
                            return res.data;
                        });
                    }
                    return res.data;
                })
                .catch(err => {
                    throw parseError(err);
                });
        }

        tokenLink(provider, accessToken) {
            const providers = this._config.providers;
            if (providers.indexOf(provider) === -1) {
                return Promise.reject({ error: `Provider ${provider} not supported.` });
            }
            const linkURL = `${this._config.baseUrl}/link/${provider}/token`;
            return this._http.post(linkURL, { access_token: accessToken })
                .then(res => res.data)
                .catch(err => {
                    throw parseError(err);
                });
        }

        link(provider) {
            const providers = this._config.providers;
            if (providers.indexOf(provider) === -1) {
                return Promise.reject({ error: `Provider ${provider} not supported.` });
            }
            if (this.authenticated()) {
                const session = this.getSession();
                const baseUrl = this._config.baseUrl;
                const linkURL = `${baseUrl}/link/${provider}?bearer_token=${session.token}:${session.password}`;
                const windowTitle = `Link your account to ${capitalizeFirstLetter(provider)}`;
                return this._oAuthPopup(linkURL, { windowTitle });
            }
            return Promise.reject({ error: 'Authentication required' });
        }

        unlink(provider) {
            const providers = this._config.providers;
            if (providers.indexOf(provider) === -1) {
                return Promise.reject({ error: `Provider ${provider} not supported.` });
            }
            if (this.authenticated()) {
                return this._http.post(`${this._config.baseUrl}/unlink/${provider}`)
                    .then(res => res.data)
                    .catch(err => {
                        throw parseError(err);
                    });
            }
            return Promise.reject({ error: 'Authentication required' });
        }

        verifyEmail(token) {
            if (!token || typeof token !== 'string') {
                return Promise.reject({ error: 'Invalid token' });
            }
            return this._http.get(`${this._config.baseUrl}/verify-email/${token}`)
                .then(res => res.data)
                .catch(err => {
                    throw parseError(err);
                });
        }

        forgotPassword(email) {
            return this._http.post(`${this._config.baseUrl}/forgot-password`, { email }, { skipRefresh: true })
                .then(res => {
                    if (res.data.error) {
                        throw parseError(res.data);
                    } else {
                        return res.data;
                    }
                })
                .catch(err => {
                    throw parseError(err);
                });
        }

        getUser() {
            return this._http.get(`${this._config.baseUrl}/get-user`)
                .then(res => {
                    if (res.data.error) {
                        throw parseError(res.data);
                    } else {
                        return res.data;
                    }
                })
                .catch(err => {
                    throw parseError(err);
                });
        }

        removeUser() {
            if (this.authenticated() && this.confirmRole("user")) {
                return this._http.post(`${this._config.baseUrl}/remove-user`, {})
                    .then(res => {
                        if (res.data.error) {
                            throw parseError(res.data);
                        } else {
                            this._onLogout('userDeleted');
                            return res.data;
                        }
                    })
                    .catch(err => {
                        throw parseError(err);
                    });
            }
            return Promise.reject({ error: 'Authentication required' });
        }

        updateProfile(form) {
            const doUpdate = () => {
                return this._http.post(`${this._config.baseUrl}/profile-update`, { name: form.name, profile: form.profile })
                    .then(res => {
                        if (res.data.error) {
                            throw parseError(res.data);
                        } else {
                            return res.data;
                        }
                    })
                    .catch(err => {
                        throw parseError(err);
                    });
            };

            const updatePassword = () => {
                return this.changePassword({
                    currentPassword : form.currentPassword,
                    newPassword     : form.newPassword,
                    confirmPassword : form.confirmPassword
                });
            };

            const checkEmail  = () => { return this.validateEmail(form.newEmail); };
            const updateEmail = () => { return this.changeEmail(form.newEmail); };

            if (this.authenticated()) {
                if (form.newPassword && form.newEmail) {
                    return checkEmail().then(updatePassword).then(updateEmail).then(doUpdate);
                } else if (form.newPassword) {
                    return updatePassword().then(doUpdate);
                } else if (form.newEmail) {
                    return checkEmail().then(updateEmail).then(doUpdate);
                } else {
                    return doUpdate();
                }
            }
            return Promise.reject({ error: 'Authentication required' });
        }

        resetPassword(form) {
            return this._http.post(`${this._config.baseUrl}/password-reset`, form, { skipRefresh: true })
                .then(res => {
                    if (res.data.error) {
                        throw parseError(res.data);
                    }

                    if (res.data.user_id && res.data.token) {
                        this.setSession(res.data).then(() => {
                            this._onLogin(res.data);
                            return res.data;
                        });
                    }
                    return res.data;
                })
                .catch(err => {
                    throw parseError(err);
                });
        }

        changePassword(form) {
            if (this.authenticated()) {
                return this._http.post(`${this._config.baseUrl}/password-change`, form)
                    .then(res => {
                        if (res.data.error) {
                            throw parseError(res.data);
                        } else {
                            return res.data;
                        }
                    })
                    .catch(err => {
                        throw parseError(err);
                    });
            }
            return Promise.reject({ error: 'Authentication required' });
        }

        changeEmail(newEmail) {
            if (this.authenticated()) {
                return this._http.post(`${this._config.baseUrl}/change-email`, { newEmail })
                    .then(res => {
                        if (res.data.error) {
                            throw parseError(res.data);
                        } else {
                            return res.data;
                        }
                    })
                    .catch(err => {
                        throw parseError(err);
                    });
            }
            return Promise.reject({ error: 'Authentication required' });
        }

        validateUsername(username) {
            return this._http.get(`${this._config.baseUrl}/validate-username/${encodeURIComponent(username)}`)
                .then(() => true)
                .catch(err => {
                    throw parseError(err);
                });
        }

        validateEmail(email) {
            return this._http.get(`${this._config.baseUrl}/validate-email/${encodeURIComponent(email)}`)
                .then(() => true)
                .catch(err => {
                    throw parseError(err);
                });
        }

        _oAuthPopup(url, options) {
            return new Promise((resolve, reject) => {
                this._oauthComplete = false;
                options.windowName = options.windowTitle || 'Social Login';
                options.windowOptions = options.windowOptions || 'location=0,status=0,width=800,height=600';
                const _oauthWindow = window.open(url, options.windowName, options.windowOptions);
                const _oauthInterval = setInterval(() => {
                    if (_oauthWindow.closed) {
                        clearInterval(_oauthInterval);
                        if (!this._oauthComplete) {
                            this.authComplete = true;
                            reject({ error: 'Authorization cancelled' });
                        }
                    }
                }, 500);

                window.superlogin = {};
                window.superlogin.oauthSession = (error, session, link) => {
                    if (!error && session) {
                        session.serverTimeDiff = session.issued - Date.now();
                        this.setSession(session).then(() => {
                            this._onLogin(session);
                            return resolve(session);
                        });
                    } else if (!error && link) {
                        this._onLink(link);
                        return resolve(`${capitalizeFirstLetter(link)} successfully linked.`);
                    }
                    this._oauthComplete = true;
                    return reject(error);
                };
            });
        }

        _onLogin(msg) {
            debug.info('Login', msg);
            this.emit('login', msg);
        }

        _onLogout(msg) {
            this.deleteSession();
            debug.info('Logout', msg);
            this.emit('logout', msg);
        }

        _onLink(msg) {
            debug.info('Link', msg);
            this.emit('link', msg);
        }

        _onRegister(msg) {
            debug.info('Register', msg);
            this.emit('register', msg);
        }

        _onRefresh(msg) {
            debug.info('Refresh', msg);
            this.emit('refresh', msg);
        }
    }

    return Superlogin;
});
