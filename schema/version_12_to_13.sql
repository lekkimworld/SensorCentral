alter table device drop column last_watchdog_reset;
alter table sensor alter column label drop not null;
alter table login_user drop column default_notify_using;

create table PUSHOVER_INFO (
    userId character varying(36) not null, 
    userkey character varying(36) not null, 
    apptoken character varying(36) not null
);
alter table pushover_info add primary key (userid);
alter table PUSHOVER_INFO ADD FOREIGN KEY (userId) REFERENCES LOGIN_USER(id) ON DELETE CASCADE;

insert into PUSHOVER_INFO (userId, userkey, apptoken) 
    select id, pushover_userkey, pushover_apptoken 
    from LOGIN_USER 
    where not pushover_userkey is null and pushover_userkey != '';
alter table LOGIN_USER drop column pushover_userkey;
alter table LOGIN_USER drop column pushover_apptoken;

drop table DEVICE_WATCHDOG;
drop type DEVICE_NOTIFY_ENABLED;

create type ALERT_EVENT as ENUM (
    'onDeviceTimeout',
    'onDeviceRestart',
    'onDeviceMessage',
    'onSensorTimeout',
    'onSensorSample',
    'onSensorValue'
);
create table ALERT (
    id character varying(36) primary key,
    active boolean not null default true,
    userId character varying(36) not null, 
    deviceId character varying(36), 
    sensorId character varying(36), 
    description character varying(128),
    notify_type NOTIFY_METHOD not null,
    notify_data json,
    event_type ALERT_EVENT not null,
    event_data json not null
);
alter table ALERT ADD FOREIGN KEY (userId) REFERENCES LOGIN_USER(id) ON DELETE CASCADE;
alter table ALERT ADD FOREIGN KEY (deviceId) REFERENCES DEVICE(id) ON DELETE CASCADE;
alter table ALERT ADD FOREIGN KEY (sensorId) REFERENCES SENSOR(id) ON DELETE CASCADE;
alter table ALERT ADD CONSTRAINT deviceid_or_sensorid CHECK ((NOT sensorId IS NULL AND deviceId IS NULL) OR (sensorId IS NULL AND NOT deviceId IS NULL));

CREATE FUNCTION alert_pushover_valid_check() RETURNS trigger LANGUAGE plpgsql AS $$ 
    DECLARE
        pushover_userkey character varying(36);
        sensor_ids character varying(36)[];
        device_ids character varying(36)[];
    BEGIN
        IF NEW.notify_type = 'pushover' THEN
            SELECT userkey into pushover_userkey from pushover_info where userid=NEW.userId;
            IF pushover_userkey IS NULL THEN
                RAISE EXCEPTION 'User with ID % has no pushover_info record', NEW.userid;
            END IF;
        END IF;

        IF NOT NEW.deviceId IS NULL THEN
            device_ids := ARRAY(select d.id from device d, house h where d.houseid=h.id and h.id in (select houseid from user_house_access where userid=NEW.userId));
            IF NOT NEW.deviceId = ANY(device_ids) THEN
                RAISE EXCEPTION 'User with ID % does not have access to specified device %', NEW.userid, NEW.deviceid;
            END IF;
        END IF;

        IF NOT NEW.sensorId IS NULL THEN
            sensor_ids := ARRAY(select s.id from sensor s, device d, house h where s.deviceid=d.id and d.houseid=h.id and h.id in (select houseid from user_house_access where userid=NEW.userId));
            IF NOT NEW.sensorId = ANY(sensor_ids) THEN
                RAISE EXCEPTION 'User with ID % does not have access to specified sensor %', NEW.userid, NEW.sensorid;
            END IF;
        END IF;

        RETURN NEW;
    END;
$$;

CREATE TRIGGER alert_pushover_valid_check BEFORE INSERT OR UPDATE ON ALERT FOR EACH ROW EXECUTE PROCEDURE alert_pushover_valid_check();

update DATABASE_VERSION set version=13;
