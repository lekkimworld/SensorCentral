const KEY_USER = "user";
const KEY_JWT = "jwt";

const isLoggedIn = () => {
    const user = localStorage.getItem(KEY_USER);
    return null !== user && user;
}

module.exports = {
    isLoggedIn,
    getJWT: () => {
        if (isLoggedIn()) return localStorage.getItem(KEY_JWT);
        return undefined;
    },
    getUser: () => {
        const user = localStorage.getItem(KEY_USER);
        if (user && null !== user && typeof user === "string") {
            const ctx = Object.assign({}, JSON.parse(user));
            return ctx;
        } else {
            return undefined;
        }
    },
    setUser: (body) => {
        if (body) {
            localStorage.setItem(KEY_USER, JSON.stringify(body.userinfo));
            localStorage.setItem(KEY_JWT, body.jwt);
        } else {
            localStorage.removeItem(KEY_USER);
            localStorage.removeItem(KEY_JWT);
        }
    },
    login: () => {
        document.location.hash = "login";
    },
    logout: () => {
        localStorage.removeItem(KEY_USER);
        localStorage.removeItem(KEY_JWT);
    }
}