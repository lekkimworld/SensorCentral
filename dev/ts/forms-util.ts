import moment, { Moment } from "moment";
import { ObjectValues } from "./helpers";

const ID_ELEM_FORM = "sensorcentral-form";

export type FormClosedCallback = () => void;
export type FieldOptionsBasic = {
    /**
     * Name of the field
     */
    name: string;

    /**
     * Explanation shown below the field - will show the placeholder or nothing if no placeholder if undefined
     */
    fieldExplanation?: string;
};
export type FieldOptionsValue = {
    value?: string|number;
}
export type FieldOptionsAttributes = {
    /**
     * Additional custom attributes
     */
    attributes?: { [key: string]: string };
};
export type FieldOptionsClassList = {
    /**
     * Additional classes to add
     */
    classList?: Array<string>;
};
export type FieldOptionsPlaceholder = {
    placeholder?: string;
};
export type FieldOptionsText = FieldOptionsBasic & FieldOptionsLabel & FieldOptionsPlaceholder & FieldOptionsRequired & FieldOptionsValue;
export type FieldOptionsDisabledText = FieldOptionsBasic & FieldOptionsLabel & FieldOptionsValue;
export type FieldOptionsNumber = FieldOptionsBasic &
    FieldOptionsLabel &
    FieldOptionsPlaceholder &
    FieldOptionsRequired &
    FieldOptionsValue & {
        step?: number
    };
export type FieldOptionsRequired = {
    /**
     * Is the field required in edit mode? Set to true to make required.
     */
    required?: boolean;

    /**
     * Text to show if the field is required and not filled in.
     */
    validationText?: string;
};
export type FieldOptionsLabel = {
    /**
     * Label to show for the dropdown
     */
    label: string;
}
export type FieldOptionsDropdown = FieldOptionsBasic & FieldOptionsLabel & FieldOptionsRequired & {
    /**
     * Options - key/value
     */
    dropdownOptions: {[key:string]: string};

    /**
     * Should a blank value to added to the list of options.
     */
    addBlank: boolean;
}

export type FieldOptionsToggleButton = FieldOptionsBasic & FieldOptionsLabel & {
    /**
     * Is the button checked? Defaults to off.
     */
    on?: boolean;

    /**
     * Value - defaults to 1
     */
    value?: string;
};
export type FieldOptionsButton = Omit<FieldOptionsBasic, "name"> & FieldOptionsAttributes & FieldOptionsClassList &  {
    text: string;
    rel?: string;
};
export type FieldOptionsDatetimePicker = FieldOptionsBasic & FieldOptionsLabel & FieldOptionsRequired;

type TimeOptions = {
    hour?: number,
    minute?: number,
    second?: number,
}
type DateOptions = {
    day?: number,
    week?: number,
    month?: number,
    year?: number,
}
type InitDateTime = {
    set?: TimeOptions,
    add?: TimeOptions & DateOptions,
}
type FieldInitDateTimePicker = {
    id: string,
    locale?: string,
    format?: string,
    inline?: boolean,
    sideBySide?: boolean,
    date?: Moment | Date,
    dateInit?: InitDateTime

}
export const initDateTimePicker = (options: FieldInitDateTimePicker) => {
    let initDate = moment();
    if (options.date) initDate = moment(options.date);
    if (options.dateInit) {
        initDate = initDate
            .set("hour", options.dateInit.set?.hour || 0)
            .set("minute", options.dateInit.set?.minute || 0)
            .set("second", options.dateInit.set?.second || 0)
            .set("millisecond", 0)
            .add("day", options.dateInit.add?.day || 0)
            .add("week", options.dateInit.add?.week || 0)
            .add("month", options.dateInit.add?.month || 0)
            .add("year", options.dateInit.add?.year || 0)
            .add("hour", options.dateInit.add?.hour || 0)
            .add("minute", options.dateInit.add?.minute || 0)
            .add("second", options.dateInit.add?.second || 0);
    }
    //@ts-ignore
    let d = $(`#${options.id}`).datetimepicker({
        locale: options.locale || "da_dk",
        format: options.format,
        inline: options.inline || false,
        sideBySide: options.sideBySide || true,
        icons: {
            time: "fa fa-clock-o",
            date: "fa fa-calendar",
            up: "fa fa-arrow-up",
            down: "fa fa-arrow-down",
            next: "fa fa-arrow-right",
            previous: "fa fa-arrow-left",
        },
        date: initDate
    });
    
}

