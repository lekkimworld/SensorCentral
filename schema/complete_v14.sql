create table DATABASE_VERSION (version int not null);
insert into DATABASE_VERSION (version) values (14);

create table HOUSE (id character varying(36) not null primary key, name character varying(128) not null);
alter table HOUSE add constraint HOUSE_NAME_UNIQUE UNIQUE (name);

create table DEVICE (id character varying(36) not null primary key, name character varying(128) not null, houseid character varying(36) not null, last_ping timestamp with time zone, last_restart timestamp with time zone, active boolean not null default true);
alter table DEVICE add foreign key (houseid) references house (id) on delete cascade;

create type NOTIFY_METHOD as ENUM ('email','pushover');

create table LOGIN_USER (id character varying(36) not null primary key, email character varying(128), fn character varying(128) not null, ln character varying(128) not null);

create table login_oidc_mapping (
    userid character varying(36) not null, 
    provider character varying(36) not null, 
    sub character varying(128) not null,
    verified boolean not null default false
);
alter table login_oidc_mapping add foreign key (userid) references login_user(id);
alter table login_oidc_mapping add primary key (userid, provider);

create table PUSHOVER_INFO (userId character varying(36) not null, userkey character varying(36) not null, apptoken character varying(36) not null);
alter table pushover_info add primary key (userid);
alter table PUSHOVER_INFO ADD FOREIGN KEY (userId) REFERENCES LOGIN_USER(id) ON DELETE CASCADE;

create table USER_HOUSE_ACCESS (userId character varying(36) not null, houseId character varying(36) not null, owner boolean default false not null, is_default boolean default false not null);
alter table USER_HOUSE_ACCESS ADD FOREIGN KEY (houseId) REFERENCES HOUSE(id) ON DELETE CASCADE;
alter table USER_HOUSE_ACCESS ADD FOREIGN KEY (userId) REFERENCES LOGIN_USER(id) ON DELETE CASCADE;
alter table USER_HOUSE_ACCESS ADD PRIMARY KEY (userId, houseId);

create type SENSOR_TYPE as ENUM ('gauge', 'counter', 'delta', 'binary');
create table SENSOR (id character varying(36) not null primary key, name character varying(128) not null, deviceid character varying(36) not null, icon character varying(36) not null, type SENSOR_TYPE not null, label character varying(128), scalefactor real not null default 1);
alter table SENSOR add foreign key (deviceid) references device (id) on delete cascade;

create table SENSOR_DATA (id character varying(36) not null, dt timestamp with time zone not null, value real not null, from_dt timestamp with time zone);
create index on SENSOR_DATA (dt desc);

create table FAVORITE_SENSOR (userId character varying(36) not null, sensorId character varying(36) not null);
alter table FAVORITE_SENSOR add primary key (userId, sensorId);
alter table FAVORITE_SENSOR add foreign key (userId) references LOGIN_USER (id) on delete cascade;
alter table FAVORITE_SENSOR add foreign key (sensorId) references SENSOR (id) on delete cascade;

create table POWERMETER_DATA (id character varying(36) not null, dt timestamp with time zone not null, ActiveEnergyTotalExport real not null, ActiveEnergyTotalImport real not null, ActivePowerPhaseL1 real, ActivePowerPhaseL2 real, ActivePowerPhaseL3 real, ActivePowerTotal real not null, CurrentPhaseL1 real, CurrentPhaseL2 real, CurrentPhaseL3 real, VoltagePhaseL1 real, VoltagePhaseL2 real, VoltagePhaseL3 real);
create index on POWERMETER_DATA (dt desc);

CREATE TABLE POWERMETER_SUBSCRIPTION (houseid character varying(36) not null, sensorid character varying(36) not null, frequency int not null, ciphertext character varying(256) not null);
ALTER TABLE POWERMETER_SUBSCRIPTION ADD PRIMARY KEY (houseid, sensorid);
ALTER TABLE POWERMETER_SUBSCRIPTION ADD FOREIGN KEY (houseid) REFERENCES HOUSE(id) ON DELETE CASCADE;
ALTER TABLE POWERMETER_SUBSCRIPTION ADD FOREIGN KEY (sensorid) REFERENCES SENSOR(id) ON DELETE CASCADE;


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

CREATE FUNCTION alert_pushover_valid_check() RETURNS trigger AS $alert_pushover_valid_check$
    DECLARE
        pushover_userkey character varying(36);
        sensor_ids character varying(36)[];
        device_ids character varying(36)[];
    BEGIN
        /* verify user has pushover enabled */
        IF NEW.notify_type = 'pushover' THEN
            SELECT userkey into pushover_userkey from pushover_info where userid=NEW.userId;
            IF pushover_userkey IS NULL THEN
                RAISE EXCEPTION 'User with ID % has no pushover_info record', NEW.userid;
            END IF;
        END IF;

        /* verify device id */
        IF NOT NEW.deviceId IS NULL THEN
            device_ids := ARRAY(select d.id from device d, house h where d.houseid=h.id and h.id in (select houseid from user_house_access where userid=NEW.userId));
            IF NOT NEW.deviceId = ANY(device_ids) THEN
                RAISE EXCEPTION 'User with ID % does not have access to specified device %', NEW.userid, NEW.deviceid;
            END IF;
        END IF;

        /* verify sensor id */
        IF NOT NEW.sensorId IS NULL THEN
            sensor_ids := ARRAY(select s.id from sensor s, device d, house h where s.deviceid=d.id and d.houseid=h.id and h.id in (select houseid from user_house_access where userid=NEW.userId));
            IF NOT NEW.sensorId = ANY(sensor_ids) THEN
                RAISE EXCEPTION 'User with ID % does not have access to specified sensor %', NEW.userid, NEW.sensorid;
            END IF;
        END IF;

        RETURN NEW;
    END;
$alert_pushover_valid_check$ LANGUAGE plpgsql;

CREATE TRIGGER alert_pushover_valid_check BEFORE INSERT OR UPDATE ON ALERT FOR EACH ROW EXECUTE PROCEDURE alert_pushover_valid_check();
