const KEY_USER = "user";
const KEY_JWT = "jwt";

export const isLoggedIn = () => {
    const user = localStorage.getItem(KEY_USER);
    return null !== user && user;
}

export const getJWT = () : string|undefined => {
    if (isLoggedIn()) {
        let jwt = localStorage.getItem(KEY_JWT);
        return jwt ? jwt : undefined;
    }
    return undefined;
}
export const getUser = () => {
    let user = localStorage.getItem(KEY_USER);
    if (user && null !== user && typeof user === "string") {
        const ctx = Object.assign({}, JSON.parse(user));
        return ctx;
    } else {
        return undefined;
    }
}
export const setUser = (body) => {
    if (body) {
        localStorage.setItem(KEY_USER, JSON.stringify(body.userinfo));
        localStorage.setItem(KEY_JWT, body.jwt);
    } else {
        localStorage.removeItem(KEY_USER);
        localStorage.removeItem(KEY_JWT);
    }
}
export const login = () => {
    document.location.hash = "login";
}
export const logout = () => {
    localStorage.removeItem(KEY_USER);
    localStorage.removeItem(KEY_JWT);
}