export const initTimePicker = (options: FieldInitDateTimePicker) => {
    initDateTimePicker(Object.assign({}, options, {format: "LT"}));
};

export const initDatePicker = (options: FieldInitDateTimePicker) => {
    initDateTimePicker(Object.assign({}, options, { format: "L" }));
};

/**
 * Removes any modal form we have on screen.
 */
const removeForm = () => {
    // remove form
    const elem = $(`#${ID_ELEM_FORM}`);
    $('.modal-backdrop').remove();
    $('body').removeClass('modal-open');
    elem.html("");
}

const fieldExplanation = (options: FieldOptionsBasic) => {
    if (options.fieldExplanation) {
        return `<small id="${options.name}Help" class="form-text text-muted">${options.fieldExplanation}</small>`;
    } else {
        return "";
    }
}

const fieldRequired = (options: FieldOptionsRequired) => {
    if (options.required) {
        return `<div class="invalid-feedback">${options.validationText || "Field is required"}</div>`;
    } else {
        return "";
    }
}

/**
 * Creates a text field in a form.
 * 
 * @param options Options for the text field
 * @returns 
 */
export const textField = (options: FieldOptionsText) => {
    return `<div class="form-group">
    <label for="${options.name}Input">${options.label || options.placeholder}</label>
    <input type="text" ${options.required ? "required" : ""} class="form-control" id="${options.name}Input" aria-describedby="${name}Help" placeholder="${options.placeholder || ""}" value="${options.value || ""}">
    ${fieldExplanation(options)}
    ${fieldRequired(options)}
</div>`
}

/**
 * Creates a number field in a form.
 * 
 * @param options Options for the field
 * @returns 
 */
export const numberField = (options: FieldOptionsNumber) => {
    return `<div class="form-group">
        <label for="${options.name}Input">${options.label}</label>
        <input type="number" step="${options.step || "1"}" required class="form-control" id="${options.name}Input" aria-describedby="sampleHelp" placeholder="${options.placeholder || ""}" value="${Object.prototype.hasOwnProperty.call(options, "value") ? options.value : "0"}">
        ${fieldExplanation(options)}
        ${fieldRequired(options)}
    </div>`;
}

/**
 * Creates a disabled (non-editable) text field in a form.
 * 
 * @param options
 * @returns 
 */
export const disabledTextField = (options: FieldOptionsDisabledText) => {
    return `<div class="form-group">
    <label for="${options.name}Input">${options.label}</label>
    <input type="text" required class="form-control" id="${options.name}Input" disabled="1" value="${options.value || ""}">
    ${fieldExplanation(options)}
</div>`;
}

/**
 * Creates a dropdown field.
 * 
 * @param options 
 * @returns 
 */
export const dropdown = (options: FieldOptionsDropdown) => {
    let use_options = `${options.addBlank ? "<option></option>" : ""}
        ${Object.keys(options.dropdownOptions).map(key => `<option value="${key}">${options.dropdownOptions[key]}</option>`)}`;
    return `<div class="form-group">
        <label for="${options.name}Input">${options.label}</label>
        <select class="form-control" id="${options.name}Input" ${options.required ? "required" : ""}>
            ${use_options}
        </select>
        ${fieldExplanation(options)}
        ${fieldRequired(options)}
    </div>`;
}

export const toggleButton = (options: FieldOptionsToggleButton) => {
    return `<div class="form-group">
        <label for="${options.name}Input">${options.label}</label><br/>
        <label class="sensorcentral-switch">
            <input type="checkbox" id="${options.name}Input" value="${options.value || "1"}" ${options.on ? "checked" : ""}>
            <span class="sensorcentral-slider sensorcentral-round"></span>
        </label>
        ${fieldExplanation(options)}
    </div>`
}

/**
 * Add a button
 * 
 * @param options
 * @returns 
 */
