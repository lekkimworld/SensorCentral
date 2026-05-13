CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

create table DATABASE_VERSION (version int not null);
insert into DATABASE_VERSION (version) values (18);

create table HOUSE (id character varying(36) not null primary key, name character varying(128) not null);
alter table HOUSE add constraint HOUSE_NAME_UNIQUE UNIQUE (name);

create table DEVICE (id character varying(36) not null primary key, name character varying(128) not null, houseid character varying(36) not null, last_ping timestamp with time zone, last_restart timestamp with time zone, active boolean not null default true);
alter table DEVICE add foreign key (houseid) references house (id) on delete cascade;

create type NOTIFY_METHOD as ENUM ('email','pushover');

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
    'SMARTME_CLIENTCREDENTIALS'
);

create table callout_secret (
    id character varying(36) not null primary key default uuid_generate_v4(),
    userid  character varying(36) not null,
    name character varying(36) not null,
    value  character varying(1024) not null
);
alter table callout_secret add constraint SECRET_NAME_UNIQUE_PER_USER UNIQUE (userid, name);
alter table callout_secret ADD FOREIGN KEY (userid) REFERENCES LOGIN_USER (id) ON DELETE CASCADE;

create table callout_endpoint (
    id character varying(36) not null primary key default uuid_generate_v4(),
    name character varying(128) not null,
    userid character varying(36) not null,
    baseurl character varying(128) not null
);
alter table callout_endpoint ADD FOREIGN KEY (userid) REFERENCES LOGIN_USER (id) ON DELETE CASCADE;

create table callout_authenticator (
    id character varying(36) not null primary key default uuid_generate_v4(),
    userid  character varying(36) not null,
    name character varying(36) not null,
    endpointid character varying(36) not null,
    template CALLOUT_AUTHENTICATOR_TEMPLATE not null
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
    body_template character varying(1024)
);
alter table callout add foreign key (userid) references login_user (id) on delete cascade;
alter table callout add foreign key (endpointid) references callout_endpoint (id) on delete cascade;
alter table callout add foreign key (authenticatorid) references callout_authenticator (id) on delete cascade;
alter table callout add constraint CALLOUT_NAME_UNIQUE_PER_USER UNIQUE (userid, name);

CREATE TABLE POWERMETER_SUBSCRIPTION (houseid character varying(36) not null, sensorid character varying(36) not null, frequency int not null, calloutid character varying(36) not null);
ALTER TABLE POWERMETER_SUBSCRIPTION ADD PRIMARY KEY (houseid, sensorid);
ALTER TABLE POWERMETER_SUBSCRIPTION ADD FOREIGN KEY (houseid) REFERENCES HOUSE(id) ON DELETE CASCADE;
ALTER TABLE POWERMETER_SUBSCRIPTION ADD FOREIGN KEY (sensorid) REFERENCES SENSOR(id) ON DELETE CASCADE;
ALTER TABLE POWERMETER_SUBSCRIPTION ADD FOREIGN KEY (calloutid) REFERENCES callout(id) ON DELETE CASCADE;

create table event_onsensorsample (
    id character varying(36) not null primary key default uuid_generate_v4(),
    sensorid character varying(36) not null,
    userid  character varying(36) not null,
    calloutid character varying(36) not null
);
alter table event_onsensorsample ADD FOREIGN KEY (userid) REFERENCES LOGIN_USER(id) ON DELETE CASCADE;
alter table event_onsensorsample ADD FOREIGN KEY (sensorid) REFERENCES sensor(id) ON DELETE CASCADE;
alter table event_onsensorsample ADD FOREIGN KEY (calloutid) REFERENCES callout(id) ON DELETE CASCADE;

create table jwt_issuers (
    id character varying(36) not null primary key default uuid_generate_v4(),
    houseid character varying(36) not null,
    issuer character varying(256) not null,
    public_key character varying(5120) not null
);
alter table jwt_issuers ADD FOREIGN KEY (houseid) REFERENCES HOUSE(id) ON DELETE CASCADE;
