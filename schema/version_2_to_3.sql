alter table DEVICE drop column notify;
alter table DEVICE drop column muted_until;

create type NOTIFY_METHOD as ENUM ('email','pushover');
create table LOGIN_USER (id character varying(36) not null primary key, email character varying(128) not null, default_notify_using NOTIFY_METHOD, pushover_userkey character varying(36), pushover_apptoken character varying(36));

create type SENSOR_TYPE as ENUM ('temp', 'hum');
alter table sensor add column type_new SENSOR_TYPE not null default 'temp';
update sensor set type_new='temp' where id in (select id from sensor where type='temp');
update sensor set type_new='hum' where id in (select id from sensor where type='hum');
alter table sensor drop column type;
alter table sensor rename column type_new type;
alter table SENSOR add constraint SENSOR_LABEL_UNIQUE UNIQUE (label);

create table DEVICE_WATCHDOG (userId character varying(36) not null, deviceId character varying(36) not null, notify integer not null default 1, muted_until timestamp without time zone);
alter table DEVICE_WATCHDOG add foreign key (userId) references LOGIN_USER (id);
alter table DEVICE_WATCHDOG add foreign key (deviceId) references DEVICE (id) on delete cascade;

update DATABASE_VERSION set version=3;