export const button = (options: FieldOptionsButton) => {
    const attrs = options.attributes ? Object.keys(options.attributes).map(k => {
        const v = options.attributes![k];
        if (v) return `${k}=${v}`
        return k;
    }).join(" ") : "";
    return `<button type="button" class="btn ${
        options.classList ? options.classList.join(" ") : "btn-primary"
    }" rel="${options.rel}" ${attrs}>${options.text}</button>`;
};

export const buttonClose = (text: string = "Close") => {
    return button({
        text,
        classList: ["btn-secondary"],
        attributes: {
            "data-dismiss": "modal"
        }
    })
}

export const buttonPerformAction = (text = "Save Changes", rel = "std") => {
    return button({
        text,
        rel,
        classList: ["btn-primary"],
        attributes: {id: "performAction"}
    })
}

export const datetimepicker = (options: FieldOptionsDatetimePicker) => {
    return `<label for="${options.name}Input">${options.label}</label>
        <div class='input-group date' id='${options.name}'>
            <input type='text' class="form-control" />
            <span class="input-group-addon">
                <span class="fa fa-calendar"></span>
            </span>
        </div>
        ${fieldExplanation(options)}
        ${fieldRequired(options)}`;
}

export const EVENTS = {
    /**
     * Emitted after the HTML is injected into the page but before the form is displayed.
     */
    init: "init",

    /**
     * Emitted after the form is displayed.
     */
    show: "show",

    /**
     * Emitted after the form is closed.
     */
    close: "close",

    /**
     * Emitted for button click events.
     */
    click: "click",

    /**
     * Emitted when OK (or similar) button is clicked to gather data from the form.
     */
    data: "data",

    /**
     * Emitted when the form has posted its data if applicable. Can be used to perform action once the form 
     * has completed all work.
     */
    postdata: "postdata",

    /**
     * Emitted if OK (or similar) button is clicked but validation fails.
     */
    failedValidation: "failedValidation",
} as const;
export type FormEvent = ObjectValues<typeof EVENTS>;
export class ClickEvent extends Event {
    readonly rel: string;
    constructor(rel: string) {
        super(EVENTS.click);
        this.rel = rel;
    }
}
export type FormData = Record<string,undefined|string|string[]|number|number[]|boolean|boolean[]|Date|Date[]|Moment|Moment[]>;
export class InitEvent extends Event {
    readonly catalog: UICatalog;
    constructor(catalog: UICatalog) {
        super(EVENTS.init);
        this.catalog = catalog;
    }
}
export class DataEvent extends Event {
    readonly data: FormData;
    constructor(data: FormData) {
        super(EVENTS.data);
        this.data = data;
    }
}
class UIControl {
    protected options: FieldOptionsBasic;
    constructor(options: FieldOptionsBasic) {
        this.options = options;
    }
    init() {}
    get value() : string {
        return $(`#${this.options.name}Input`).val() as string;
    }
    set value(v: string) {
        $(`#${this.options.name}Input`).val(v);
    }
}
type OnChangeCallback = (value:string) => void;
export class DropdownControl extends UIControl {
    private listeners: Array<OnChangeCallback> = [];

    constructor(options: FieldOptionsBasic) {
        super(options);
    }

    init() {
        $(`#${this.options.name}Input`).on("change", (ev) => {
            const v = this.value;
            this.listeners.forEach((l) => {
                l(v);
            });
        });
    }

    onChange(cb: OnChangeCallback) {
        this.listeners.push(cb);
    }
}
export class ToggleButtonControl extends UIControl {
    constructor(options: FieldOptionsBasic) {
        super(options);
    }

    get checked() : boolean {
        return $(`#${this.options.name}Input`).prop("checked");
    }
    set checked(v: boolean) {
        $(`#${this.options.name}Input`).prop("checked",  v);
    }
}
export class DateTimeControl extends UIControl {
    constructor(options: FieldOptionsBasic) {
        super(options);
    }

    init() {
        const opts = this.options as FieldOptionsDatetimePicker;
        initDateTimePicker({
            id: opts.name,
            inline: true,
            sideBySide: true,
        });
    }

    get moment(): Moment {
        return $(`#${this.options.name}`).data("DateTimePicker").date();
    }

    get date(): Date {
        return this.moment.toDate();
    }
}
export class DateControl extends DateTimeControl {
    private adjust: InitDateTime | undefined;

