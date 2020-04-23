alter table DEVICE drop column notify;
alter table DEVICE drop column muted_until;

create type NOTIFY_METHOD as ENUM ('email','pushover');
create table LOGIN_USER (id character varying(36) not null primary key, google_sub character varying(128), email character varying(128) not null, fn character varying(128), ln character varying(128), default_notify_using NOTIFY_METHOD, pushover_userkey character varying(36), pushover_apptoken character varying(36));
alter table LOGIN_USER add constraint USER_EMAIL_UNIQUE UNIQUE (email);
alter table LOGIN_USER add constraint GOOGLE_SUB_UNIQUE UNIQUE (google_sub);

create type SENSOR_TYPE as ENUM ('temp', 'hum');
alter table sensor add column type_new SENSOR_TYPE not null default 'temp';
update sensor set type_new='temp' where id in (select id from sensor where type='temp');
update sensor set type_new='hum' where id in (select id from sensor where type='hum');
alter table sensor drop column type;
alter table sensor rename column type_new type;
alter table SENSOR add constraint SENSOR_LABEL_UNIQUE UNIQUE (label);

create table DEVICE_WATCHDOG (userId character varying(36) not null, deviceId character varying(36) not null, notify integer not null default 1, muted_until timestamp without time zone);
alter table DEVICE_WATCHDOG add foreign key (userId) references LOGIN_USER (id) on delete cascade;
alter table DEVICE_WATCHDOG add foreign key (deviceId) references DEVICE (id) on delete cascade;

update DATABASE_VERSION set version=3;
