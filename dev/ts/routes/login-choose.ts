import { get } from "../fetch-util";

const PROVIDER_LABELS: Record<string, string> = {
    google: "Google",
    github: "Github",
    microsoft: "Microsoft",
    local: "Local (Test)",
};

export default async (elemRoot: JQuery<HTMLElement>) => {
    const providers = await get("/api/v1/login/providers") as string[];
    const items = providers
        .map(p => `<li><a href="#login-${p}">Login with ${PROVIDER_LABELS[p] || p}</a></li>`)
        .join("\n                ");

    elemRoot.html(`<div class="jumbotron">
    <div class="row">
        <div class="col-lg-12 col-md-12 col-sm-12">
            <h1>Login With</h1>
            <p>
                Select the service you would like to login with below. Please note you must have a
                User record on the system already for authorization to occur.
            </p>
            <p>
                <ul>
                ${items}
                </ul>
            </p>
        </div>
    </div>
</div>`);
}
