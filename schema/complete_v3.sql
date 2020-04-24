create table DATABASE_VERSION (version int not null);
insert into DATABASE_VERSION (version) values (3);

create table HOUSE (id character varying(36) not null primary key, name character varying(128) not null);
alter table HOUSE add constraint HOUSE_NAME_UNIQUE UNIQUE (name);

create table DEVICE (id character varying(36) not null primary key, name character varying(128) not null, houseid character varying(36) not null);
alter table DEVICE add foreign key (houseid) references house (id) on delete cascade;

create type NOTIFY_METHOD as ENUM ('email','pushover');
create table LOGIN_USER (id character varying(36) not null primary key, google_sub character varying(128), email character varying(128) not null, fn character varying(128) not null, ln character varying(128) not null, default_notify_using NOTIFY_METHOD, pushover_userkey character varying(36), pushover_apptoken character varying(36));
alter table LOGIN_USER add constraint USER_EMAIL_UNIQUE UNIQUE (email);
alter table LOGIN_USER add constraint GOOGLE_SUB_UNIQUE UNIQUE (google_sub);

create type DEVICE_NOTIFY_ENABLED as ENUM ('yes','no','muted');
create table DEVICE_WATCHDOG (userId character varying(36) not null, deviceId character varying(36) not null, notify DEVICE_NOTIFY_ENABLED not null default 'yes', muted_until timestamp without time zone);
alter table DEVICE_WATCHDOG add foreign key (userId) references LOGIN_USER (id) on delete cascade;
alter table DEVICE_WATCHDOG add foreign key (deviceId) references DEVICE (id) on delete cascade;

create type SENSOR_TYPE as ENUM ('temp', 'hum');
create table SENSOR (id character varying(36) not null primary key, name character varying(128) not null, deviceid character varying(36) not null, type SENSOR_TYPE not null, label character varying(128) not null default 'foo'::character varying);
alter table SENSOR add foreign key (deviceid) references device (id) on delete cascade;
alter table SENSOR add constraint SENSOR_LABEL_UNIQUE UNIQUE (label);

create table SENSOR_DATA (id character varying(36) not null, dt timestamp with time zone not null, value real not null);
create index on SENSOR_DATA (dt desc);

create table FAVORITE_SENSOR (userId character varying(36) not null, sensorId character varying(36) not null);
alter table FAVORITE_SENSOR add primary key (userId, sensorId);
alter table FAVORITE_SENSOR add foreign key (userId) references LOGIN_USER (id) on delete cascade;
alter table FAVORITE_SENSOR add foreign key (sensorId) references SENSOR (id) on delete cascade;

insert into LOGIN_USER (id, email,fn,ln) values ('8cd0149f-9ffa-47aa-88d1-1795f55e330f', 'jane@example.com','Jane','Doe');

insert into house (id, name) values ('2cd9038f-9ffa-47aa-88d1-1795f44e220d', 'My House');
insert into device (id, name, houseid) values ('mydevice_1', 'My Device 1', '2cd9038f-9ffa-47aa-88d1-1795f44e220d');
insert into device (id, name, houseid) values ('mydevice_2', 'My Device 2', '2cd9038f-9ffa-47aa-88d1-1795f44e220d');
insert into device (id, name, houseid) values ('mydevice_3', 'My Device 3', '2cd9038f-9ffa-47aa-88d1-1795f44e220d');
insert into sensor (id,name,label,type,deviceid) values ('mysensor_1-1', 'My Sensor 1-1', 'mysensor_1-1', 'temp', 'mydevice_1');
insert into sensor (id,name,label,type,deviceid) values ('mysensor_1-2', 'My Sensor 1-2', 'mysensor_1-2', 'hum', 'mydevice_1');
insert into sensor (id,name,label,type,deviceid) values ('mysensor_2-1', 'My Sensor 2-1', 'mysensor_2-1', 'temp', 'mydevice_2');
insert into sensor (id,name,label,type,deviceid) values ('mysensor_2-2', 'My Sensor 2-2', 'mysensor_2-2', 'hum', 'mydevice_2');
insert into device_watchdog (userId, deviceId, notify, muted_until) values ('8cd0149f-9ffa-47aa-88d1-1795f55e330f', 'mydevice_2', "yes", null);
insert into device_watchdog (userId, deviceId, notify, muted_until) values ('8cd0149f-9ffa-47aa-88d1-1795f55e330f', 'mydevice_3', "muted", current_timestamp + interval '7 days');

insert into house (id, name) values ('1cd8038f-9ffa-47aa-88d1-1795f33e110f', 'Your House');
insert into device (id, name, houseid) values ('yourdevice_1', 'Your Device 1', '1cd8038f-9ffa-47aa-88d1-1795f33e110f');
insert into device (id, name, houseid) values ('yourdevice_2', 'Your Device 2', '1cd8038f-9ffa-47aa-88d1-1795f33e110f');
insert into sensor (id,name,label,type,deviceid) values ('yoursensor_1-1', 'Your Sensor 1-1', 'yoursensor_1-1', 'temp', 'yourdevice_1');
insert into sensor (id,name,label,type,deviceid) values ('yoursensor_1-2', 'Your Sensor 1-2', 'yoursensor_1-2', 'hum', 'yourdevice_1');
insert into sensor (id,name,label,type,deviceid) values ('yoursensor_2-1', 'Your Sensor 2-1', 'yoursensor_2-1', 'temp', 'yourdevice_2');
insert into sensor (id,name,label,type,deviceid) values ('yoursensor_2-2', 'Your Sensor 2-2', 'yoursensor_2-2', 'hum', 'yourdevice_2');

