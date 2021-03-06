alter table DEVICE drop column notify;
alter table DEVICE drop column muted_until;
alter table device add column last_ping timestamp with time zone;
alter table device add column last_restart timestamp with time zone;
alter table device add column last_watchdog_reset timestamp with time zone;

create type NOTIFY_METHOD as ENUM ('email','pushover');
create table LOGIN_USER (id character varying(36) not null primary key, google_sub character varying(128), email character varying(128) not null, fn character varying(128), ln character varying(128), default_notify_using NOTIFY_METHOD, pushover_userkey character varying(36), pushover_apptoken character varying(36));
alter table LOGIN_USER add constraint USER_EMAIL_UNIQUE UNIQUE (email);
alter table LOGIN_USER add constraint GOOGLE_SUB_UNIQUE UNIQUE (google_sub);

create type SENSOR_TYPE as ENUM ('temp', 'hum');
alter table sensor add column type_new SENSOR_TYPE not null default 'temp';
update sensor set type_new='temp' where id in (select id from sensor where type='temp');
update sensor set type_new='hum' where id in (select id from sensor where type='hum');
alter table sensor drop column type;
alter table sensor rename column type_new to type;

create type DEVICE_NOTIFY_ENABLED as ENUM ('yes','no','muted');
create table DEVICE_WATCHDOG (userId character varying(36) not null, deviceId character varying(36) not null, notify DEVICE_NOTIFY_ENABLED not null default 'yes', muted_until timestamp without time zone);
alter table DEVICE_WATCHDOG add foreign key (userId) references LOGIN_USER (id) on delete cascade;
alter table DEVICE_WATCHDOG add foreign key (deviceId) references DEVICE (id) on delete cascade;

create table FAVORITE_SENSOR (userId character varying(36) not null, sensorId character varying(36) not null);
alter table FAVORITE_SENSOR add primary key (userId, sensorId);
alter table FAVORITE_SENSOR add foreign key (userId) references LOGIN_USER (id) on delete cascade;
alter table FAVORITE_SENSOR add foreign key (sensorId) references SENSOR (id) on delete cascade;

update DATABASE_VERSION set version=3;
