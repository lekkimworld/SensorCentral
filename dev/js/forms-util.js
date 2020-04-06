//const $ = require("jquery");

const HTML_MANUAL_SAMPLE = `<div class="modal fade" id="sampleModal" tabindex="-1" role="dialog" aria-labelledby="sampleModalLabel" aria-hidden="true">
<div class="modal-dialog" role="document">
    <div class="modal-content">
        <div class="modal-header">
            <h5 class="modal-title" id="sampleModalLabel">Create/Edit Sample</h5>
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
        </div>
        <div class="modal-body">
            <form id="sampleForm" novalidate>
                <div class="form-group">
                    <label for="idInput">Sensor ID</label>
                    <input type="text" required class="form-control" id="idInput" aria-describedby="nameHelp">
                </div>
                <div class="form-group">
                    <label for="dtInput">Date/time</label>
                    <div class='input-group date' id='datetimepicker1'>
                        <input type='text' class="form-control" />
                        <span class="input-group-addon">
                            <span class="fa fa-calendar"></span>
                        </span>
                    </div>
                    <small id="dtHelp" class="form-text text-muted">Specify the sample date/time.</small>
                    <div class="invalid-feedback">
                        You must specify the date/time for the sample.
                    </div>
                </div>
                <div class="form-group">
                    <label for="sampleInput">Sample</label>
                    <input type="number" step=".0001" required class="form-control" id="sampleInput" aria-describedby="sampleHelp" placeholder="Enter sample value">
                    <small id="sampleHelp" class="form-text text-muted">Specify the sample value (must be a number).</small>
                    <div class="invalid-feedback">
                        You must specify the sample value for the sensor. Must be a number.
                    </div>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
            <button type="button" class="btn btn-primary" id="save">Save changes</button>
        </div>
    </div>
</div>
</div>`

module.exports = {
    appendManualSampleForm: (elem, sensor, onSave) => {
        // append html to page
        elem.html(HTML_MANUAL_SAMPLE);

        // init date picker
        $('#datetimepicker1').datetimepicker({
            locale: 'da_dk',
            inline: true,
            sideBySide: true,
            icons: {
                time: "fa fa-clock-o",
                date: "fa fa-calendar",
                up: "fa fa-arrow-up",
                down: "fa fa-arrow-down",
                next: "fa fa-arrow-right",
                previous: "fa fa-arrow-left"
            }
        });
        
        // disable id-field
        $("#idInput").prop("disabled", true);
        $("#idInput").val(sensor.id);

        // show dialog
        $("#sampleModal").modal("show");

        // add save handler
        $("#save").on("click", () => {
            // validate form
            const form = document.querySelector("#sampleForm");
            if (!form.checkValidity()) {
                form.classList.add('was-validated');
                return;
            }

            // build return data
            const data = {
                "date": $('#datetimepicker1').data("DateTimePicker").date(),
                "value": Number.parseFloat($("#sampleInput").val())
            }

            // remove form
            form.classList.remove('was-validated');
            $("#sensorModal").modal("hide"); 
            $('.modal-backdrop').remove();
            $('body').removeClass('modal-open');
            elem.html("");

            // callback
            onSave(data);
        });
    }
}