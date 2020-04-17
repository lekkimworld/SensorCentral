module.exports = (document, elemRoot) => {
    elemRoot.html(`<div class="jumbotron">
        <div class="row">
            <div class="col-lg-12 col-md-12 col-sm-12">
                <h1>Logged out</h1>
                <p>
                    You've been logged out. 
                </p>
            </div>
        </div>
    </div>`);
    window.setTimeout(() => {
        window.location.hash = "#root";
    }, 5000);
}