    constructor(options: FieldOptionsBasic, adjust?: InitDateTime) {
        super(options);
        this.adjust = adjust;
    }

    init() {
        const opts = this.options as FieldOptionsDatetimePicker;
        const initArgs = {
            id: opts.name,
            inline: true,
            sideBySide: true,
        } as FieldInitDateTimePicker;
        if (this.adjust) initArgs.dateInit = this.adjust;
        initDatePicker(initArgs);
    }

    get moment(): Moment {
        // the returned date is midnight the day before the selected date so we add a day
        return $(`#${this.options.name}`).data("DateTimePicker").date();
    }
}
export class NumberControl extends UIControl {
    constructor(options: FieldOptionsBasic) {
        super(options);
    }

    get float(): number {
        return Number.parseFloat(this.value);
    }
    get int(): number {
        return Number.parseInt(this.value);
    }
}

export class UICatalog {
    private controls = new Map<string, UIControl>();

    init() {
        for (let v of this.controls.values()) v.init();
    }

    get(name: string): UIControl {
        const ctrl = this.controls.get(name);
        if (!ctrl) throw new Error(`Unable to find control by name <${name}>`);
        return ctrl;
    }

    value(name: string): string {
        return this.get(name).value;
    }

    dropdown(options: FieldOptionsDropdown): string {
        const html = dropdown(options);
        this.controls.set(options.name, new DropdownControl(options));
        return html;
    }

    textField(options: FieldOptionsText): string {
        const html = textField(options);
        this.controls.set(options.name, new UIControl(options));
        return html;
    }

    disabledTextField(options: FieldOptionsDisabledText): string {
        const html = disabledTextField(options);
        this.controls.set(options.name, new UIControl(options));
        return html;
    }

    toggleButton(options: FieldOptionsToggleButton): string {
        const html = toggleButton(options);
        this.controls.set(options.name, new ToggleButtonControl(options));
        return html;
    }

    numberField(options: FieldOptionsNumber): string {
        const html = numberField(options);
        this.controls.set(options.name, new NumberControl(options));
        return html;
    }

    datepicker(options: FieldOptionsDatetimePicker, adjust?: InitDateTime): string {
        const html = datetimepicker(options);
        this.controls.set(options.name, new DateControl(options, adjust));
        return html;
    }

    datetimepicker(options: FieldOptionsDatetimePicker): string {
        const html = datetimepicker(options);
        this.controls.set(options.name, new DateTimeControl(options));
        return html;
    }
}

export abstract class Form<T> {
    protected eventTarget = new EventTarget();
    protected ctx? : T;
    readonly name: string;
    readonly title: string;
    private catalog = new UICatalog();
    
    constructor(name: string, title: string, ctx?: T) {
        this.name = name;
        this.title = title;
        this.ctx = ctx;
    }
    
    formHTML(): string {
        return `
        <div class="modal fade" id="${this.name}Modal" tabindex="-1" role="dialog" aria-labelledby="${
            this.name
        }ModalLabel" aria-hidden="true">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="${this.name}ModalLabel">${this.title}</h5>
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        ${this.body(this.catalog)}
                    </div>
                    <div class="modal-footer">
                        ${this.footer()}
                    </div>
                </div>
            </div>
        </div>`;
    }
    protected abstract body(catalog: UICatalog): string;
    protected footer(): string {
        return buttonClose();
    }
    async getData(catalog: UICatalog) : Promise<FormData> {
        return {} as FormData;
    }

    addEventListener(type: FormEvent, cb: EventListenerOrEventListenerObject) {
        this.eventTarget.addEventListener(type, cb);
        return this;
    }
    removeEventListener(type: FormEvent, cb: EventListenerOrEventListenerObject) {
        this.eventTarget.removeEventListener(type, cb);
        return this;
    }

    hide() {
        removeForm();
        this.eventTarget.dispatchEvent(new Event(EVENTS.close));
    }

