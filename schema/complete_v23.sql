CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

create table DATABASE_VERSION (version int not null);
insert into DATABASE_VERSION (version) values (23);

create table HOUSE (id character varying(36) not null primary key, name character varying(128) not null);
alter table HOUSE add constraint HOUSE_NAME_UNIQUE UNIQUE (name);

create table DEVICE (id character varying(36) not null primary key, name character varying(128) not null, houseid character varying(36) not null, last_ping timestamp with time zone, last_restart timestamp with time zone, active boolean not null default true, timeout_seconds integer);
alter table DEVICE add foreign key (houseid) references house (id) on delete cascade;

create table LOGIN_USER (
    id character varying(36) not null primary key,
    email character varying(128),
    fn character varying(128) not null,
    ln character varying(128) not null
);

create table login_oidc_mapping (
    userid character varying(36) not null,
    provider character varying(36) not null,
    sub character varying(128) not null,
    verified boolean not null default false
);
alter table login_oidc_mapping add foreign key (userid) references login_user(id);
alter table login_oidc_mapping add primary key (userid, provider);

create table USER_HOUSE_ACCESS (userId character varying(36) not null, houseId character varying(36) not null, owner boolean default false not null, is_default boolean default false not null);
alter table USER_HOUSE_ACCESS ADD FOREIGN KEY (houseId) REFERENCES HOUSE(id) ON DELETE CASCADE;
alter table USER_HOUSE_ACCESS ADD FOREIGN KEY (userId) REFERENCES LOGIN_USER(id) ON DELETE CASCADE;
alter table USER_HOUSE_ACCESS ADD PRIMARY KEY (userId, houseId);

create type SENSOR_TYPE as ENUM ('gauge', 'counter', 'delta', 'binary');
create table SENSOR (id character varying(36) not null primary key, name character varying(128) not null, deviceid character varying(36) not null, icon character varying(36) not null, type SENSOR_TYPE not null, label character varying(128), scalefactor real not null default 1, timeout_seconds integer);
alter table SENSOR add foreign key (deviceid) references device (id) on delete cascade;

create table SENSOR_DATA (id character varying(36) not null, dt timestamp with time zone not null, value real not null, from_dt timestamp with time zone);
create index on SENSOR_DATA (dt desc);

create table FAVORITE_SENSOR (userId character varying(36) not null, sensorId character varying(36) not null);
alter table FAVORITE_SENSOR add primary key (userId, sensorId);
alter table FAVORITE_SENSOR add foreign key (userId) references LOGIN_USER (id) on delete cascade;
alter table FAVORITE_SENSOR add foreign key (sensorId) references SENSOR (id) on delete cascade;

create table POWERMETER_DATA (id character varying(36) not null, dt timestamp with time zone not null, ActiveEnergyTotalExport real not null, ActiveEnergyTotalImport real not null, ActivePowerPhaseL1 real, ActivePowerPhaseL2 real, ActivePowerPhaseL3 real, ActivePowerTotal real not null, CurrentPhaseL1 real, CurrentPhaseL2 real, CurrentPhaseL3 real, VoltagePhaseL1 real, VoltagePhaseL2 real, VoltagePhaseL3 real);
create index on POWERMETER_DATA (dt desc);

create type HTTP_METHOD as ENUM (
    'GET',
    'POST'
);

create type HTTP_CONTENTTYPE as ENUM (
    'FORM',
    'JSON'
);

create type CALLOUT_AUTHENTICATOR_TEMPLATE as ENUM (
    'STATIC_BEARERTOKEN',
    'DATACLOUD_CLIENTCREDENTIALS',
    'DATACLOUD_WEBSDK',
    'CLIENTCREDENTIALS_OAUTH'
);

create table callout_secret (
    id character varying(36) not null primary key default uuid_generate_v4(),
    userid  character varying(36) not null,
    name character varying(36) not null,
    value  character varying(1024) not null,
    system_managed boolean not null default false
);
alter table callout_secret add constraint SECRET_NAME_UNIQUE_PER_USER UNIQUE (userid, name);
alter table callout_secret ADD FOREIGN KEY (userid) REFERENCES LOGIN_USER (id) ON DELETE CASCADE;

create table callout_endpoint (
    id character varying(36) not null primary key default uuid_generate_v4(),
    name character varying(128) not null,
    userid character varying(36) not null,
    baseurl character varying(128) not null,
    system_managed boolean not null default false
);
alter table callout_endpoint ADD FOREIGN KEY (userid) REFERENCES LOGIN_USER (id) ON DELETE CASCADE;

