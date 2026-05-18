import { graphql } from "../fetch-util";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";

export default async (elemRoot: JQuery<HTMLElement>) => {
    const container = createContainers(elemRoot, "house-create", "title", "form");
    const titleElem = container.children!.title.elem;
    const formElem = container.children!.form.elem;

    uiutils.appendTitleRow(titleElem, "Create House");

    formElem.html(`
        <form id="houseCreateForm" novalidate>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="nameInput">Name</label>
                        <input type="text" required class="form-control" id="nameInput" placeholder="Enter house name" maxlength="128">
                        <small class="form-text text-muted">Specify the name of the house (maximum 128 characters).</small>
                        <div class="invalid-feedback">You must specify the name for the house. Must be unique.</div>
                    </div>
                </div>
            </div>
            <hr>
            <button type="button" class="btn btn-primary mr-2" id="saveHouse">Save</button>
            <a href="#configuration/houses" class="btn btn-secondary">Back</a>
        </form>
    `);

    document.getElementById("saveHouse")?.addEventListener("click", async () => {
        const form = document.getElementById("houseCreateForm") as HTMLFormElement;
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        const name = (document.getElementById("nameInput") as HTMLInputElement).value;
        await graphql(`mutation {createHouse(data: {name: "${name}"}){id}}`);
        document.location.hash = "#configuration/houses";
    });
};
