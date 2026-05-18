import { graphql } from "../fetch-util";
import { createContainers } from "../ui-helper";
import * as uiutils from "../ui-utils";

export default async (elemRoot: JQuery<HTMLElement>, houseId: string) => {
    const container = createContainers(elemRoot, "house-edit", "title", "form");
    const titleElem = container.children!.title.elem;
    const formElem = container.children!.form.elem;

    const data = await graphql(`{house(id:"${houseId}"){id,name}}`);
    const house = data.house;

    if (!house) {
        formElem.html(`<div class="alert alert-danger">House not found.</div><a href="#configuration/houses" class="btn btn-secondary">Back</a>`);
        return;
    }

    uiutils.appendTitleRow(titleElem, "Edit House");

    formElem.html(`
        <form id="houseEditForm" novalidate>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="nameInput">Name</label>
                        <input type="text" required class="form-control" id="nameInput" value="${house.name}" maxlength="128">
                        <small class="form-text text-muted">Specify the name of the house (maximum 128 characters).</small>
                        <div class="invalid-feedback">You must specify the name for the house. Must be unique.</div>
                    </div>
                </div>
            </div>
            <hr>
            <button type="button" class="btn btn-primary mr-2" id="saveHouse">Save</button>
            <a href="#configuration/house/${houseId}" class="btn btn-secondary">Back</a>
        </form>
    `);

    document.getElementById("saveHouse")?.addEventListener("click", async () => {
        const form = document.getElementById("houseEditForm") as HTMLFormElement;
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            return;
        }

        const name = (document.getElementById("nameInput") as HTMLInputElement).value;
        await graphql(`mutation {updateHouse(data: {id: "${houseId}", name: "${name}"}){id}}`);
        document.location.hash = `#configuration/house/${houseId}`;
    });
};
