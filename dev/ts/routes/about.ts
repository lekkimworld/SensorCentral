export default (elemRoot: JQuery<HTMLElement>) => {
    elemRoot.html(`<div class="jumbotron">
    <div class="row">
        <div class="col-lg-12 col-md-12 col-sm-12">
            <h1>About</h1>
            <p>
                SensorCentral is <a href="https://lekkimworld.com" target="_new">my</a> application to ingest 
                sensor readings from my house and other places where sensors are placed. To use the application 
                you need to authenticate. And no - I do not create accounts for other people but you are welcome 
                to use the application as I publish it on 
                <a href="https://github.com/lekkimworld/sensorcentral" target="_new">github.com/lekkimworld/sensorcentral</a>.
            </p>
            <p>
                I run the application in Docker on <a href="https://www.digitalocean.com" target="_new">Digital Ocean</a> and keep  
                data in Postgres, Redis and use RabbitMQ for messaging.
            </p>
        </div>
    </div>
</div>`);
}
