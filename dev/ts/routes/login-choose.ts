export default (elemRoot: JQuery<HTMLElement>) => {
    elemRoot.html(`<div class="jumbotron">
    <div class="row">
        <div class="col-lg-12 col-md-12 col-sm-12">
            <h1>Login With</h1>
            <p>
                Select the service you would like to login with below. Please note you must have a 
                User record on the system already for authorization to occor.
            </p>
            <p>
                <ul>
                <li><a href="#login-google">Login with Google</a></li>
                <li><a href="#login-github">Login with Github</a></li>
                </ul>
            </p>
        </div>
    </div>
</div>`);
}
