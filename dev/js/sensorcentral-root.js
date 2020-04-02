const storage = require("./storage-utils");
const uiutils = require("./ui-utils");
const log = require("./logger");

module.exports = (document, elemRoot) => {
    if (storage.isLoggedIn()) {
        // user is authenticated
        const user = storage.getUser();
        elemRoot.html(`<h1>Hello ${user.given_name}!</h1>`);
    } else {
        // user is NOT authenticated
        elemRoot.html(`<h1>Hello stranger!</h1>
        <p>
            Please <a href="javascript:void(0)" id="login">login</a> to use the application.
        </p>`);
        $("#login").on("click", () => {
            storage.login();
            document.location.reload();
        })
    }
    
}