    async show() {
        // get form root element
        const elem = $(`#${ID_ELEM_FORM}`);

        try {
            // set html for the form
            const html = this.formHTML();
            elem.html(html);

            // init the catalog
            this.catalog.init();

            // emit init event
            this.eventTarget.dispatchEvent(new InitEvent(this.catalog));

            // show dialog
            //@ts-ignore
            $(`#${this.name}Modal`).modal("show");
            this.eventTarget.dispatchEvent(new Event(EVENTS.show));

            // init click handlers
            $(`#${this.name}Modal`).on("click", (evt) => {
                if (evt.target.id === "performAction") return;
                const rel = evt.target.getAttribute("rel");
                if (rel) {
                    this.eventTarget.dispatchEvent(new ClickEvent(rel));
                }
            });

            const performAction = $("#performAction");
            if (performAction) {
                performAction.on("click", async () => {
                    // validate form
                    const formObj = document.querySelector(`#${this.name}Form`);
                    //@ts-ignore
                    if (formObj && !formObj.checkValidity()) {
                        formObj.classList.add("was-validated");
                        this.eventTarget.dispatchEvent(new Event(EVENTS.failedValidation));
                        return;
                    }

                    // get data
                    const data = await this.getData(this.catalog);
                    this.eventTarget.dispatchEvent(new DataEvent(data));

                    // close 
                    this.hide();
                });
            }

        } catch (err) {
            new ErrorForm(err).show();
        }
    }
};

export class ErrorForm extends Form<Error> {
    constructor(err: Error) {
        super("error", "Oooops!", err);
    }

    body() {
        return this.ctx!.message;
    }
}

/*
const DEVICE_EDIT_WATCHDOG = {
    "name": "watchdog",
    "html": (formname, ctx) => {
        return {
            "html": `<div class="modal fade" id="${formname}Modal" tabindex="-1" role="dialog" aria-labelledby="${formname}ModalLabel" aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="${formname}ModalLabel">Watchdog</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    <p>
                    This dialog allows you to change the watchdog settings for the selected 
                    device. You may indicate whether notifications about the device is on (i.e. sent), 
                    off (i.e. NOT sent) or muted. If muted you have to specify a date/time the notifications 
                    are muted until. After that date/time notifications are sent as if the watchdog was set to 
                    "on".
                    </p>
                    <p>
                    Remember that watchdogs are personal and these settings only applies to you.
                    </p>
                    ${dropdown({
                        name: "state", 
                        label: "State", 
                        fieldExplanation: "Select the state to set for the device watchdog", 
                        dropdownOptions: {
                            "yes": "On",
                            "no": "Off",
                            "muted": "Muted"
                        }, 
                        addBlank: false, 
                        required: true, 
                        validationText: "You must specify a watchdog state"
                    })}
                    ${datetimepicker({
                        name: "dt", 
                        label: "Muted until", 
                        fieldExplanation: "Specify the muted until date/time"
                    })}
                </div>
                <div class="modal-footer">
                    ${button({
                        text: "Save", 
                        rel: "save"
                    })}
                    ${buttonClose("Cancel")}
                </div>
            </div>
        </div>
    </div>`,
        "callback": () => {
            initDateTimePicker({
                id: "dt"
            });
        }};
    },
    device: undefined,
    "fnInit": (formdata, device) => {
        formdata.device = device;
        return fetcher.graphql(`{device(id:"${device.id}"){id,name,watchdog{notify,muted_until}}}`).then(data => {
            const wd = data.device.watchdog;
            if (wd.muted_until) {
                $("#dt").data("DateTimePicker").date(moment(wd.muted_until).set("seconds", 0).set("milliseconds", 0));
            } else {
                $("#dt").data("DateTimePicker").date(moment().set("minutes", 0).set("seconds", 0).set("milliseconds", 0).add(1, "hour"));
            }
            $("#stateInput").val(wd.notify);
            return Promise.resolve();
        })
        
    },
    "fnClickHandler": (formdata, house, rel) => {
        if (rel === "save") {
            const state = $("#stateInput").val();
            const mutedUntil = state === "muted" ? $("#dt").data("DateTimePicker").date() : undefined;
            
            // update
            fetcher.graphql(`mutation{updateDeviceWatchdog(data:{id:"${formdata.device.id}",notify:"${state}", muted_until: ${mutedUntil ? `"${mutedUntil.toISOString()}"` : "\"\""}}){id,name}}`).then(() => {
                // close form
                removeForm();    
            })
        }
    }
}

*/