create table callout_authenticator (
    id character varying(36) not null primary key default uuid_generate_v4(),
    userid  character varying(36) not null,
    name character varying(36) not null,
    endpointid character varying(36) not null,
    template CALLOUT_AUTHENTICATOR_TEMPLATE not null,
    system_managed boolean not null default false
);
alter table callout_authenticator add foreign key (endpointid) references callout_endpoint (id) on delete cascade;
alter table callout_authenticator add foreign key (userid) references login_user (id) on delete cascade;
alter table callout_authenticator add constraint CALLOUT_AUTHNAME_UNIQUE_PER_USER UNIQUE (userid, name);

create table callout_authenticator_replacement (
    id character varying(36) not null primary key default uuid_generate_v4(),
    name  character varying(36) not null,
    secretid character varying(36) not null,
    authenticatorid character varying(36) not null
);
alter table callout_authenticator_replacement add foreign key (secretid) references callout_secret (id) on delete cascade;
alter table callout_authenticator_replacement add foreign key (authenticatorid) references callout_authenticator (id) on delete cascade;
alter table callout_authenticator_replacement add constraint CALLOUT_AUTH_PLACEMENT_NAME_UNIQUE UNIQUE (authenticatorid, name);

create table callout (
    id character varying(36) not null primary key default uuid_generate_v4(),
    userid  character varying(36) not null,
    name character varying(36) not null,
    endpointid character varying(36) not null,
    method HTTP_METHOD not null,
    authenticatorid character varying(36),
    path_template character varying(128) not null,
    body_template character varying(1024),
    content_type character varying(64) default 'application/json',
    system_managed boolean not null default false
);
alter table callout add foreign key (userid) references login_user (id) on delete cascade;
alter table callout add foreign key (endpointid) references callout_endpoint (id) on delete cascade;
alter table callout add foreign key (authenticatorid) references callout_authenticator (id) on delete cascade;
alter table callout add constraint CALLOUT_NAME_UNIQUE_PER_USER UNIQUE (userid, name);

create type event_trigger_type AS ENUM (
    'onSensorSample',
    'onSensorTimeout',
    'onDeviceTimeout'
);

create type event_action_type AS ENUM (
    'persist_value',
    'callout'
);

create table event_definition (
    id character varying(36) not null primary key default uuid_generate_v4(),
    userid character varying(36),
    sensorid character varying(36),
    deviceid character varying(36),
    active boolean not null default true,
    trigger_type event_trigger_type not null,
    action_type event_action_type not null,
    action_config jsonb not null default '{}',
    CONSTRAINT event_target_check CHECK (
        (sensorid IS NOT NULL AND deviceid IS NULL) OR
        (sensorid IS NULL AND deviceid IS NOT NULL)
    )
);
alter table event_definition add foreign key (userid) references login_user(id) on delete cascade;
alter table event_definition add foreign key (sensorid) references sensor(id) on delete cascade;
alter table event_definition add foreign key (deviceid) references device(id) on delete cascade;
create index idx_event_def_sensor_trigger on event_definition(sensorid, trigger_type) where sensorid is not null;
create index idx_event_def_device_trigger on event_definition(deviceid, trigger_type) where deviceid is not null;

create table jwt_issuers (
    id character varying(36) not null primary key default uuid_generate_v4(),
    houseid character varying(36) not null,
    issuer character varying(256) not null,
    public_key character varying(5120) not null
);
alter table jwt_issuers ADD FOREIGN KEY (houseid) REFERENCES HOUSE(id) ON DELETE CASCADE;

create type cron_job_type AS ENUM ('smartme_powermeter');

create table cron_job (
    id character varying(36) not null primary key default uuid_generate_v4(),
    userid character varying(36) not null,
    job_type cron_job_type not null,
    active boolean not null default true,
    frequency_minutes integer not null default 5,
    config jsonb not null default '{}',
    callout_id character varying(36),
    sensor_id character varying(36),
    house_id character varying(36)
);
alter table cron_job add foreign key (userid) references login_user(id) on delete cascade;
alter table cron_job add foreign key (callout_id) references callout(id) on delete set null;
alter table cron_job add foreign key (sensor_id) references sensor(id) on delete cascade;
alter table cron_job add foreign key (house_id) references house(id) on delete cascade;
