create table DATABASE_VERSION (version int not null);
insert into DATABASE_VERSION (version) values (5);

create table HOUSE (id character varying(36) not null primary key, name character varying(128) not null);
alter table HOUSE add constraint HOUSE_NAME_UNIQUE UNIQUE (name);

create table DEVICE (id character varying(36) not null primary key, name character varying(128) not null, houseid character varying(36) not null, last_ping timestamp with time zone, last_restart timestamp with time zone, last_watchdog_reset timestamp with time zone, active boolean not null default true);
alter table DEVICE add foreign key (houseid) references house (id) on delete cascade;

create type NOTIFY_METHOD as ENUM ('email','pushover');
create table LOGIN_USER (id character varying(36) not null primary key, google_sub character varying(128), email character varying(128) not null, fn character varying(128) not null, ln character varying(128) not null, default_notify_using NOTIFY_METHOD, pushover_userkey character varying(36), pushover_apptoken character varying(36));
alter table LOGIN_USER add constraint USER_EMAIL_UNIQUE UNIQUE (email);
alter table LOGIN_USER add constraint GOOGLE_SUB_UNIQUE UNIQUE (google_sub);

create type DEVICE_NOTIFY_ENABLED as ENUM ('yes','no','muted');
create table DEVICE_WATCHDOG (userId character varying(36) not null, deviceId character varying(36) not null, notify DEVICE_NOTIFY_ENABLED not null default 'yes', muted_until timestamp without time zone);
alter table DEVICE_WATCHDOG add foreign key (userId) references LOGIN_USER (id) on delete cascade;
alter table DEVICE_WATCHDOG add foreign key (deviceId) references DEVICE (id) on delete cascade;

create type SENSOR_TYPE as ENUM ('gauge', 'counter', 'delta');
create table SENSOR (id character varying(36) not null primary key, name character varying(128) not null, deviceid character varying(36) not null, icon character varying(36) not null, type SENSOR_TYPE not null, label character varying(128) not null);
alter table SENSOR add foreign key (deviceid) references device (id) on delete cascade;

create table SENSOR_DATA (id character varying(36) not null, dt timestamp with time zone not null, value real not null, from_dt timestamp with time zone);
create index on SENSOR_DATA (dt desc);

create table FAVORITE_SENSOR (userId character varying(36) not null, sensorId character varying(36) not null);
alter table FAVORITE_SENSOR add primary key (userId, sensorId);
alter table FAVORITE_SENSOR add foreign key (userId) references LOGIN_USER (id) on delete cascade;
alter table FAVORITE_SENSOR add foreign key (sensorId) references SENSOR (id) on delete cascade;

create table SMARTME_SUBSCRIPTION (clientId character varying(36) not null primary key, sensorId character varying(128) not null, login_user_id character varying(36) not null, username character varying(128) not null, password character varying(128) not null);
alter table SMARTME_SUBSCRIPTION add foreign key (login_user_id) references LOGIN_USER (id) on delete cascade;
alter table smartme_subscription add foreign key (sensorid) references SENSOR (id) on delete cascade;
